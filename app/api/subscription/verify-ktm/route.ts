import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '@/lib/db';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// POST /api/subscription/verify-ktm
export async function POST(request: NextRequest) {
  try {
    const token = extractTokenFromHeader(request.headers.get('Authorization') || '');
    if (!token) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

    const decoded = verifyToken(token);
    if (!decoded) return NextResponse.json({ success: false, message: 'Invalid token' }, { status: 401 });

    const body = await request.json();
    const { imageBase64, mimeType } = body;

    if (!imageBase64) {
      return NextResponse.json({ success: false, message: 'Gambar KTM wajib diunggah' }, { status: 400 });
    }

    const validMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
    const finalMimeType = validMimeTypes.includes(mimeType) ? mimeType : 'image/jpeg';

    // 1. Ekstrak data KTM via AI
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
`;

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent([
      {
        inlineData: {
          data: imageBase64,
          mimeType: finalMimeType as any,
        },
      },
      prompt,
    ]);

    const responseText = result.response.text();
    const cleaned = responseText.replace(/```json/g, '').replace(/```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      } else {
        return NextResponse.json({
          success: false,
          message: 'AI gagal memproses gambar. Pastikan foto KTM jelas.',
        }, { status: 422 });
      }
    }

    if (!parsed || !parsed.valid) {
      return NextResponse.json({
        success: false,
        message: 'Gambar tidak terdeteksi sebagai KTM yang valid. Coba foto ulang.',
      }, { status: 422 });
    }

    // 2. Simpan atau Update record KTM Verification
    await prisma.ktmVerification.upsert({
      where: { userId: decoded.userId },
      update: {
        imageUrl: 'verified-by-ai', // Idealnya upload base64 ke S3/Supabase Storage, ini placeholder
        extractedName: parsed.name,
        extractedNim: parsed.nim,
        extractedUniv: parsed.university,
        status: 'APPROVED',
        verifiedAt: new Date(),
      },
      create: {
        userId: decoded.userId,
        imageUrl: 'verified-by-ai',
        extractedName: parsed.name,
        extractedNim: parsed.nim,
        extractedUniv: parsed.university,
        status: 'APPROVED',
        verifiedAt: new Date(),
      },
    });

    // 3. Ubah Subscription Plan user ke STUDENT
    await prisma.subscription.upsert({
      where: { userId: decoded.userId },
      update: {
        plan: 'STUDENT',
        status: 'ACTIVE',
        expiresAt: null, // Berlaku selamanya
      },
      create: {
        userId: decoded.userId,
        plan: 'STUDENT',
        status: 'ACTIVE',
        expiresAt: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'KTM berhasil diverifikasi',
      data: {
        name: parsed.name || 'Mahasiswa',
        nim: parsed.nim || '',
        university: parsed.university || 'Universitas',
        plan: 'STUDENT'
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
