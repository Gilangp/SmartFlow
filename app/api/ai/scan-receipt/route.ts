import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getUserSubscription } from '@/lib/subscription';
import Tesseract from 'tesseract.js';


const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// POST /api/ai/scan-receipt
// Body: { imageBase64: string, mimeType: string }
// Gemini Vision membaca struk/kwitansi dan mengekstrak data transaksi
export async function POST(request: NextRequest) {
  try {
    // 🔹 AUTH
    const token = extractTokenFromHeader(request.headers.get('Authorization') || '');
    if (!token) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

    const decoded = verifyToken(token);
    if (!decoded) return NextResponse.json({ success: false, message: 'Invalid token' }, { status: 401 });

    // 🔹 CHECK SUBSCRIPTION LIMIT
    const sub = await getUserSubscription(decoded.userId);
    if (!sub.limits.canScanReceipt) {
      return NextResponse.json({
        success: false,
        message: 'Fitur Scan Struk hanya tersedia untuk paket Student dan Premium.',
      }, { status: 403 });
    }

    // 🔹 BODY
    const body = await request.json();
    const { imageBase64, mimeType } = body;

    if (!imageBase64) {
      return NextResponse.json({ success: false, message: 'Image is required' }, { status: 400 });
    }

    const validMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
    const finalMimeType = validMimeTypes.includes(mimeType) ? mimeType : 'image/jpeg';

    // 🔹 GEMINI VISION PROMPT
    const prompt = `
Kamu adalah OCR cerdas untuk struk/kwitansi Indonesia.

Ekstrak informasi dari gambar struk/kwitansi ini dan kembalikan dalam format JSON PERSIS seperti di bawah ini.
Jangan tambahkan teks lain, hanya JSON.

Format response:
{
  "merchant": "nama toko/restoran/tempat",
  "totalAmount": 0,
  "date": "YYYY-MM-DD atau null jika tidak ada",
  "items": [
    { "name": "nama item", "price": 0, "qty": 1 }
  ],
  "category": "pilih SATU dari: Makan & Minum, Transportasi, Belanja, Hiburan, Kesehatan, Pendidikan, Tagihan, Lainnya",
  "confidence": "HIGH/MEDIUM/LOW"
}

Rules:
- totalAmount adalah total akhir yang dibayar (setelah diskon/pajak)
- Jika ada tulisan "TOTAL", "GRAND TOTAL", "JUMLAH", gunakan nilai itu
- Semua harga dalam Rupiah (integer, tanpa titik/koma)
- Jika ada item tidak jelas, tetap masukkan dengan nama terbaca
- confidence: HIGH jika struk jelas, MEDIUM jika agak buram, LOW jika tidak yakin
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

    // 🔹 PARSE JSON dari response Gemini
    const cleaned = responseText.replace(/```json/g, '').replace(/```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // Fallback: coba cari JSON di dalam teks
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch {
          return NextResponse.json({
            success: false,
            message: 'Gagal membaca struk. Pastikan foto jelas dan tidak buram.',
          }, { status: 422 });
        }
      }
    }

    if (!parsed || !parsed.totalAmount) {
      return NextResponse.json({
        success: false,
        message: 'Struk tidak terbaca. Coba foto ulang dengan pencahayaan yang baik.',
      }, { status: 422 });
    }

    return NextResponse.json({
      success: true,
      message: 'Struk berhasil dibaca',
      data: {
        merchant: parsed.merchant || 'Tidak diketahui',
        amount: parsed.totalAmount,
        date: parsed.date || new Date().toISOString().split('T')[0],
        items: parsed.items || [],
        category: parsed.category || 'Lainnya',
        confidence: parsed.confidence || 'MEDIUM',
      },
    });
  } catch (error: any) {
    console.error('Scan receipt error (Gemini):', error);
    
    // ==========================================
    // FALLBACK: LOKAL OCR (TESSERACT.JS)
    // ==========================================
    try {
      const body = await request.clone().json().catch(() => ({}));
      const imageBase64 = body.imageBase64;
      
      // We must construct a valid data URI if it doesn't have one
      const mimeType = body.mimeType || 'image/jpeg';
      const dataURI = imageBase64.startsWith('data:') ? imageBase64 : `data:${mimeType};base64,${imageBase64}`;
      
      const { data: { text } } = await Tesseract.recognize(dataURI, 'ind+eng');
      
      // Simple regex parser
      let totalAmount = 0;
      const amounts = text.match(/\b\d{1,3}(?:\.\d{3})*(?:,\d+)?\b/g) || [];
      if (amounts.length > 0) {
        // Find the largest number
        const numbers = amounts.map(a => parseInt(a.replace(/[^\d]/g, ''), 10)).filter(n => n > 0);
        if (numbers.length > 0) {
          totalAmount = Math.max(...numbers);
        }
      }
      
      return NextResponse.json({
        success: true,
        message: 'Struk dibaca dengan OCR Lokal (Fallback)',
        data: {
          merchant: 'Merchant (OCR Lokal)',
          amount: totalAmount || 1000,
          date: new Date().toISOString().split('T')[0],
          items: [],
          category: 'Lainnya',
          confidence: 'LOW',
        },
      });
    } catch (fallbackError) {
      console.error('Fallback OCR Error:', fallbackError);
      return NextResponse.json({
        success: false,
        message: 'Gagal memproses gambar baik dengan AI maupun OCR Lokal. Coba lagi.',
      }, { status: 500 });
    }
  }
}

