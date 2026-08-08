import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { prisma } from '@/lib/db';
import { getUserSubscription } from '@/lib/subscription';
import { callHuggingFace, callHuggingFaceVision, extractJsonFromHfOutput } from '@/lib/huggingface';
import { callNineRouterVision } from '@/lib/ninerouter';
import { routeAICall } from '@/lib/ai/router';
import { buildScanReceiptPrompt, buildScanReceiptVisionPrompt } from '@/lib/ai/prompts';


export const maxDuration = 60;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

function withTimeout<T>(promise: Promise<T>, ms: number = 5000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout setelah ${ms}ms`)), ms)
    ),
  ]);
}

// POST /api/ai/scan-receipt
// Strategi Hybrid Bertingkat:
//   1. Gambar → FastAPI OCR (gratis, cepat) → dapat raw text
//   2. Raw text → Gemini Text → Hugging Face Text → OpenAI Text (hemat, urutan biaya naik)
//   3. Jika tidak ada raw text sama sekali → Vision Fallback (Gemini Vision → OpenAI Vision)
export async function POST(request: NextRequest) {
  try {
    // ── 1. AUTH ──────────────────────────────────────────────────────────────
    const token = extractTokenFromHeader(request.headers.get('Authorization') || '');
    if (!token) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

    const decoded = verifyToken(token);
    if (!decoded) return NextResponse.json({ success: false, message: 'Invalid token' }, { status: 401 });

    // ── 2. CEK SUBSCRIPTION ──────────────────────────────────────────────────
    const sub = await getUserSubscription(decoded.userId);
    if (!sub.limits.canScanReceipt) {
      return NextResponse.json({
        success: false,
        message: 'Fitur Scan Struk hanya tersedia untuk paket Student dan Premium.',
      }, { status: 403 });
    }

    // ── 2b. AMBIL DAFTAR KATEGORI USER (NEED vs WANT) ───────────────────────
    const userCategories = await prisma.category.findMany({
      where: { userId: decoded.userId },
      select: { name: true, type: true },
    });
    const categoryNamesList = userCategories.length > 0
      ? userCategories.map((c) => `${c.name} (${c.type === 'NEED' ? 'NEED - Kebutuhan pokok/wajib' : 'WANT - Keinginan/lifestyle/jajan'})`).join(', ')
      : 'Makan & Minum (NEED), Transportasi (NEED), Belanja (WANT), Hiburan (WANT), Kesehatan (NEED), Pendidikan (NEED), Tagihan (NEED), Lainnya';

    // ── 3. BACA BODY ─────────────────────────────────────────────────────────
    let imageBase64 = '';
    let mimeType = '';

    try {
      const body = await request.json();
      imageBase64 = body.imageBase64;
      mimeType = body.mimeType;
    } catch {
      return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 });
    }

    if (!imageBase64) {
      return NextResponse.json({ success: false, message: 'Gambar struk wajib diunggah' }, { status: 400 });
    }

    // Bersihkan prefix header data URL jika ada
    const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;

    const validMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
    const finalMimeType = validMimeTypes.includes(mimeType) ? mimeType : 'image/jpeg';
    const extension = finalMimeType.split('/')[1] === 'heic' ? 'jpg' : finalMimeType.split('/')[1];

    const ocrBackendUrl = process.env.OCR_BACKEND_URL;

    // ── 4. TAHAP 1: FASTAPI OCR (EKSTRAKSI RAW TEXT) ─────────────────────────
    let parsed: any = null;
    let rawText = '';
    let rawOcrSuccess = false;

    if (ocrBackendUrl) {
      try {
        const buffer = Buffer.from(cleanBase64, 'base64');
        const blob = new Blob([buffer], { type: finalMimeType });
        const formData = new FormData();
        formData.append('file', blob, `receipt.${extension}`);

        const ocrApiKey = process.env.OCR_API_KEY || '';
        // Berikan waktu hingga 18 detik agar HuggingFace Space sempat bangun dari cold start
        const ocrResponse = await fetch(`${ocrBackendUrl}/api/v1/scan/struk`, {
          method: 'POST',
          body: formData,
          headers: ocrApiKey ? { 'X-API-Key': ocrApiKey } : {},
          signal: AbortSignal.timeout(18000),
        });

        if (ocrResponse.ok) {
          const ocrResult = await ocrResponse.json();
          const data = ocrResult?.data;
          rawText = data?.raw_text || '';
          let totalAmount = data?.total || 0;

          // Fallback ekstraksi nominal dari raw_text jika data.total kosong
          if (!totalAmount && rawText) {
            const match = rawText.match(/(?:TOTAL|JUMLAH|BAYAR|GRAND\s*TOTAL|NETTO)\s*[:=]?\s*(?:Rp\.?|IDR)?\s*([\d.,]+)/i);
            if (match) {
              const numStr = match[1].replace(/[.,]/g, '');
              const num = parseInt(numStr, 10);
              if (!isNaN(num) && num > 100) totalAmount = num;
            }
          }

          if (totalAmount > 0) {
            // FastAPI OCR berhasil penuh — tidak butuh AI sama sekali!
            parsed = {
              merchant: data?.merchant || 'Toko Terdeteksi',
              totalAmount: totalAmount,
              date: data?.date || new Date().toISOString().split('T')[0],
              items: data?.items || [],
              category: 'Belanja',
              confidence: 'HIGH',
            };
            rawOcrSuccess = true;
            console.log('[SCAN] ✅ Berhasil diekstrak lengkap via FastAPI OCR lokal tanpa AI eksternal.');
          } else if (rawText.trim().length > 20) {
            rawOcrSuccess = true;
            console.log('[SCAN] Raw text diekstrak via FastAPI OCR:', rawText.length, 'karakter, lanjut ke AI Text Mode...');
          }
        } else {
          console.warn(`[SCAN] FastAPI OCR HTTP ${ocrResponse.status}.`);
        }
      } catch (ocrErr: any) {
        console.warn('[SCAN] FastAPI OCR tidak dapat dijangkau:', ocrErr.message);
      }
    } else {
      console.warn('[SCAN] OCR_BACKEND_URL tidak dikonfigurasi, langsung menggunakan Gemini Vision.');
    }

    // ── 5. TAHAP 2A: PARSING TEKS (JIKA FASTAPI OCR DAPAT RAW TEXT) ──────────
    // Urutan: Gemini Text → Hugging Face Text → OpenAI Text
    // Hemat: kirim teks biasa, bukan gambar
    if (!parsed && rawOcrSuccess && rawText) {
      const textPrompt = buildScanReceiptPrompt({
        categoryNamesList,
        rawText,
      });

      // ── 5a. AI GATEWAY (UTAMA) ─────────────────────────────────────────────
      try {
        console.log('[SCAN] Memproses raw text via AI Gateway...');
        const aiRes = await routeAICall(
          [{ role: 'user', content: textPrompt }],
          { modelType: 'TEXT', temperature: 0.1 }
        );

        if (aiRes.success && aiRes.content) {
          const cleaned = aiRes.content.replace(/```json/g, '').replace(/```/g, '').trim();
          try { parsed = JSON.parse(cleaned); } catch {
            const match = cleaned.match(/\{[\s\S]*\}/);
            if (match) parsed = JSON.parse(match[0]);
          }

          if (parsed?.totalAmount) {
            console.log(`[SCAN] ✅ Parsing berhasil via ${aiRes.modelUsed} (${aiRes.tokenUsed}).`);
          } else {
            parsed = null;
            throw new Error('AI Gateway tidak menghasilkan totalAmount yang valid');
          }
        } else {
          throw new Error(aiRes.error || 'AI Gateway text call failed');
        }
      } catch (gatewayTextErr: any) {
        console.warn('[SCAN] AI Gateway Text gagal, beralih ke Gemini 2.0 Flash...', gatewayTextErr.message);

        // ── 5b. GEMINI TEXT (FALLBACK) ─────────────────────────────────────────
        try {
          const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
          const result = await model.generateContent(textPrompt);
          const responseText = result.response.text();
          const cleaned = responseText.replace(/```json/g, '').replace(/```/g, '').trim();

          try { parsed = JSON.parse(cleaned); } catch {
            const match = cleaned.match(/\{[\s\S]*\}/);
            if (match) parsed = JSON.parse(match[0]);
          }

          if (parsed?.totalAmount) {
            console.log('[SCAN] ✅ Parsing berhasil via Gemini Text (Hybrid Mode).');
          } else {
            parsed = null;
          }
        } catch (textParseErr: any) {
          console.warn('[SCAN] Gemini Text gagal:', textParseErr.message);
        }
      }

      // ── 5c. OPENAI TEXT (jika HF juga gagal) ───────────────────────────────
      if (!parsed && process.env.OPENAI_API_KEY) {
        try {
          console.log('[SCAN] Beralih ke OpenAI gpt-4o-mini (Text Mode)...');
          const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: textPrompt }],
            response_format: { type: 'json_object' },
          });
          const content = completion.choices[0]?.message?.content || '{}';
          parsed = JSON.parse(content);
          if (parsed?.totalAmount) {
            console.log('[SCAN] ✅ Berhasil diproses via OpenAI gpt-4o-mini (Text Mode).');
          } else {
            parsed = null;
          }
        } catch (openaiErr: any) {
          console.warn('[SCAN] OpenAI Text fallback juga gagal:', openaiErr.message);
          parsed = null;
        }
      }
    }

    // ── 6. TAHAP 2B: FALLBACK VISION (HF Router Qwen Vision → NineRouter finto) ───
    if (!parsed) {
      console.log('[SCAN] Tidak ada raw text dari OCR. Menggunakan Vision fallback...');

      const visionPrompt = buildScanReceiptVisionPrompt({ categoryNamesList });

      // ── 6a. HUGGING FACE QWEN VISION (Qwen3-VL / Qwen2.5-VL via HF Router) ─────
      try {
        console.log('[SCAN] Mencoba Hugging Face Qwen Vision (HF Router)...');
        const hfVisionOutput = await withTimeout(
          callHuggingFaceVision(visionPrompt, cleanBase64, finalMimeType),
          7000
        );
        parsed = extractJsonFromHfOutput(hfVisionOutput);
        if (parsed?.totalAmount) {
          console.log('[SCAN] ✅ Berhasil diproses via Hugging Face Qwen Vision.');
        } else {
          parsed = null;
          throw new Error('HF Vision tidak menghasilkan totalAmount yang valid');
        }
      } catch (hfVisionErr: any) {
        console.warn('[SCAN] Hugging Face Vision gagal:', hfVisionErr.message);

        // ── 6b. NINEROUTER VISION (Model finto via NINE_ROUTER_MODEL) ────────────
        if (!parsed) {
          try {
            console.log('[SCAN] Mencoba NineRouter Vision (model finto)...');
            const nrOutput = await callNineRouterVision(visionPrompt, cleanBase64, finalMimeType);
            if (nrOutput) {
              parsed = extractJsonFromHfOutput(nrOutput);
              if (parsed?.totalAmount) {
                console.log('[SCAN] ✅ Berhasil diproses via NineRouter (model finto).');
              } else {
                parsed = null;
              }
            }
          } catch (nrErr: any) {
            console.warn('[SCAN] NineRouter Vision gagal:', nrErr.message);
          }
        }
      }

      // ── 6c. OPENAI VISION (Fallback Opsional) ───────────────────────────
      if (!parsed && process.env.OPENAI_API_KEY) {
        try {
          console.log('[SCAN] Beralih ke OpenAI gpt-4o-mini (Vision Mode)...');
          const completion = await withTimeout(
            openai.chat.completions.create({
              model: 'gpt-4o-mini',
              messages: [
                {
                  role: 'user',
                  content: [
                    { type: 'text', text: visionPrompt },
                    { type: 'image_url', image_url: { url: `data:${finalMimeType};base64,${cleanBase64}` } },
                  ],
                },
              ],
              response_format: { type: 'json_object' },
            }),
            6000
          );
          const content = completion.choices[0]?.message?.content || '{}';
          parsed = JSON.parse(content);
          if (parsed?.totalAmount) {
            console.log('[SCAN] ✅ Berhasil diproses via OpenAI gpt-4o-mini (Vision Mode).');
          } else {
            parsed = null;
          }
        } catch (openaiErr: any) {
          console.error('[SCAN] OpenAI Vision fallback juga gagal:', openaiErr.message);
        }
      }
    }

    // ── 7. VALIDASI DATA HASIL PARSING ────────────────────────────────────────
    if (!parsed || !parsed.totalAmount) {
      console.warn('[SCAN] ❌ Gagal verifikasi struk! Hasil parsing tidak menemukan nominal:', JSON.stringify(parsed));
      return NextResponse.json({
        success: false,
        message: 'Struk tidak terbaca. Coba foto ulang dengan pencahayaan yang lebih baik.',
      }, { status: 422 });
    }

    const rawCat = parsed.category || 'Lainnya';
    const cleanCat = rawCat.replace(/\s*\((NEED|WANT).*?\)/i, '').trim();

    const responseData = {
      merchant: parsed.merchant || 'Tidak diketahui',
      amount: parsed.totalAmount,
      date: parsed.date || new Date().toISOString().split('T')[0],
      items: parsed.items || [],
      category: cleanCat || 'Lainnya',
      confidence: parsed.confidence || 'MEDIUM',
    };

    console.log('[SCAN] ✅ Sukses membaca struk! Data didapat:', JSON.stringify(responseData));

    return NextResponse.json({
      success: true,
      message: 'Struk berhasil dibaca',
      data: responseData,
    });
  } catch (error: any) {
    console.error('Scan receipt error:', error.message);
    return NextResponse.json({
      success: false,
      message: 'Terjadi kesalahan sistem. Coba lagi nanti.',
    }, { status: 500 });
  }
}
