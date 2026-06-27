import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { getUserSubscription } from '@/lib/subscription';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

// POST /api/ai/scan-receipt
// Strategi Hybrid:
//   1. Gambar dikirim ke FastAPI OCR untuk mendapatkan raw text (gratis, cepat)
//   2. Raw text dikirim ke Gemini 1.5 Flash TEXT (bukan Vision) untuk diparsing
//      → Jauh lebih murah dari mengirim gambar ke Gemini Vision
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
        const ocrResponse = await fetch(`${ocrBackendUrl}/api/v1/scan/struk`, {
          method: 'POST',
          body: formData,
          headers: ocrApiKey ? { 'X-API-Key': ocrApiKey } : {},
          signal: AbortSignal.timeout(20000), // timeout 20 detik
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
            console.log('[SCAN] Raw text diekstrak via FastAPI OCR:', rawText.length, 'karakter, lanjut ke AI...');
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

    // ── 5. TAHAP 2A: PARSING DENGAN GEMINI TEXT (JIKA FASTAPI OCR BERHASIL) ──
    // Hemat token: kirim teks biasa, bukan gambar
    if (!parsed && rawOcrSuccess && rawText) {
      const textPrompt = `
Kamu adalah parser struk/kwitansi Indonesia yang sangat akurat.
Analisis teks hasil OCR di bawah ini dan ekstrak informasi transaksi ke dalam format JSON.

Teks hasil OCR:
"""
${rawText}
"""

Kembalikan HANYA JSON tanpa teks lain, dalam format berikut:
{
  "merchant": "Nama toko/restoran/merchant (paling relevan)",
  "totalAmount": 0,
  "date": "YYYY-MM-DD atau null jika tidak ada",
  "items": [
    { "name": "nama item/barang", "price": 0, "qty": 1 }
  ],
  "category": "pilih SATU dari: Makan & Minum, Transportasi, Belanja, Hiburan, Kesehatan, Pendidikan, Tagihan, Lainnya",
  "confidence": "HIGH/MEDIUM/LOW"
}

Rules:
- totalAmount adalah total akhir yang dibayar (integer, tanpa titik/koma)
- Jika ada tulisan TOTAL, GRAND TOTAL, JUMLAH, gunakan nilai tersebut
- Semua harga dalam Rupiah (integer)
- confidence: HIGH jika teks jelas, MEDIUM jika agak berantakan, LOW jika tidak yakin
      `.trim();

      try {
        console.log('[SCAN] Memproses raw text dengan Gemini 1.5 Flash (Text Mode)...');
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const result = await model.generateContent(textPrompt);
        const responseText = result.response.text();
        const cleaned = responseText.replace(/```json/g, '').replace(/```/g, '').trim();

        try {
          parsed = JSON.parse(cleaned);
        } catch {
          const match = cleaned.match(/\{[\s\S]*\}/);
          if (match) parsed = JSON.parse(match[0]);
        }

        if (parsed?.totalAmount) {
          console.log('[SCAN] Parsing berhasil via Gemini Text (Hybrid Mode).');
        } else {
          console.warn('[SCAN] Gemini Text tidak menghasilkan data valid, beralih ke Gemini Vision...');
          parsed = null;
        }
      } catch (textParseErr: any) {
        console.warn('[SCAN] Gemini Text parsing gagal:', textParseErr.message);
        if (process.env.OPENAI_API_KEY) {
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
              console.log('[SCAN] Berhasil diproses via OpenAI gpt-4o-mini (Text Mode).');
            } else {
              parsed = null;
            }
          } catch (openaiErr: any) {
            console.warn('[SCAN] OpenAI Text fallback juga gagal:', openaiErr.message);
            parsed = null;
          }
        } else {
          parsed = null;
        }
      }
    }

    // ── 6. TAHAP 2B: FALLBACK KE GEMINI VISION (JIKA HYBRID GAGAL) ──────────
    // Digunakan jika FastAPI tidak tersedia ATAU raw text tidak cukup baik
    if (!parsed) {
      console.log('[SCAN] Menggunakan Gemini Vision sebagai fallback langsung...');

      const visionPrompt = `
Kamu adalah OCR cerdas untuk struk/kwitansi Indonesia.
Ekstrak informasi dari gambar struk/kwitansi ini dan kembalikan dalam format JSON PERSIS seperti di bawah ini.
Jangan tambahkan teks lain, hanya JSON.

{
  "merchant": "nama toko/restoran/tempat",
  "totalAmount": 0,
  "date": "YYYY-MM-DD atau null jika tidak ada",
  "items": [
    { "name": "nama item", "price": 0, "qty": 1 }
  ],
  "category": "pilih SATU dari: Makan & Minum, Transportasi, Belanja, Hiburan, Kesehatan, Pendidikan, Tagihan, Lainnya",
  "confidence": "HIGH/MEDIUM/LOW"
}

Rules:
- totalAmount adalah total akhir yang dibayar (setelah diskon/pajak)
- Jika ada tulisan TOTAL, GRAND TOTAL, JUMLAH, gunakan nilai itu
- Semua harga dalam Rupiah (integer, tanpa titik/koma)
- confidence: HIGH jika struk jelas, MEDIUM jika agak buram, LOW jika tidak yakin
      `.trim();

      try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const result = await model.generateContent([
          {
            inlineData: {
              data: cleanBase64,
              mimeType: finalMimeType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/heic',
            },
          },
          visionPrompt,
        ]);

        const responseText = result.response.text();
        const cleaned = responseText.replace(/```json/g, '').replace(/```/g, '').trim();

        try {
          parsed = JSON.parse(cleaned);
        } catch {
          const match = cleaned.match(/\{[\s\S]*\}/);
          if (match) parsed = JSON.parse(match[0]);
        }

        console.log('[SCAN] Berhasil diproses via Gemini Vision Fallback.');
      } catch (visionErr: any) {
        console.warn('[SCAN] Gemini Vision fallback gagal:', visionErr.message);
        if (process.env.OPENAI_API_KEY) {
          try {
            console.log('[SCAN] Beralih ke OpenAI gpt-4o-mini (Vision Mode)...');
            const completion = await openai.chat.completions.create({
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
            });
            const content = completion.choices[0]?.message?.content || '{}';
            parsed = JSON.parse(content);
            if (parsed?.totalAmount) {
              console.log('[SCAN] Berhasil diproses via OpenAI gpt-4o-mini (Vision Mode).');
            } else {
              parsed = null;
            }
          } catch (openaiErr: any) {
            console.error('[SCAN] OpenAI Vision fallback juga gagal:', openaiErr.message);
            return NextResponse.json({
              success: false,
              message: 'Gagal membaca struk. Pastikan foto jelas, tidak buram, dan seluruh struk terlihat.',
            }, { status: 422 });
          }
        } else {
          return NextResponse.json({
            success: false,
            message: 'Gagal membaca struk. Pastikan foto jelas, tidak buram, dan seluruh struk terlihat.',
          }, { status: 422 });
        }
      }
    }

    // ── 7. VALIDASI DATA HASIL PARSING ────────────────────────────────────────
    if (!parsed || !parsed.totalAmount) {
      console.warn('[SCAN] ❌ Gagal verifikasi struk! Hasil parsing tidak menemukan nominal atau struk tidak terbaca:', JSON.stringify(parsed));
      return NextResponse.json({
        success: false,
        message: 'Struk tidak terbaca. Coba foto ulang dengan pencahayaan yang lebih baik.',
      }, { status: 422 });
    }

    const responseData = {
      merchant: parsed.merchant || 'Tidak diketahui',
      amount: parsed.totalAmount,
      date: parsed.date || new Date().toISOString().split('T')[0],
      items: parsed.items || [],
      category: parsed.category || 'Lainnya',
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
