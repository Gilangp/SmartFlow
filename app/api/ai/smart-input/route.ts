import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { prisma } from '@/lib/db';
import { callHuggingFace } from '@/lib/huggingface';
import { routeAICall } from '@/lib/ai/router';
import { buildSmartInputPrompt } from '@/lib/ai/prompts';


export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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
function fallbackParser(text: string, categoryNames: string[] = []) {
  // Dalam konteks Indonesia: m/M = Miliar (1.000.000.000), jt/juta = 1.000.000, t = Triliun
  const regex = /(\d+(?:[\.,]\d+)?)\s*(ribu|rb|k|juta|jt|miliar|m|triliun|t)?\b/gi;
  let match;
  let total = 0;

  // Lewati angka penunjuk hari jika ada di awal (misal "7 hari lalu")
  const textWithoutRelativeDays = text.replace(/(\d+)\s*hari\s*(?:yang\s*)?lalu/gi, '');

  while ((match = regex.exec(textWithoutRelativeDays)) !== null) {
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
      // Jika angka polos < 100 dalam konteks makanan/jajan/pengeluaran, anggap ribuan (misal 5 = 5000)
      if (num < 100) {
        total += num * 1000;
      } else {
        total += num;
      }
    }
  }

  // Deteksi tanggal relatif
  const now = new Date();
  const lower = text.toLowerCase();
  
  const daysMatch = lower.match(/(\d+)\s*hari\s*(?:yang\s*)?lalu/);
  if (daysMatch) {
    const daysAgo = parseInt(daysMatch[1], 10);
    if (!isNaN(daysAgo)) {
      now.setDate(now.getDate() - daysAgo);
    }
  } else if (lower.includes('minggu lalu')) {
    now.setDate(now.getDate() - 7);
  } else if (lower.includes('kemarin lusa') || lower.includes('2 hari lalu') || lower.includes('2 hari yang lalu')) {
    now.setDate(now.getDate() - 2);
  } else if (lower.includes('kemarin') || lower.includes('semalam') || lower.includes('tadi malam')) {
    now.setDate(now.getDate() - 1);
  }

  const dateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

  // Cari kategori paling pas dari daftar user
  let matchedCategory = categoryNames[0] || 'Lainnya';
  if (lower.includes('es teh') || lower.includes('kopi') || lower.includes('makan') || lower.includes('soto') || lower.includes('bakso') || lower.includes('warteg') || lower.includes('resto') || lower.includes('minum')) {
    const foundFoodCat = categoryNames.find(c => {
      const cLow = c.toLowerCase();
      return cLow.includes('makan') || cLow.includes('minum') || cLow.includes('kuliner') || cLow.includes('jajan');
    });
    if (foundFoodCat) matchedCategory = foundFoodCat;
  }

  return {
    totalAmount: total,
    category: matchedCategory,
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

    // 🔹 GET USER CATEGORIES
    const categories = await prisma.category.findMany({
      where: { userId: decoded.userId },
      select: { name: true, type: true },
    });

    const categoryNames = categories.map((c) => c.name);
    const categoryListFormatted = categoryNames.map((n) => `"${n}"`).join(', ');

    const nowWib = new Date();
    const todayStr = nowWib.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

    // 🔹 PROMPT (Standard Finto AI 9-Component Framework)
    const prompt = buildSmartInputPrompt({
      todayStr,
      categoryListFormatted: categoryListFormatted || '"Lainnya"',
      text,
    });

    let rawText = '';

    // ── 1. DEEPSEEK-V4-FLASH VIA AI GATEWAY (UTAMA) ──────────────────────────
    try {
      const aiRes = await routeAICall(
        [{ role: 'user', content: prompt }],
        { modelType: 'TEXT', temperature: 0.1, maxTokens: 300, timeoutMs: 15000 }
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
          const fallback = fallbackParser(text, categoryNames);
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
      parsed = fallbackParser(text, categoryNames);
    }

    const rawCat = (parsed.category || '').trim();
    
    // Validasi & Cocokkan dengan daftar kategori user
    let finalCat = categoryNames.find(
      (c) => c.toLowerCase() === rawCat.toLowerCase() ||
             c.toLowerCase().includes(rawCat.toLowerCase()) ||
             (rawCat && rawCat.toLowerCase().includes(c.toLowerCase()))
    );

    // Jika AI mengeluarkan kategori yang tidak ada di DB, cari kategori makanan/minuman jika relevan
    if (!finalCat) {
      const lowerText = text.toLowerCase();
      if (lowerText.includes('es teh') || lowerText.includes('kopi') || lowerText.includes('makan') || lowerText.includes('minum') || lowerText.includes('soto')) {
        finalCat = categoryNames.find(c => {
          const cLow = c.toLowerCase();
          return cLow.includes('makan') || cLow.includes('minum') || cLow.includes('kuliner') || cLow.includes('jajan');
        });
      }
    }

    // Terakhir: pastikan TIDAK PERNAH kosong, default ke kategori pertama user
    if (!finalCat) {
      finalCat = categoryNames[0] || 'Lainnya';
    }

    return NextResponse.json({
      success: true,
      message: 'Text processed successfully',
      data: {
        amount: parsed.totalAmount,
        category: finalCat,
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