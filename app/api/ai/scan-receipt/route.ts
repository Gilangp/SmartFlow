import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getUserSubscription } from '@/lib/subscription';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

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

    const validMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
    const finalMimeType = validMimeTypes.includes(mimeType) ? mimeType : 'image/jpeg';
    const extension = finalMimeType.split('/')[1] === 'heic' ? 'jpg' : finalMimeType.split('/')[1];

    const ocrBackendUrl = process.env.OCR_BACKEND_URL;

    // ── 4. TAHAP 1: FASTAPI OCR (EKSTRAKSI RAW TEXT) ─────────────────────────
    let rawText = '';
    let rawOcrSuccess = false;

    if (ocrBackendUrl) {
      try {
        const buffer = Buffer.from(imageBase64, 'base64');
        const blob = new Blob([buffer], { type: finalMimeType });
        const formData = new FormData();
        formData.append('file', blob, `receipt.${extension}`);

        const ocrApiKey = process.env.OCR_API_KEY || '';
        const ocrResponse = await fetch(`${ocrBackendUrl}/api/v1/scan`, {
          method: 'POST',
          body: formData,
          headers: ocrApiKey ? { 'X-API-Key': ocrApiKey } : {},
          signal: AbortSignal.timeout(20000), // timeout 20 detik
        });

        if (ocrResponse.ok) {
          const ocrResult = await ocrResponse.json();
          rawText = ocrResult?.data?.raw_text || '';

          if (rawText.trim().length > 20) {
            rawOcrSuccess = true;
            console.log('[SCAN] Raw text berhasil diekstrak via FastAPI OCR:', rawText.length, 'karakter.');
          } else {
            console.warn('[SCAN] FastAPI OCR menghasilkan teks terlalu pendek, beralih ke Gemini Vision...');
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
    let parsed: any = null;

    if (rawOcrSuccess && rawText) {
      try {
        console.log('[SCAN] Memproses raw text dengan Gemini 1.5 Flash (Text Mode)...');

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
        parsed = null;
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
              data: imageBase64,
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
        console.error('[SCAN] Gemini Vision fallback juga gagal:', visionErr.message);
        return NextResponse.json({
          success: false,
          message: 'Gagal membaca struk. Pastikan foto jelas, tidak buram, dan seluruh struk terlihat.',
        }, { status: 422 });
      }
    }

    // ── 7. VALIDASI DATA HASIL PARSING ────────────────────────────────────────
    if (!parsed || !parsed.totalAmount) {
      return NextResponse.json({
        success: false,
        message: 'Struk tidak terbaca. Coba foto ulang dengan pencahayaan yang lebih baik.',
      }, { status: 422 });
    }

    return NextResponse.json({
      success: true,
      message: 'Struk berhasil dibaca',
      data: {
        merchant: parsed.merchant || 'Tidak diketahui',
        amount: parsed.totalAmount,
        date: parsed.date || new Date().toISOString().split('T')[0],
        items: parsed.items || [],
        category: parsed.category || 'Lainnya',
        confidence: parsed.confidence || 'MEDIUM',
      },
    });
  } catch (error: any) {
    console.error('Scan receipt error:', error.message);
    return NextResponse.json({
      success: false,
      message: 'Terjadi kesalahan sistem. Coba lagi nanti.',
    }, { status: 500 });
  }
}
