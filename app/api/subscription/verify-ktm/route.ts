import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { prisma } from '@/lib/db';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

// POST /api/subscription/verify-ktm
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

    // Bersihkan prefix header data URL (seperti data:image/jpeg;base64,) secara mutlak
    const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;

    const validMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const finalMimeType = validMimeTypes.includes(mimeType) ? mimeType : 'image/jpeg';
    const extension = finalMimeType.split('/')[1];

    let extractedName = '';
    let extractedNim = '';
    let extractedUniv = 'Universitas Terdeteksi';
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
        const ocrResponse = await fetch(`${ocrBackendUrl}/api/v1/scan/ktm`, {
          method: 'POST',
          body: formData,
          headers: ocrApiKey ? { 'X-API-Key': ocrApiKey } : {},
          signal: AbortSignal.timeout(15000), // timeout 15 detik
        });

        if (ocrResponse.ok) {
          const ocrResult = await ocrResponse.json();
          const data = ocrResult?.data;
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
            console.log('[KTM] Berhasil diverifikasi lengkap via FastAPI OCR.');
          } else {
            console.warn('[KTM] FastAPI OCR berhasil namun data (NIM/Nama/Kampus) tidak lengkap 100%, beralih ke AI Vision...');
          }
        } else {
          console.warn(`[KTM] FastAPI OCR HTTP ${ocrResponse.status}, beralih ke Gemini...`);
        }
      } catch (ocrErr: any) {
        console.warn('[KTM] FastAPI OCR tidak dapat dijangkau, beralih ke Gemini...', ocrErr.message);
      }
    } else {
      console.warn('[KTM] OCR_BACKEND_URL tidak dikonfigurasi, langsung menggunakan Gemini Vision.');
    }

    // ── 3. TAHAP 2: FALLBACK KE GEMINI / OPENAI VISION (JIKA FASTAPI OCR GAGAL) ──
    if (!isOcrSuccessful) {
      console.log('[KTM] Menggunakan Gemini Vision sebagai fallback...');

      const prompt = `
Kamu adalah sistem pendeteksi Kartu Tanda Mahasiswa (KTM) Indonesia.
Tugasmu adalah membaca kartu identitas dari gambar ini.
Jika gambar ini bukan KTM atau kartu pelajar/identitas mahasiswa, ATAU jika teksnya tidak terbaca jelas, kembalikan valid = false.
Jika ini adalah KTM yang jelas, ekstrak nama mahasiswa, NIM (Nomor Induk Mahasiswa), dan nama Universitas/Kampus/Politeknik/Institut.
WAJIB: Ketiganya (name, nim, university) harus terbaca dengan jelas. Jika ada salah satu yang kosong atau tidak terbaca, kembalikan valid = false.
Kembalikan response HANYA dalam format JSON persis seperti ini, tanpa teks pengantar:
{
  "valid": true,
  "name": "Nama lengkap mahasiswa",
  "nim": "123456789",
  "university": "Nama Universitas/Institut/Politeknik"
}
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

        console.log('[KTM] Berhasil diverifikasi via Gemini Vision Fallback.');
      } catch (geminiErr: any) {
        console.warn('[KTM] Gemini Vision gagal/limit, beralih ke OpenAI Vision...', geminiErr.message);
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
          console.log('[KTM] Berhasil diverifikasi via OpenAI Vision Fallback.');
        } catch (openaiErr: any) {
          console.error('[KTM] Kedua AI Vision gagal:', openaiErr.message);
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

    // ── 4. SIMPAN KE DATABASE ─────────────────────────────────────────────────
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

    // ── 5. UPGRADE SUBSCRIPTION KE STUDENT ───────────────────────────────────
    await prisma.subscription.upsert({
      where: { userId: decoded.userId },
      update: { plan: 'STUDENT', status: 'ACTIVE', expiresAt: null },
      create: { userId: decoded.userId, plan: 'STUDENT', status: 'ACTIVE', expiresAt: null },
    });

    console.log('[KTM] ✅ Verifikasi Sukses! Data terdeteksi:', JSON.stringify({ name: extractedName, nim: extractedNim, university: extractedUniv }));

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
