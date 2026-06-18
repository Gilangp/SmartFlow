import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { upgradeToStudent } from '@/lib/subscription';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Tesseract from 'tesseract.js';


const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// POST /api/subscription/verify-ktm
// Body: { imageBase64: string, mimeType?: string }
// Gemini Vision baca KTM → validasi nama → upgrade ke Student
export async function POST(request: NextRequest) {
  try {
    // 🔹 AUTH
    const token = extractTokenFromHeader(request.headers.get('Authorization') || '');
    if (!token) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

    const decoded = verifyToken(token);
    if (!decoded) return NextResponse.json({ success: false, message: 'Invalid token' }, { status: 401 });

    // 🔹 Cek apakah sudah Student/Premium
    const existingSubscription = await prisma.subscription.findUnique({
      where: { userId: decoded.userId },
    });

    if (existingSubscription?.plan === 'STUDENT' || existingSubscription?.plan === 'PREMIUM') {
      return NextResponse.json({
        success: false,
        message: 'Akun kamu sudah terverifikasi sebagai mahasiswa.',
      }, { status: 400 });
    }

    // 🔹 Cek apakah sedang dalam proses verifikasi
    const existingKtm = await prisma.ktmVerification.findUnique({
      where: { userId: decoded.userId },
    });

    if (existingKtm?.status === 'PENDING') {
      return NextResponse.json({
        success: false,
        message: 'Verifikasi KTM kamu sedang diproses.',
      }, { status: 400 });
    }

    // 🔹 BODY
    const body = await request.json();
    const { imageBase64, mimeType } = body;

    if (!imageBase64) {
      return NextResponse.json({ success: false, message: 'Foto KTM wajib diupload' }, { status: 400 });
    }

    // 🔹 Ambil nama user untuk validasi
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { name: true, email: true },
    });

    if (!user) {
      return NextResponse.json({ success: false, message: 'User tidak ditemukan' }, { status: 404 });
    }

    const finalMimeType = mimeType || 'image/jpeg';

    // 🔹 GEMINI VISION — baca KTM
    const prompt = `
Kamu adalah sistem verifikasi Kartu Tanda Mahasiswa (KTM) Indonesia.

Ekstrak informasi dari gambar KTM ini dan kembalikan dalam format JSON PERSIS seperti di bawah.
Jangan tambahkan teks lain.

Format:
{
  "isKtm": true/false,
  "name": "nama lengkap di KTM",
  "nim": "nomor induk mahasiswa",
  "university": "nama universitas/kampus",
  "faculty": "fakultas (jika ada)",
  "major": "program studi/jurusan (jika ada)",
  "year": "tahun angkatan atau masa berlaku (jika ada)",
  "confidence": "HIGH/MEDIUM/LOW"
}

Rules:
- isKtm: true HANYA jika ini adalah KTM/kartu mahasiswa yang valid
- Jika bukan KTM (foto selfie, KTP, SIM, dll), set isKtm: false dan sisanya null
- Nama harus persis seperti tertulis di KTM
- confidence: HIGH jika semua info jelas terbaca
`;

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent([
      {
        inlineData: {
          data: imageBase64,
          mimeType: finalMimeType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/heic',
        },
      },
      prompt,
    ]);

    const responseText = result.response.text();
    const cleaned = responseText.replace(/```json/g, '').replace(/```/g, '').trim();

    let ktmData;
    try {
      ktmData = JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) {
        try { ktmData = JSON.parse(match[0]); } catch { ktmData = null; }
      }
    }

    // 🔹 Validasi: apakah ini KTM?
    if (!ktmData || !ktmData.isKtm) {
      // Simpan record REJECTED
      await prisma.ktmVerification.upsert({
        where: { userId: decoded.userId },
        update: {
          imageUrl: `data:${finalMimeType};base64,${imageBase64.substring(0, 100)}...`,
          status: 'REJECTED',
          rejectedReason: 'Gambar yang diupload bukan KTM yang valid.',
          updatedAt: new Date(),
        },
        create: {
          userId: decoded.userId,
          imageUrl: `data:${finalMimeType};base64,${imageBase64.substring(0, 100)}...`,
          status: 'REJECTED',
          rejectedReason: 'Gambar yang diupload bukan KTM yang valid.',
        },
      });

      return NextResponse.json({
        success: false,
        message: 'Gambar yang diupload bukan KTM. Pastikan foto menampilkan kartu mahasiswa yang jelas.',
      }, { status: 422 });
    }

    // 🔹 Validasi: nama di KTM harus mirip nama user (case-insensitive, toleransi partial match)
    const ktmName = (ktmData.name || '').toLowerCase().trim();
    const userName = user.name.toLowerCase().trim();

    // Cek minimal 50% kata dari nama user ada di KTM atau sebaliknya
    const userWords = userName.split(' ').filter(w => w.length > 1);
    const matchCount = userWords.filter(word => ktmName.includes(word)).length;
    const nameMatch = matchCount / userWords.length >= 0.5;

    if (!nameMatch && ktmData.confidence === 'HIGH') {
      await prisma.ktmVerification.upsert({
        where: { userId: decoded.userId },
        update: {
          imageUrl: `data:${finalMimeType};base64,${imageBase64.substring(0, 100)}...`,
          extractedName: ktmData.name,
          extractedNim: ktmData.nim,
          extractedUniv: ktmData.university,
          status: 'REJECTED',
          rejectedReason: `Nama di KTM (${ktmData.name}) tidak cocok dengan nama akun (${user.name}).`,
          updatedAt: new Date(),
        },
        create: {
          userId: decoded.userId,
          imageUrl: `data:${finalMimeType};base64,${imageBase64.substring(0, 100)}...`,
          extractedName: ktmData.name,
          extractedNim: ktmData.nim,
          extractedUniv: ktmData.university,
          status: 'REJECTED',
          rejectedReason: `Nama di KTM (${ktmData.name}) tidak cocok dengan nama akun (${user.name}).`,
        },
      });

      return NextResponse.json({
        success: false,
        message: `Nama di KTM (${ktmData.name}) tidak sesuai dengan nama akun (${user.name}). Pastikan nama akun sama dengan di KTM.`,
        data: { extractedName: ktmData.name },
      }, { status: 422 });
    }

    // 🔹 KTM VALID — simpan & upgrade ke Student
    await prisma.ktmVerification.upsert({
      where: { userId: decoded.userId },
      update: {
        imageUrl: `data:${finalMimeType};base64,${imageBase64.substring(0, 100)}...`,
        extractedName: ktmData.name,
        extractedNim: ktmData.nim,
        extractedUniv: ktmData.university,
        extractedYear: ktmData.year,
        status: 'APPROVED',
        verifiedAt: new Date(),
        rejectedReason: null,
        updatedAt: new Date(),
      },
      create: {
        userId: decoded.userId,
        imageUrl: `data:${finalMimeType};base64,${imageBase64.substring(0, 100)}...`,
        extractedName: ktmData.name,
        extractedNim: ktmData.nim,
        extractedUniv: ktmData.university,
        extractedYear: ktmData.year,
        status: 'APPROVED',
        verifiedAt: new Date(),
      },
    });

    // 🔥 Upgrade subscription ke Student
    await upgradeToStudent(decoded.userId);

    return NextResponse.json({
      success: true,
      message: `Selamat! KTM berhasil diverifikasi. Kamu sekarang mendapat akses Student Plan gratis selamanya! 🎓`,
      data: {
        name: ktmData.name,
        university: ktmData.university,
        nim: ktmData.nim,
        plan: 'STUDENT',
      },
    });
  } catch (error: any) {
    console.error('KTM Verification error (Gemini):', error);

    // ==========================================
    // FALLBACK: LOKAL OCR (TESSERACT.JS)
    // ==========================================
    try {
      const token = extractTokenFromHeader(request.headers.get('Authorization') || '');
      const decoded = verifyToken(token!);
      if (!decoded) throw new Error('Token expired during fallback');

      const body = await request.clone().json().catch(() => ({}));
      const { imageBase64, mimeType } = body;
      const finalMimeType = mimeType || 'image/jpeg';
      const dataURI = imageBase64.startsWith('data:') ? imageBase64 : `data:${finalMimeType};base64,${imageBase64}`;

      const { data: { text } } = await Tesseract.recognize(dataURI, 'ind+eng');
      const lowerText = text.toLowerCase();

      // Cek apakah ada kata "universitas" / "institut" / "sekolah tinggi" / "mahasiswa"
      const isKtm = lowerText.includes('mahasiswa') || lowerText.includes('universitas') || lowerText.includes('institut');
      
      if (!isKtm) {
         return NextResponse.json({
           success: false,
           message: 'Gambar bukan KTM (OCR Lokal). Pastikan foto menampilkan kartu mahasiswa dengan teks jelas.',
         }, { status: 422 });
      }

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { name: true },
      });
      if (!user) throw new Error('User not found');

      // Validasi fuzzy name match dari OCR lokal
      const userName = user.name.toLowerCase().trim();
      const userWords = userName.split(' ').filter(w => w.length > 2);
      const matchCount = userWords.filter(word => lowerText.includes(word)).length;
      const nameMatch = userWords.length > 0 && (matchCount / userWords.length >= 0.5);

      if (!nameMatch) {
         return NextResponse.json({
           success: false,
           message: 'Nama di KTM tidak cocok dengan nama akun (OCR Lokal).',
           data: { extractedName: 'Tidak cocok' },
         }, { status: 422 });
      }

      // Jika cocok, update dan upgrade
      await prisma.ktmVerification.upsert({
        where: { userId: decoded.userId },
        update: {
          imageUrl: `data:${finalMimeType};base64,${imageBase64.substring(0, 100)}...`,
          extractedName: user.name, // Anggap nama sama dengan akun
          extractedNim: 'OCR_LOCAL_FALLBACK',
          extractedUniv: 'Unknown (OCR Local)',
          status: 'APPROVED',
          verifiedAt: new Date(),
          updatedAt: new Date(),
        },
        create: {
          userId: decoded.userId,
          imageUrl: `data:${finalMimeType};base64,${imageBase64.substring(0, 100)}...`,
          extractedName: user.name,
          extractedNim: 'OCR_LOCAL_FALLBACK',
          extractedUniv: 'Unknown (OCR Local)',
          status: 'APPROVED',
          verifiedAt: new Date(),
        },
      });

      await upgradeToStudent(decoded.userId);

      return NextResponse.json({
        success: true,
        message: 'KTM berhasil diverifikasi (OCR Lokal Fallback). Akses Student Plan aktif!',
        data: { name: user.name, plan: 'STUDENT' },
      });

    } catch (fallbackError) {
      console.error('KTM Fallback error:', fallbackError);
      return NextResponse.json({
        success: false,
        message: 'Gagal memproses verifikasi. Layanan AI dan OCR cadangan sedang sibuk.',
      }, { status: 500 });
    }
  }
}


// GET /api/subscription/verify-ktm — cek status verifikasi KTM user
export async function GET(request: NextRequest) {
  try {
    const token = extractTokenFromHeader(request.headers.get('Authorization') || '');
    if (!token) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

    const decoded = verifyToken(token);
    if (!decoded) return NextResponse.json({ success: false, message: 'Invalid token' }, { status: 401 });

    const ktm = await prisma.ktmVerification.findUnique({
      where: { userId: decoded.userId },
      select: {
        status: true,
        extractedName: true,
        extractedUniv: true,
        extractedNim: true,
        verifiedAt: true,
        rejectedReason: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: ktm || null,
    });
  } catch (error) {
    console.error('KTM GET error:', error);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}
