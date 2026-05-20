import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '@/lib/db';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || '');

export async function POST(request: NextRequest) {
  try {
    const token = extractTokenFromHeader(request.headers.get('Authorization') || '');
    if (!token) {
      return NextResponse.json({ success: false, message: 'No token provided' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ success: false, message: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const { text } = body;

    if (!text) {
      return NextResponse.json({ success: false, message: 'Text input is required' }, { status: 400 });
    }

    // Get user's categories to help AI map correctly
    const categories = await prisma.category.findMany({
      where: { userId: decoded.userId },
      select: { name: true }
    });
    
    const categoryNames = categories.map(c => c.name).join(', ');

    const prompt = `
Ekstrak informasi transaksi MULTIPLE dari teks berikut dan hitung total dari semua item.
Teks pengguna: "${text}"

Tugas:
1. Identifikasi SEMUA item dan nominal yang disebutkan (misal: "esteh 3k", "bakso 10rb", "mie 2k").
2. Ekstrak setiap "amount" sebagai angka utuh (3k=3000, 10rb=10000, 2k=2000, dst).
3. Hitung TOTAL amount dari semua item yang ditemukan.
4. Tentukan "category" utama dari daftar ini jika cocok: [${categoryNames}]. Jika tidak ada yang persis, simpulkan kategori yang paling masuk akal (misal: "Makan", "Jajan").
5. "notes" adalah full teks dari input user (jangan diubah).

Format JSON WAJIB:
{
  "totalAmount": 15000,
  "category": "Makan",
  "notes": "esteh 3k, bakso 10rb, mie 2k"
}

Contoh: 
- Input: "beli jajan, esteh 3k, bakso 10rb, mie 2k"
- Output: {"totalAmount": 15000, "category": "Makan", "notes": "beli jajan, esteh 3k, bakso 10rb, mie 2k"}

HANYA kembalikan JSON, tanpa markdown, tanpa teks tambahan.
`;

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      let textResponse = response.text().trim();
      
      // Clean up markdown if AI still outputs it
      if (textResponse.startsWith('```json')) {
        textResponse = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
      } else if (textResponse.startsWith('```')) {
        textResponse = textResponse.replace(/```/g, '').trim();
      }

      const parsedData = JSON.parse(textResponse);

      return NextResponse.json({
        success: true,
        message: 'Text processed successfully',
        data: {
          amount: parsedData.totalAmount || parsedData.amount, // Support both totalAmount and amount
          category: parsedData.category,
          notes: parsedData.notes,
        }
      });
    } catch (aiError) {
      console.error('AI Processing Error:', aiError);
      return NextResponse.json({
        success: false,
        message: 'Gagal mengekstrak data dari teks (AI Error)',
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Smart Input error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to process input', error: String(error) },
      { status: 500 }
    );
  }
}
