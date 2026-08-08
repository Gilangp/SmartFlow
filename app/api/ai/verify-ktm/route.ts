import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { generateKtmToken } from '@/lib/auth';
import { callHuggingFace, extractJsonFromHfOutput } from '@/lib/huggingface';
import { routeAICall } from '@/lib/ai/router';
import { buildVerifyKtmPrompt, buildVerifyKtmVisionPrompt } from '@/lib/ai/prompts';


const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

// POST /api/ai/verify-ktm
// Strategi Hybrid Bertingkat:
//   1. Gambar → FastAPI OCR (gratis, cepat) → dapat raw text
//   2. Jika regex lokal gagal tapi ada raw text → Gemini Text → Hugging Face Text → OpenAI Text
//   3. Jika tidak ada raw text sama sekali → Vision Fallback (Gemini Vision → OpenAI Vision)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageBase64, mimeType } = body;

    if (!imageBase64) {
      return NextResponse.json({ success: false, message: 'Image is required' }, { status: 400 });
    }

    // Bersihkan prefix header data URL secara mutlak
    const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;

    const validMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
    const finalMimeType = validMimeTypes.includes(mimeType) ? mimeType : 'image/jpeg';
    const extension = finalMimeType === 'image/heic' ? 'jpg' : finalMimeType.split('/')[1];

    let extractedName = '';
    let extractedNim = '';
    let extractedUniv = 'Universitas Terdeteksi';
    let rawText = '';
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
          rawText = data?.raw_text || '';
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
            console.log('[KTM] ✅ Berhasil diekstrak lengkap via FastAPI OCR lokal tanpa AI eksternal.');
          } else if (rawText.trim().length > 20) {
            console.log('[KTM] Raw text diekstrak via FastAPI OCR tapi regex gagal, lanjut ke AI Text Mode...');
          }
        }
      } catch (ocrErr: any) {
        console.warn('[KTM] FastAPI OCR gagal:', ocrErr.message);
      }
    }

    // ── TAHAP 2: AI TEXT PARSING (jika OCR dapat raw text tapi regex gagal) ──
    // Hemat: kirim teks biasa, bukan gambar
    if (!isOcrSuccessful && rawText.trim().length > 20) {
      const textPrompt = buildVerifyKtmPrompt({ rawText });

      // ── 2a. AI GATEWAY (UTAMA) ─────────────────────────────────────────────
      try {
        console.log('[KTM] Memproses raw text via AI Gateway...');
        const aiRes = await routeAICall(
          [{ role: 'user', content: textPrompt }],
          { modelType: 'TEXT', temperature: 0.1 }
        );

        if (aiRes.success && aiRes.content) {
          const cleaned = aiRes.content.replace(/```json/g, '').replace(/```/g, '').trim();
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
            console.log(`[KTM] ✅ Berhasil via ${aiRes.modelUsed} (${aiRes.tokenUsed}).`);
          } else {
            throw new Error('AI Gateway tidak menghasilkan data KTM yang valid');
          }
        } else {
          throw new Error(aiRes.error || 'AI Gateway text call failed');
        }
      } catch (gatewayTextErr: any) {
        console.warn('[KTM] AI Gateway Text Mode gagal, beralih ke Gemini 2.0 Flash...', gatewayTextErr.message);

        // ── 2b. GEMINI TEXT (FALLBACK) ─────────────────────────────────────────
        try {
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
            console.log('[KTM] ✅ Berhasil via Gemini Text Mode.');
          }
        } catch (geminiTextErr: any) {
          console.warn('[KTM] Gemini Text Mode gagal:', geminiTextErr.message);
        }
      }

      // ── 2c. OPENAI TEXT (jika HF juga gagal) ───────────────────────────────
      if (!isOcrSuccessful && process.env.OPENAI_API_KEY) {
        try {
          console.log('[KTM] Memproses raw text dengan OpenAI gpt-4o-mini (Text Mode)...');
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
            console.log('[KTM] ✅ Berhasil via OpenAI Text Mode.');
          }
        } catch (openaiTextErr: any) {
          console.warn('[KTM] OpenAI Text Mode gagal:', openaiTextErr.message);
        }
      }
    }

    // ── TAHAP 3: Vision Fallback (jika tidak ada raw text sama sekali) ────────
    if (!isOcrSuccessful) {
      console.log('[KTM] Tidak ada raw text yang memadai, beralih ke Vision Fallback...');
      const visionPrompt = buildVerifyKtmVisionPrompt();

      let parsed: any = null;

      // ── 3a. GEMINI VISION ──────────────────────────────────────────────────
      try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const result = await model.generateContent([
          { inlineData: { data: cleanBase64, mimeType: finalMimeType as any } },
          visionPrompt,
        ]);
        const responseText = result.response.text();
        const cleaned = responseText.replace(/```json/g, '').replace(/```/g, '').trim();

        try { parsed = JSON.parse(cleaned); } catch {
          const match = cleaned.match(/\{[\s\S]*\}/);
          if (match) parsed = JSON.parse(match[0]);
        }
        console.log('[KTM] ✅ Diproses via Gemini Vision Fallback.');
      } catch (geminiErr: any) {
        console.warn('[KTM] Gemini Vision gagal, beralih ke OpenAI Vision...', geminiErr.message);

        // ── 3b. OPENAI VISION ──────────────────────────────────────────────
        try {
          const openaiResponse = await openai.chat.completions.create({
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
          const rawOpenAI = openaiResponse.choices[0]?.message?.content || '{}';
          parsed = JSON.parse(rawOpenAI);
          console.log('[KTM] ✅ Diproses via OpenAI Vision Fallback.');
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

    // ── Validasi akhir ─────────────────────────────────────────────────────────
    if (!extractedNim || !extractedName || !extractedUniv || extractedUniv === 'Universitas Terdeteksi') {
      return NextResponse.json({
        success: false,
        message: 'KTM tidak terbaca lengkap. Pastikan foto memperlihatkan Nama Mahasiswa, NIM, dan Nama Kampus dengan jelas.',
      }, { status: 422 });
    }

    const ktmToken = generateKtmToken(extractedNim, extractedName);

    console.log('[KTM] ✅ Verifikasi Sukses! Data terdeteksi:', JSON.stringify({ name: extractedName, nim: extractedNim, university: extractedUniv }));

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
  if (t.includes('polinema') || (t.includes('politeknik') && (t.includes('malang') || t.includes('negeri'))) || t.includes('negerimalang')) return 'Politeknik Negeri Malang';
  const match = text.match(/(universitas|institut|politeknik|sekolah tinggi)\s+[a-zA-Z\s]{3,}/i);
  return match ? match[0].trim() : 'Universitas Terdeteksi';
}
