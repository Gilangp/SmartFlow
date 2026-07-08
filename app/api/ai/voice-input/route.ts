import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { callHuggingFaceAudio } from '@/lib/huggingface';

/**
 * POST /api/ai/voice-input
 *
 * Terima audio blob dari browser (FormData: field "audio"),
 * transkripsi via Hugging Face Whisper, dan kembalikan teks.
 *
 * Body: multipart/form-data
 *   - audio : Blob  (WebM / OGG / WAV)
 *   - mimeType : string (opsional, default audio/webm)
 */
export async function POST(request: NextRequest) {
  try {
    // ── AUTH ─────────────────────────────────────────────────────────────────
    const token = extractTokenFromHeader(
      request.headers.get('Authorization') || ''
    );
    if (!token) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        { success: false, message: 'Invalid token' },
        { status: 401 }
      );
    }

    // ── BACA FORM DATA ────────────────────────────────────────────────────────
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { success: false, message: 'Gagal membaca form data audio.' },
        { status: 400 }
      );
    }

    const audioBlob = formData.get('audio') as Blob | null;
    const clientMimeType = (formData.get('mimeType') as string | null) || 'audio/webm';

    if (!audioBlob || audioBlob.size === 0) {
      return NextResponse.json(
        { success: false, message: 'File audio tidak ditemukan atau kosong.' },
        { status: 400 }
      );
    }

    // Validasi ukuran — HF Inference API maks ~25 MB untuk Whisper
    const MAX_BYTES = 25 * 1024 * 1024;
    if (audioBlob.size > MAX_BYTES) {
      return NextResponse.json(
        { success: false, message: 'File audio terlalu besar (maks 25 MB).' },
        { status: 413 }
      );
    }

    // ── KONVERSI BLOB → BUFFER ────────────────────────────────────────────────
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);

    // Tentukan MIME type yang valid untuk HF Whisper
    const validMimes: Record<string, string> = {
      'audio/webm': 'audio/webm',
      'audio/ogg': 'audio/ogg',
      'audio/wav': 'audio/wav',
      'audio/mp4': 'audio/mp4',
      'audio/mpeg': 'audio/mpeg',
      'audio/flac': 'audio/flac',
    };
    const finalMimeType = validMimes[clientMimeType] || 'audio/webm';

    console.log(
      `[VOICE INPUT] Menerima audio: ${audioBlob.size} bytes, MIME: ${finalMimeType}`
    );

    // ── TRANSKRIPSI VIA HF WHISPER ────────────────────────────────────────────
    const transcription = await callHuggingFaceAudio(audioBuffer, finalMimeType);

    console.log(`[VOICE INPUT] ✅ Transkripsi: "${transcription.slice(0, 100)}"`);

    return NextResponse.json({
      success: true,
      text: transcription,
    });
  } catch (error: any) {
    console.error('[VOICE INPUT] Error:', error.message);

    // Kembalikan pesan yang lebih ramah
    const isHfDown = error.message?.includes('loading') || error.message?.includes('503');
    return NextResponse.json(
      {
        success: false,
        message: isHfDown
          ? 'Model AI sedang loading. Coba lagi dalam beberapa detik.'
          : 'Gagal memproses audio. Coba rekam ulang.',
        error: String(error.message),
      },
      { status: 500 }
    );
  }
}
