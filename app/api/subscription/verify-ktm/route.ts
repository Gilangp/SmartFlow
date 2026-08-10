import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { prisma } from '@/lib/db';
import { callHuggingFace, callHuggingFaceVision, extractJsonFromHfOutput } from '@/lib/huggingface';
import { callNineRouterVision } from '@/lib/ninerouter';
import { buildVerifyKtmPrompt, buildVerifyKtmVisionPrompt } from '@/lib/ai/prompts';

// Izinkan durasi eksekusi Vercel Serverless Function hingga 60 detik (mencegah 503 Timeout)
export const maxDuration = 60;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

// Helper timeout wrapper untuk AI API calls
function withTimeout<T>(promise: Promise<T>, ms: number = 5000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout setela ${ms}ms`)), ms)
    ),
  ]);
}

// POST /api/subscription/verify-ktm
// Strategi Hybrid Bertingkat:
//   1. FastAPI OCR (gratis di HF Space) → Regex lokal (Timeout 4s fail-fast jika cold start)
//   2. Jika regex gagal tapi ada raw text → Qwen Text (HF Router) → OpenAI Text
//   3. Jika tidak ada raw text → Qwen Vision Fallback (HF Router) → OpenAI Vision
//   4. Jika sukses → Simpan ke DB & Upgrade plan ke STUDENT
export async function POST(request: NextRequest) {
  try {
    // ── 1. AUTH ──────────────────────────────────────────────────────────────
    const token = extractTokenFromHeader(request.headers.get('Authorization') || '');
    if (!token) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

    const decoded = verifyToken(token);
    if (!decoded) return NextResponse.json({ success: false, message: 'Invalid token' }, { status: 401 });

    const body = await request.json();
    const { imageBase64, mimeType } = body;

    if (!imageBase64) {
      return NextResponse.json({ success: false, message: 'Gambar KTM wajib diunggah' }, { status: 400 });
    }

    // Bersihkan prefix header data URL secara mutlak
    const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;

    const validMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const finalMimeType = validMimeTypes.includes(mimeType) ? mimeType : 'image/jpeg';
    const extension = finalMimeType.split('/')[1];

    let extractedName = '';
    let extractedNim = '';
    let extractedUniv = 'Universitas Terdeteksi';
    let rawText = '';
    let isOcrSuccessful = false;

    // ── 2. TAHAP 1: FASTAPI OCR (GRATIS, PRIORITAS UTAMA) ───────────────────
    const ocrBackendUrl = process.env.OCR_BACKEND_URL;

    if (ocrBackendUrl) {
      try {
        const buffer = Buffer.from(cleanBase64, 'base64');
        const blob = new Blob([buffer], { type: finalMimeType });
        const formData = new FormData();
        formData.append('file', blob, `ktm.${extension}`);

        const ocrApiKey = process.env.OCR_API_KEY || '';
        // Berikan waktu hingga 18 detik agar HuggingFace Space sempat bangun dari cold start
        const ocrResponse = await fetch(`${ocrBackendUrl}/api/v1/scan/ktm`, {
          method: 'POST',
          body: formData,
          headers: ocrApiKey ? { 'X-API-Key': ocrApiKey } : {},
          signal: AbortSignal.timeout(18000),
        });

        if (ocrResponse.ok) {
          const ocrResult = await ocrResponse.json();
          const data = ocrResult?.data;
          rawText = data?.raw_text || '';
          console.log('[KTM] Hasil ekstraksi FastAPI OCR:', JSON.stringify(data));

          const detectedUniv = detectUniversity(data?.raw_text || data?.study_program || data?.faculty || '');
          let detectedName = data?.name || '';

          // Fallback ekstraksi nama dari raw_text jika data.name kosong
          if (!detectedName && data?.nim && data?.raw_text) {
            const lines = data.raw_text.split('\n').map((l: string) => l.trim()).filter(Boolean);
            const nimIdx = lines.findIndex((l: string) => l.includes(data.nim));
            if (nimIdx !== -1) {
              const ignore = ['politeknik', 'universitas', 'institut', 'sekolah', 'tinggi', 'negeri', 'teknik', 'informatika', 'fakultas', 'prodi', 'program', 'studi', 'kartu', 'tanda', 'mahasiswa', 'month', 'year', 'valid', 'berlaku', 'bni', 'bri', 'bca', 'mandiri', 'bank', 'd-i', 'd-ii', 'd-iii', 'd-iv', 's1', 's2', 's3', 'hru', 'ialid'];
              const cands = [lines[nimIdx + 1], lines[nimIdx - 1]].filter(Boolean);
              for (const c of cands) {
                if (c.length >= 3 && !/\d/.test(c) && !ignore.some(iw => c.toLowerCase().includes(iw))) {
                  detectedName = c;
                  break;
                }
              }
            }
          }

          // Cek ketat: harus ada NIM, Nama, dan Kampus terdeteksi
          if (ocrResult.success && data?.nim && detectedName && detectedUniv !== 'Universitas Terdeteksi') {
            extractedName = detectedName;
            extractedNim = data.nim;
            extractedUniv = detectedUniv;
            isOcrSuccessful = true;
            console.log('[KTM] Berhasil diverifikasi lengkap via FastAPI OCR tanpa AI eksternal.');
          } else if (rawText.trim().length > 20) {
            console.log('[KTM] FastAPI OCR dapat raw text tapi regex gagal, lanjut ke AI Text Mode...');
          } else {
            console.warn('[KTM] FastAPI OCR tidak menghasilkan data memadai, beralih ke Vision fallback...');
          }
        } else {
          console.warn(`[KTM] FastAPI OCR HTTP ${ocrResponse.status}.`);
        }
      } catch (ocrErr: any) {
        console.warn('[KTM] FastAPI OCR tidak dapat dijangkau:', ocrErr.message);
      }
    } else {
      console.warn('[KTM] OCR_BACKEND_URL tidak dikonfigurasi, langsung menggunakan Vision fallback.');
    }

    // ── 3. TAHAP 2: AI TEXT PARSING (jika OCR dapat raw text tapi regex gagal) ──
    // Hemat: kirim teks biasa, bukan gambar
    if (!isOcrSuccessful && rawText.trim().length > 20) {
      const textPrompt = buildVerifyKtmPrompt({ rawText });

      // ── 3a. GEMINI TEXT ───────────────────────────────────────────────────
      try {
        console.log('[KTM] Mencoba Gemini 2.0 Flash (Text Mode)...');
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const result = await model.generateContent(textPrompt);
        const responseText = result.response.text();
        const cleaned = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        let parsed: any = null;

        try { parsed = JSON.parse(cleaned); } catch {
          const match = cleaned.match(/\{[\s\S]*\}/);
          if (match) parsed = JSON.parse(match[0]);
        }

        if (parsed?.valid && parsed?.nim && parsed?.name && parsed?.university) {
          extractedName = parsed.name;
          extractedNim = parsed.nim;
          extractedUniv = parsed.university;
          isOcrSuccessful = true;
          console.log('[KTM] Berhasil via Gemini Text Mode.');
        } else {
          throw new Error('Gemini Text tidak menghasilkan data KTM valid');
        }
      } catch (geminiTextErr: any) {
        console.warn('[KTM] Gemini Text Mode gagal:', geminiTextErr.message);
      }

      // ── 3b. HUGGING FACE TEXT (jika Gemini Text gagal) ───────────────────
      if (!isOcrSuccessful) {
        try {
          console.log('[KTM] Mencoba Hugging Face (Text Mode)...');
          const hfOutput = await callHuggingFace(textPrompt, {
            maxNewTokens: 200,
            temperature: 0.1,
          });
          const parsed = extractJsonFromHfOutput(hfOutput);

          if (parsed?.valid && parsed?.nim && parsed?.name && parsed?.university) {
            extractedName = parsed.name as string;
            extractedNim = parsed.nim as string;
            extractedUniv = parsed.university as string;
            isOcrSuccessful = true;
            console.log('[KTM] Berhasil via Hugging Face Text Mode.');
          } else {
            throw new Error('HF tidak menghasilkan data KTM valid');
          }
        } catch (hfErr: any) {
          console.warn('[KTM] Hugging Face Text Mode gagal:', hfErr.message);
        }
      }

      // ── 3c. OPENAI TEXT (jika HF juga gagal) ─────────────────────────────
      if (!isOcrSuccessful && process.env.OPENAI_API_KEY) {
        try {
          console.log('[KTM] Mencoba OpenAI gpt-4o-mini (Text Mode)...');
          const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: textPrompt }],
            response_format: { type: 'json_object' },
          });
          const rawOpenAI = completion.choices[0]?.message?.content || '{}';
          const parsed = JSON.parse(rawOpenAI);

          if (parsed?.valid && parsed?.nim && parsed?.name && parsed?.university) {
            extractedName = parsed.name;
            extractedNim = parsed.nim;
            extractedUniv = parsed.university;
            isOcrSuccessful = true;
            console.log('[KTM] Berhasil via OpenAI Text Mode.');
          }
        } catch (openaiTextErr: any) {
          console.warn('[KTM] OpenAI Text Mode gagal:', openaiTextErr.message);
        }
      }
    }

    // ── 4. TAHAP 3: VISION FALLBACK (HF Router Qwen Vision → NineRouter model finto) ───
    if (!isOcrSuccessful) {
      console.log('[KTM] Tidak ada raw text memadai, beralih ke Vision Fallback...');

      const visionPrompt = buildVerifyKtmVisionPrompt();

      let parsed: any = null;

      // ── 4a. HUGGING FACE QWEN VISION (Qwen3-VL / Qwen2.5-VL via HF Router) ─────
      try {
        console.log('[KTM] Mencoba Hugging Face Qwen Vision (HF Router)...');
        const hfVisionOutput = await withTimeout(
          callHuggingFaceVision(visionPrompt, cleanBase64, finalMimeType),
          7000
        );
        parsed = extractJsonFromHfOutput(hfVisionOutput);
        if (parsed?.valid && parsed?.nim && parsed?.name && parsed?.university) {
          console.log('[KTM] ✅ Berhasil diverifikasi via Qwen Vision (Hugging Face Router).');
        } else {
          parsed = null;
          throw new Error('HF Qwen Vision tidak menghasilkan data KTM yang valid');
        }
      } catch (hfVisionErr: any) {
        console.warn('[KTM] Hugging Face Qwen Vision gagal:', hfVisionErr.message);

        // ── 4b. NINEROUTER VISION (Model finto via NINE_ROUTER_MODEL) ────────────
        if (!parsed) {
          try {
            console.log('[KTM] Mencoba NineRouter Vision (model finto)...');
            const nrOutput = await callNineRouterVision(visionPrompt, cleanBase64, finalMimeType);
            if (nrOutput) {
              parsed = extractJsonFromHfOutput(nrOutput);
              if (parsed?.valid && parsed?.nim && parsed?.name && parsed?.university) {
                console.log('[KTM] ✅ Berhasil diverifikasi via NineRouter (model finto).');
              } else {
                parsed = null;
              }
            }
          } catch (nrErr: any) {
            console.warn('[KTM] NineRouter Vision gagal:', nrErr.message);
          }
        }
      }

      // ── 4c. OPENAI VISION (Fallback opsional jika HF Qwen & NineRouter gagal) ─
      if (!parsed && process.env.OPENAI_API_KEY) {
        try {
          console.log('[KTM] Beralih ke OpenAI gpt-4o-mini (Vision Mode)...');
          const openaiResponse = await withTimeout(
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
          const rawOpenAI = openaiResponse.choices[0]?.message?.content || '{}';
          parsed = JSON.parse(rawOpenAI);
          console.log('[KTM] ✅ Berhasil diverifikasi via OpenAI Vision Fallback.');
        } catch (openaiErr: any) {
          console.error('[KTM] Vision Fallback gagal:', openaiErr.message);
        }
      }

      if (!parsed || !parsed.valid || !parsed.nim || !parsed.name || !parsed.university || parsed.university === 'Universitas Terdeteksi') {
        return NextResponse.json({
          success: false,
          message: 'KTM tidak terbaca lengkap. Pastikan foto memperlihatkan Nama Mahasiswa, NIM, dan Nama Kampus dengan jelas.',
        }, { status: 422 });
      }

      extractedName = parsed.name;
      extractedNim = parsed.nim;
      extractedUniv = parsed.university;
    }

    // ── Validasi akhir ──────────────────────────────────────────────────────
    if (!extractedNim || !extractedName || !extractedUniv || extractedUniv === 'Universitas Terdeteksi') {
      return NextResponse.json({
        success: false,
        message: 'KTM tidak terbaca lengkap. Pastikan foto memperlihatkan Nama Mahasiswa, NIM, dan Nama Kampus dengan jelas.',
      }, { status: 422 });
    }

    // ── 5. SIMPAN KE DATABASE ─────────────────────────────────────────────────
    await prisma.ktmVerification.upsert({
      where: { userId: decoded.userId },
      update: {
        imageUrl: 'verified-by-hybrid-ocr',
        extractedName,
        extractedNim,
        extractedUniv,
        status: 'APPROVED',
        verifiedAt: new Date(),
      },
      create: {
        userId: decoded.userId,
        imageUrl: 'verified-by-hybrid-ocr',
        extractedName,
        extractedNim,
        extractedUniv,
        status: 'APPROVED',
        verifiedAt: new Date(),
      },
    });

    // ── 6. UPGRADE SUBSCRIPTION KE STUDENT ───────────────────────────────────
    await prisma.subscription.upsert({
      where: { userId: decoded.userId },
      update: { plan: 'STUDENT', status: 'ACTIVE', expiresAt: null },
      create: { userId: decoded.userId, plan: 'STUDENT', status: 'ACTIVE', expiresAt: null },
    });

    console.log('[KTM] Verifikasi Sukses! Data terdeteksi:', JSON.stringify({ name: extractedName, nim: extractedNim, university: extractedUniv }));

    return NextResponse.json({
      success: true,
      message: 'KTM berhasil diverifikasi',
      data: {
        name: extractedName || 'Mahasiswa',
        nim: extractedNim || '',
        university: extractedUniv,
        plan: 'STUDENT',
      },
    });
  } catch (error: any) {
    console.error('KTM Verification error:', error);
    return NextResponse.json({
      success: false,
      message: 'Terjadi kesalahan pada sistem. Silakan coba lagi nanti.',
    }, { status: 500 });
  }
}

// ── Helper: Deteksi Nama Universitas dari Raw Text ────────────────────────────
function detectUniversity(text: string): string {
  const t = text.toLowerCase();
  if (t.includes('universitas indonesia') || (t.includes('ui') && t.includes('depok'))) return 'Universitas Indonesia';
  if (t.includes('gadjah mada') || t.includes('ugm')) return 'Universitas Gadjah Mada';
  if (t.includes('padjadjaran') || t.includes('unpad')) return 'Universitas Padjadjaran';
  if (t.includes('brawijaya') || t.includes('ub')) return 'Universitas Brawijaya';
  if (t.includes('airlangga') || t.includes('unair')) return 'Universitas Airlangga';
  if (t.includes('diponegoro') || t.includes('undip')) return 'Universitas Diponegoro';
  if (t.includes('hasanuddin') || t.includes('unhas')) return 'Universitas Hasanuddin';
  if (t.includes('telkom')) return 'Telkom University';
  if (t.includes('binus') || t.includes('bina nusantara')) return 'Binus University';
  if (t.includes('mercubuana') || t.includes('mercu buana')) return 'Universitas Mercu Buana';
  if (t.includes('gunadarma')) return 'Universitas Gunadarma';
  if (t.includes('itb') || t.includes('teknologi bandung')) return 'Institut Teknologi Bandung';
  if (t.includes('its') || t.includes('sepuluh nopember')) return 'Institut Teknologi Sepuluh Nopember';
  if (t.includes('ipb')) return 'Institut Pertanian Bogor';
  if (t.includes('polinema') || (t.includes('politeknik') && (t.includes('malang') || t.includes('negeri'))) || t.includes('negerimalang')) return 'Politeknik Negeri Malang';

  const match = text.match(/(universitas|institut|politeknik|sekolah tinggi)\s+[a-zA-Z\s]{3,}/i);
  return match ? match[0].trim() : 'Universitas Terdeteksi';
}
