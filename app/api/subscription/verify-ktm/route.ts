import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '@/lib/db';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

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
        const buffer = Buffer.from(imageBase64, 'base64');
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

          // Cek apakah field penting berhasil diekstrak
          if (ocrResult.success && data?.nim && data?.name) {
            extractedName = data.name;
            extractedNim = data.nim;
            extractedUniv = detectUniversity(data.raw_text || '');
            isOcrSuccessful = true;
            console.log('[KTM] Berhasil diverifikasi via FastAPI OCR.');
          } else {
            console.warn('[KTM] FastAPI OCR berhasil merespon namun data KTM tidak lengkap, beralih ke Gemini...');
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

    // ── 3. TAHAP 2: FALLBACK KE GEMINI VISION (JIKA FASTAPI OCR GAGAL) ──────
    if (!isOcrSuccessful) {
      console.log('[KTM] Menggunakan Gemini Vision sebagai fallback...');

      const prompt = `
Kamu adalah sistem pendeteksi Kartu Tanda Mahasiswa (KTM) Indonesia.
Tugasmu adalah membaca kartu identitas dari gambar ini.
Jika gambar ini bukan KTM atau kartu pelajar/identitas mahasiswa, kembalikan valid = false.
Jika ini adalah KTM, ekstrak nama mahasiswa, NIM (Nomor Induk Mahasiswa), dan nama Universitas/Kampus.
Kembalikan response HANYA dalam format JSON persis seperti ini, tanpa teks pengantar:
{
  "valid": true,
  "name": "Nama lengkap mahasiswa",
  "nim": "123456789",
  "university": "Nama Universitas/Institut/Politeknik"
}
      `.trim();

      try {
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
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

        if (!parsed || !parsed.valid) {
          return NextResponse.json({
            success: false,
            message: 'Gambar tidak terdeteksi sebagai KTM yang valid. Coba foto ulang dengan pencahayaan yang lebih baik.',
          }, { status: 422 });
        }

        extractedName = parsed.name || '';
        extractedNim = parsed.nim || '';
        extractedUniv = parsed.university || 'Universitas Terdeteksi';
        console.log('[KTM] Berhasil diverifikasi via Gemini Vision Fallback.');
      } catch (geminiErr: any) {
        console.error('[KTM] Gemini Vision juga gagal:', geminiErr.message);
        return NextResponse.json({
          success: false,
          message: 'Sistem AI tidak dapat memproses gambar saat ini. Coba lagi nanti.',
        }, { status: 503 });
      }
    }

    // Validasi akhir
    if (!extractedNim && !extractedName) {
      return NextResponse.json({
        success: false,
        message: 'KTM tidak terbaca jelas. Pastikan seluruh kartu terlihat dan foto tidak buram.',
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

  const match = text.match(/(universitas|institut|politeknik|sekolah tinggi)\s+[a-zA-Z\s]{3,}/i);
  return match ? match[0].trim() : 'Universitas Terdeteksi';
}
