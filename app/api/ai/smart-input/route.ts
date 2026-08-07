import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { prisma } from '@/lib/db';
import { callHuggingFace } from '@/lib/huggingface';
import { routeAICall } from '@/lib/ai/router';


const genAI = new GoogleGenerativeAI(
  process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || ''
);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

type AIResponse = {
  totalAmount: number;
  category: string;
  date?: string;
  notes: string;
};

// 🔹 Helper: Clean AI response
function cleanAIResponse(text: string): string {
  return text
    .replace(/```json/g, '')
    .replace(/```/g, '')
    .trim();
}

// 🔹 Helper: Safe JSON parse
function safeParseJSON(text: string): AIResponse | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// 🔹 Helper: Fallback parsing (regex lebih akurat untuk satuan Indonesia)
function fallbackParser(text: string) {
  // Dalam konteks Indonesia: m/M = Miliar (1.000.000.000), jt/juta = 1.000.000, t = Triliun
  const regex = /(\d+(?:[\.,]\d+)?)\s*(ribu|rb|k|juta|jt|miliar|m|triliun|t)?\b/gi;
  let match;
  let total = 0;

  while ((match = regex.exec(text)) !== null) {
    let rawNum = match[1].replace(',', '.');
    if (rawNum.includes('.') && rawNum.split('.')[1].length === 3 && !match[2]) {
      rawNum = rawNum.replace('.', '');
    }

    const num = parseFloat(rawNum);
    if (isNaN(num)) continue;

    const unit = (match[2] || '').toLowerCase();
    if (unit === 'ribu' || unit === 'rb' || unit === 'k') {
      total += num * 1000;
    } else if (unit === 'juta' || unit === 'jt') {
      total += num * 1000000;
    } else if (unit === 'miliar' || unit === 'm') {
      total += num * 1000000000;
    } else if (unit === 'triliun' || unit === 't') {
      total += num * 1000000000000;
    } else {
      total += num;
    }
  }

  // Deteksi tanggal relatif sederhana untuk fallback
  const now = new Date();
  const lower = text.toLowerCase();
  if (lower.includes('2 hari') || lower.includes('lusa kemarin')) {
    now.setDate(now.getDate() - 2);
  } else if (lower.includes('3 hari')) {
    now.setDate(now.getDate() - 3);
  } else if (lower.includes('kemarin') || lower.includes('semalam') || lower.includes('tadi malam')) {
    now.setDate(now.getDate() - 1);
  }
  const dateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

  return {
    totalAmount: total,
    category: 'Lainnya',
    date: dateStr,
    notes: text,
  };
}

export async function POST(request: NextRequest) {
  try {
    // 🔹 AUTH
    const token = extractTokenFromHeader(
      request.headers.get('Authorization') || ''
    );

    if (!token) {
      return NextResponse.json(
        { success: false, message: 'No token provided' },
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

    // 🔹 BODY
    const body = await request.json();
    const { text } = body;

    if (!text) {
      return NextResponse.json(
        { success: false, message: 'Text input is required' },
        { status: 400 }
      );
    }

    // 🔹 GET USER CATEGORIES (dengan tipe NEED vs WANT)
    const categories = await prisma.category.findMany({
      where: { userId: decoded.userId },
      select: { name: true, type: true },
    });

    const categoryListFormatted = categories
      .map((c) => `${c.name} (${c.type === 'NEED' ? 'NEED - Kebutuhan pokok/wajib/esensial' : 'WANT - Keinginan/gaya hidup/jajan/konsumtif'})`)
      .join(', ');

    const nowWib = new Date();
    const todayStr = nowWib.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

    // 🔹 PROMPT (lebih ketat & akurat untuk klasifikasi NEED vs WANT & deteksi tanggal)
    const prompt = `
Kamu adalah parser data keuangan Indonesia yang sangat pintar dan akurat.

Tugas:
Ekstrak semua nominal dari teks, hitung total pengeluaran, tentukan kategori yang paling pas, hitung tanggal transaksi yang dimaksud, dan rapihkan catatan (notes).

Rules:
- Hari ini adalah tanggal ${todayStr} (format YYYY-MM-DD, waktu WIB).
- Deteksi tanggal dari teks input pada kolom "date" (dalam format YYYY-MM-DD):
  • Jika user menyebut waktu relatif seperti "kemarin"/"semalam" (berarti hari sebelum hari ini), "2 hari kemarin"/"2 hari lalu" (berarti 2 hari sebelum hari ini), "3 hari lalu", dsb., hitung tanggalnya dengan tepat dari hari ini (${todayStr}).
  • Jika user menyebut tanggal spesifik (misal: "tgl 5", "5 Juli", "5/7"), konversi ke YYYY-MM-DD pada tahun yang sesuai.
  • Jika tidak ada keterangan waktu/tanggal di teks, gunakan tanggal hari ini: "${todayStr}".
- 3k = 3000
- 10rb = 10000
- 20 ribu = 20000
- 1.5jt = 1500000
- 2M / 2 miliar = 2000000000
- Dalam Indonesia: 'k'/'rb'/'ribu' = 1.000, 'jt'/'juta' = 1.000.000, 'm'/'M'/'miliar' = 1.000.000.000 (Miliar), 't' = Triliun.
- PENTING UNTUK KATEGORI: Perhatikan tipe (NEED vs WANT) pada daftar kategori di bawah. Jangan masukkan belanja konsumtif/lifestyle/jajan (kopi kafe, boba, game, belanja online, nongkrong) ke kategori NEED! Belanja konsumtif HARUS masuk ke kategori bertipe WANT. Sebaliknya, pengeluaran wajib/pokok (makan utama sehari-hari, transportasi/bensin, tagihan, listrik, kesehatan/obat, pendidikan) masukkan ke kategori bertipe NEED.
- Pada kolom "category" di JSON output, TULIS NAMA KATEGORI-NYA SAJA (tanpa tambahan keterangan NEED/WANT di dalam kurung, contoh: jika di daftar ada "Makanan & Dapur (NEED...)", maka tulis "Makanan & Dapur" saja). Jika tidak ada yang cocok, tulis "Lainnya".
- Output HARUS JSON valid
- Jangan gunakan markdown
- Jangan tambahkan penjelasan
- Gabungkan nama barang/kegiatan ke dalam 'notes' dengan rapi dan jelas. Jika ada lebih dari satu kegiatan/barang, pisahkan dengan koma dan spasi (, ) (contoh: "makan siang, isi bensin, beli pulsa"). Jangan masukkan kata waktu seperti "kemarin" atau "2 hari lalu" ke dalam notes jika sudah diproses ke kolom date.

Daftar Kategori User yang Tersedia:
[${categoryListFormatted || 'Lainnya'}]

Format JSON:
{
  "totalAmount": number,
  "category": string,
  "date": "YYYY-MM-DD",
  "notes": string
}

Input:
"${text}"
`;

    let rawText = '';

    // ── 1. DEEPSEEK-V4-FLASH VIA AI GATEWAY (UTAMA) ──────────────────────────
    try {
      const aiRes = await routeAICall(
        [{ role: 'user', content: prompt }],
        { modelType: 'TEXT', temperature: 0.1 }
      );
      if (aiRes.success && aiRes.content) {
        rawText = aiRes.content;
        console.log(`[SMART INPUT] ✅ Berhasil via ${aiRes.modelUsed} (${aiRes.tokenUsed}).`);
      } else {
        throw new Error(aiRes.error || 'AI Gateway returned empty response');
      }
    } catch (gatewayErr: any) {
      console.warn('[SMART INPUT] AI Gateway gagal, beralih ke Gemini 2.0 Flash...', gatewayErr.message);

      // ── 2. GEMINI 2.0 FLASH (FALLBACK) ──────────────────────────────────────
      try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        rawText = response.text();
        console.log('[SMART INPUT] ✅ Berhasil via Gemini 2.0 Flash.');
      } catch (geminiError: any) {
        console.warn('[SMART INPUT] Gemini gagal, beralih ke OpenAI...', geminiError.message);

        // ── 3. OPENAI GPT-4O-MINI (FALLBACK BERBAYAR) ─────────────────────────
        try {
          const openaiResponse = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
          });
          rawText = openaiResponse.choices[0]?.message?.content || '';
          console.log('[SMART INPUT] ✅ Berhasil via OpenAI gpt-4o-mini.');
        } catch (openaiError: any) {
          console.warn('[SMART INPUT] OpenAI juga gagal. Menggunakan regex fallback.', openaiError.message);
          // ── 4. REGEX LOKAL (SAFETY NET) ────────────────────────────────────
          const fallback = fallbackParser(text);
          return NextResponse.json({
            success: true,
            message: 'Fallback regex mode used',
            data: {
              amount: fallback.totalAmount,
              category: fallback.category,
              date: fallback.date,
              notes: fallback.notes,
            },
          });
        }
      }
    }

    // ── PARSE & RETURN HASIL AI ───────────────────────────────────────────────
    const cleaned = cleanAIResponse(rawText);
    let parsed = safeParseJSON(cleaned);

    // 🔥 FALLBACK kalau semua AI berhasil dipanggil tapi JSON tidak valid
    if (!parsed || !parsed.totalAmount) {
      parsed = fallbackParser(text);
    }

    const rawCat = parsed.category || 'Lainnya';
    const cleanCat = rawCat.replace(/\s*\((NEED|WANT).*?\)/i, '').trim();

    return NextResponse.json({
      success: true,
      message: 'Text processed successfully',
      data: {
        amount: parsed.totalAmount,
        category: cleanCat || 'Lainnya',
        date: parsed.date || todayStr,
        notes: parsed.notes || text,
      },
    });
  } catch (error) {
    console.error('Smart Input error:', error);

    return NextResponse.json(
      {
        success: false,
        message: 'Failed to process input',
        error: String(error),
      },
      { status: 500 }
    );
  }
}