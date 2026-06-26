import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { generateKtmToken } from '@/lib/auth';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageBase64, mimeType } = body;

    if (!imageBase64) {
      return NextResponse.json({ success: false, message: 'Image is required' }, { status: 400 });
    }

    const validMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
    const finalMimeType = validMimeTypes.includes(mimeType) ? mimeType : 'image/jpeg';

    const prompt = `
      Ekstrak informasi dari gambar Kartu Tanda Mahasiswa (KTM) ini.
      Kembalikan dalam format JSON PERSIS seperti di bawah ini tanpa markdown tambahan.
      
      {
        "name": "nama mahasiswa lengkap",
        "nim": "nomor induk mahasiswa (NIM/NPM/NRP) (pastikan angka)",
        "university": "nama universitas/kampus/perguruan tinggi",
        "confidence": "HIGH/MEDIUM/LOW"
      }
    `;

    let responseText = '';
    
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const result = await model.generateContent([
        {
          inlineData: {
            data: imageBase64,
            mimeType: finalMimeType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/heic',
          },
        },
        prompt,
      ]);
      responseText = result.response.text();
    } catch (geminiError: any) {
      console.warn('Gemini error, falling back to OpenAI...', geminiError.message);
      try {
        const openaiResponse = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${finalMimeType};base64,${imageBase64}`,
                  },
                },
              ],
            },
          ],
        });
        responseText = openaiResponse.choices[0]?.message?.content || '';
      } catch (openaiError: any) {
        throw new Error('Both Gemini and OpenAI failed to process image');
      }
    }

    const cleaned = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
    }

    if (!parsed || (!parsed.nim && !parsed.name)) {
      return NextResponse.json({
        success: false,
        message: 'KTM tidak terbaca jelas. Coba foto ulang.',
      }, { status: 422 });
    }

    const ktmToken = generateKtmToken(parsed.nim || '', parsed.name || '');

    return NextResponse.json({
      success: true,
      message: 'KTM berhasil diverifikasi',
      data: parsed,
      ktmToken,
    });
  } catch (error: any) {
    console.error('Verify KTM error:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Gagal memproses gambar KTM',
      error: error.message 
    }, { status: 500 });
  }
}
