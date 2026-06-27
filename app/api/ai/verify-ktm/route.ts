import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { generateKtmToken } from '@/lib/auth';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// POST /api/ai/verify-ktm
// Route ini dipertahankan untuk backward compatibility.
// Menggunakan strategi Hybrid: FastAPI OCR → Gemini Vision fallback
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageBase64, mimeType } = body;

    if (!imageBase64) {
      return NextResponse.json({ success: false, message: 'Image is required' }, { status: 400 });
    }

    const validMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
    const finalMimeType = validMimeTypes.includes(mimeType) ? mimeType : 'image/jpeg';
    const extension = finalMimeType === 'image/heic' ? 'jpg' : finalMimeType.split('/')[1];

    let extractedName = '';
    let extractedNim = '';
    let extractedUniv = 'Universitas Terdeteksi';
    let isOcrSuccessful = false;

    // ── TAHAP 1: FastAPI OCR (Gratis, Prioritas Utama) ────────────────────────
    const ocrBackendUrl = process.env.OCR_BACKEND_URL;
    const ocrApiKey = process.env.OCR_API_KEY || '';

    if (ocrBackendUrl) {
      try {
        const buffer = Buffer.from(imageBase64, 'base64');
        const blob = new Blob([buffer], { type: finalMimeType });
        const formData = new FormData();
        formData.append('file', blob, `ktm.${extension}`);

        const ocrResponse = await fetch(`${ocrBackendUrl}/api/v1/scan/ktm`, {
          method: 'POST',
          body: formData,
          headers: ocrApiKey ? { 'X-API-Key': ocrApiKey } : {},
          signal: AbortSignal.timeout(15000),
        });

        if (ocrResponse.ok) {
          const ocrResult = await ocrResponse.json();
          const data = ocrResult?.data;
          if (ocrResult.success && data?.nim && data?.name) {
            extractedName = data.name;
            extractedNim = data.nim;
            extractedUniv = detectUniversity(data.raw_text || '');
            isOcrSuccessful = true;
          }
        }
      } catch (ocrErr: any) {
        console.warn('[ai/verify-ktm] FastAPI OCR gagal:', ocrErr.message);
      }
    }

    // ── TAHAP 2: Gemini Vision Fallback ───────────────────────────────────────
    if (!isOcrSuccessful) {
      const prompt = `
Kamu adalah sistem pendeteksi KTM Indonesia.
Baca kartu identitas dari gambar ini. Jika bukan KTM, kembalikan valid=false.
Kembalikan HANYA JSON ini tanpa teks lain:
{ "valid": true, "name": "Nama Lengkap", "nim": "12345678", "university": "Nama Kampus" }
      `.trim();

      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      const result = await model.generateContent([
        { inlineData: { data: imageBase64, mimeType: finalMimeType as any } },
        prompt,
      ]);
      const responseText = result.response.text();
      const cleaned = responseText.replace(/```json/g, '').replace(/```/g, '').trim();

      let parsed: any;
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (match) parsed = JSON.parse(match[0]);
      }

      if (!parsed || !parsed.valid || (!parsed.nim && !parsed.name)) {
        return NextResponse.json({
          success: false,
          message: 'KTM tidak terbaca jelas. Coba foto ulang dengan pencahayaan yang lebih baik.',
        }, { status: 422 });
      }

      extractedName = parsed.name || '';
      extractedNim = parsed.nim || '';
      extractedUniv = parsed.university || 'Universitas Terdeteksi';
    }

    const ktmToken = generateKtmToken(extractedNim, extractedName);

    return NextResponse.json({
      success: true,
      message: 'KTM berhasil diverifikasi',
      data: {
        name: extractedName,
        nim: extractedNim,
        university: extractedUniv,
        confidence: 'HIGH',
      },
      ktmToken,
    });
  } catch (error: any) {
    console.error('Verify KTM error:', error);
    return NextResponse.json({
      success: false,
      message: 'Gagal memproses gambar KTM. Coba lagi.',
      error: error.message,
    }, { status: 500 });
  }
}

function detectUniversity(text: string): string {
  const t = text.toLowerCase();
  if (t.includes('universitas indonesia')) return 'Universitas Indonesia';
  if (t.includes('gadjah mada') || t.includes('ugm')) return 'Universitas Gadjah Mada';
  if (t.includes('padjadjaran') || t.includes('unpad')) return 'Universitas Padjadjaran';
  if (t.includes('brawijaya')) return 'Universitas Brawijaya';
  if (t.includes('airlangga') || t.includes('unair')) return 'Universitas Airlangga';
  if (t.includes('diponegoro') || t.includes('undip')) return 'Universitas Diponegoro';
  if (t.includes('telkom')) return 'Telkom University';
  if (t.includes('itb') || t.includes('teknologi bandung')) return 'Institut Teknologi Bandung';
  if (t.includes('binus') || t.includes('bina nusantara')) return 'Binus University';
  const match = text.match(/(universitas|institut|politeknik|sekolah tinggi)\s+[a-zA-Z\s]{3,}/i);
  return match ? match[0].trim() : 'Universitas Terdeteksi';
}
