import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { prisma } from '@/lib/db';

const genAI = new GoogleGenerativeAI(
  process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || ''
);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

type AIResponse = {
  totalAmount: number;
  category: string;
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

  return {
    totalAmount: Math.round(total),
    category: 'Lainnya',
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
      select: { name: true },
    });

    const categoryNames = categories.map((c) => c.name).join(', ');

    // 🔹 PROMPT (lebih ketat)
    const prompt = `
Kamu adalah parser data keuangan.

Tugas:
Ekstrak semua nominal dari teks dan hitung total.

Rules:
- 3k = 3000
- 10rb = 10000
- 20 ribu = 20000
- 1.5jt = 1500000
- 2M / 2 miliar = 2000000000
- Dalam Indonesia: 'k'/'rb'/'ribu' = 1.000, 'jt'/'juta' = 1.000.000, 'm'/'M'/'miliar' = 1.000.000.000 (Miliar), 't' = Triliun.
- Output HARUS JSON valid
- Jangan gunakan markdown
- Jangan tambahkan penjelasan
- Gabungkan nama barang/kegiatan ke dalam 'notes' dengan rapi. Jika ada lebih dari satu kegiatan, pisahkan dengan koma dan spasi (, ) (contoh: "makan, isi bensin").

Kategori yang tersedia:
[${categoryNames}]

Format:
{
  "totalAmount": number,
  "category": string,
  "notes": string
}

Input:
"${text}"
`;

    try {
      let rawText = '';
      try {
        const model = genAI.getGenerativeModel({
          model: 'gemini-1.5-flash',
        });

        const result = await model.generateContent(prompt);
        const response = await result.response;
        rawText = response.text();
      } catch (geminiError: any) {
        console.warn('Gemini error on smart input, falling back to OpenAI...', geminiError.message);
        try {
          const openaiResponse = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
          });
          rawText = openaiResponse.choices[0]?.message?.content || '';
        } catch (openaiError: any) {
          throw new Error('Both AI providers failed');
        }
      }

      const cleaned = cleanAIResponse(rawText);
      let parsed = safeParseJSON(cleaned);

      // 🔥 FALLBACK kalau AI gagal
      if (!parsed || !parsed.totalAmount) {
        parsed = fallbackParser(text);
      }

      return NextResponse.json({
        success: true,
        message: 'Text processed successfully',
        data: {
          amount: parsed.totalAmount,
          category: parsed.category || 'Lainnya',
          notes: parsed.notes || text,
        },
      });
    } catch (aiError) {
      console.error('AI Processing Error:', aiError);

      // 🔥 FULL FALLBACK (no AI)
      const fallback = fallbackParser(text);

      return NextResponse.json({
        success: true,
        message: 'Fallback mode used',
        data: {
          amount: fallback.totalAmount,
          category: fallback.category,
          notes: fallback.notes,
        },
      });
    }
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