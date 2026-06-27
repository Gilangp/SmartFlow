import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { generateKtmToken } from '@/lib/auth';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

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

    // Bersihkan prefix header data URL (seperti data:image/jpeg;base64,) secara mutlak
    const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;

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
        const buffer = Buffer.from(cleanBase64, 'base64');
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
          console.log('[ai/verify-ktm] Hasil ekstraksi FastAPI OCR:', JSON.stringify(data));
          const detectedUniv = detectUniversity(data?.raw_text || data?.study_program || data?.faculty || '');
          // Cek ketat: harus ada NIM, Nama, dan Kampus terdeteksi
          if (ocrResult.success && data?.nim && data?.name && detectedUniv !== 'Universitas Terdeteksi') {
            extractedName = data.name;
            extractedNim = data.nim;
            extractedUniv = detectedUniv;
            isOcrSuccessful = true;
          }
        }
      } catch (ocrErr: any) {
        console.warn('[ai/verify-ktm] FastAPI OCR gagal:', ocrErr.message);
      }
    }

    // ── TAHAP 2: Gemini / OpenAI Vision Fallback ──────────────────────────────
    if (!isOcrSuccessful) {
      const prompt = `
Kamu adalah sistem pendeteksi KTM Indonesia.
Baca kartu identitas dari gambar ini. Jika bukan KTM atau teksnya tidak jelas, kembalikan valid=false.
Jika ini adalah KTM yang jelas, ekstrak nama mahasiswa, NIM, dan nama Universitas/Kampus.
WAJIB: Ketiganya (name, nim, university) harus terbaca dengan jelas. Jika ada salah satu yang kosong atau tidak terbaca, kembalikan valid=false.
Kembalikan HANYA JSON ini tanpa teks lain:
{ "valid": true, "name": "Nama Lengkap", "nim": "12345678", "university": "Nama Kampus" }
      `.trim();

      let parsed: any = null;

      try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const result = await model.generateContent([
          { inlineData: { data: cleanBase64, mimeType: finalMimeType as any } },
          prompt,
        ]);
        const responseText = result.response.text();
        const cleaned = responseText.replace(/```json/g, '').replace(/```/g, '').trim();

        try {
          parsed = JSON.parse(cleaned);
        } catch {
          const match = cleaned.match(/\{[\s\S]*\}/);
          if (match) parsed = JSON.parse(match[0]);
        }
      } catch (geminiErr: any) {
        console.warn('[ai/verify-ktm] Gemini limit/gagal, beralih ke OpenAI...', geminiErr.message);
        try {
          const openaiResponse = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: prompt },
                  {
                    type: 'image_url',
                    image_url: { url: `data:${finalMimeType};base64,${cleanBase64}` },
                  },
                ],
              },
            ],
            response_format: { type: 'json_object' },
          });

          const rawOpenAI = openaiResponse.choices[0]?.message?.content || '{}';
          parsed = JSON.parse(rawOpenAI);
        } catch (openaiErr: any) {
          console.error('[ai/verify-ktm] Kedua AI Vision gagal:', openaiErr.message);
          return NextResponse.json({
            success: false,
            message: 'Sistem AI tidak dapat memproses gambar saat ini. Coba lagi nanti.',
          }, { status: 503 });
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

    // Validasi akhir ketat
    if (!extractedNim || !extractedName || !extractedUniv || extractedUniv === 'Universitas Terdeteksi') {
      return NextResponse.json({
        success: false,
        message: 'KTM tidak terbaca lengkap. Pastikan foto memperlihatkan Nama Mahasiswa, NIM, dan Nama Kampus dengan jelas.',
      }, { status: 422 });
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
