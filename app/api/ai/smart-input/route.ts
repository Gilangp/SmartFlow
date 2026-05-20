import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '@/lib/db';

const genAI = new GoogleGenerativeAI(
  process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || ''
);

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

// 🔹 Helper: Fallback parsing (regex sederhana)
function fallbackParser(text: string) {
  const matches = text.match(/(\d+)\s?(rb|k)?/gi) || [];

  let total = 0;

  matches.forEach((m) => {
    const num = parseInt(m.replace(/[^\d]/g, ''));
    if (m.toLowerCase().includes('rb') || m.toLowerCase().includes('k')) {
      total += num * 1000;
    } else {
      total += num;
    }
  });

  return {
    totalAmount: total,
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
- Output HARUS JSON valid
- Jangan gunakan markdown
- Jangan tambahkan penjelasan

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
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
      });

      const result = await model.generateContent(prompt);
      const response = await result.response;
      let rawText = response.text();

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