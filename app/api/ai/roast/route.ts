import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { callHuggingFace } from '@/lib/huggingface';
import { getDaysLeftInCycle } from '@/lib/financial-calculations';

export const dynamic = 'force-dynamic';

// Init AI
const genAI = new GoogleGenerativeAI(
  process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || ''
);

// Helper: generate prompt
function buildRoastPrompt({
  totalIncome,
  totalExpense,
  balance,
  dailyAllowance,
  daysLeftInMonth,
  todayExpense,
  yesterdayExpense,
  spendingAlert,
  expenses,
  tone,
  isGoodSpendingStatus,
  todayDateStr,
}: {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  dailyAllowance: number;
  daysLeftInMonth: number;
  todayExpense: number;
  yesterdayExpense: number;
  spendingAlert?: string;
  expenses: string[];
  tone: string;
  isGoodSpendingStatus: boolean;
  todayDateStr: string;
}) {
  return `
Kamu adalah Finto, asisten finansial sekaligus sahabat dekat user yang asyik, ceplas-ceplos, peduli, dan jujur.

Gaya Komunikasi:
- Bersikaplah seperti teman dekat yang sangat akrab (gunakan bahasa santai Indonesia sehari-hari seperti 'bro', 'sis', 'lu', 'gue' secara natural).
- Nada bicara saat ini: ${tone}.
${isGoodSpendingStatus 
  ? '- Meskipun kondisi keuangan user sedang AMAN/HEMAT hari ini, berikan pujian santai atau motivasi hangat, namun tetap selipkan sedikit godaan/candaan santai khas teman dekat agar dia tidak cepat puas (misalnya menyindir kebiasaan borosnya di masa lalu atau mengingatkan agar besok tidak khilaf belanja lagi). Jangan biarkan pesan menjadi terlalu manis, membosankan, atau kehilangan karakter humor.' 
  : '- Karena kondisi keuangan user sedang BOROS/TIGHT, berikan sindiran halus/gemas (roasting pas) khas sahabat dekat yang peduli agar dia sadar dan tidak kebablasan, namun akhiri dengan tips penyemangat atau pengingat yang baik.'}
- Perhatikan baik-baik bagian "(Catatan: ...)" pada transaksi pengeluaran. JANGAN me-roast atau menyindir jika pengeluaran besar tersebut ditujukan untuk keperluan penting, mendesak, atau kebaikan (seperti kesehatan, keluarga, pendidikan, ortu, sedekah, obat, ukt). Sebaliknya, berikan kata-kata empati, bangga, atau saran hemat yang lembut. Kamu boleh menyindir jika catatan menunjukkan belanja konsumtif/keinginan (seperti kopi, jajan, game, boba, checkout online shop, dll).
- SANGAT PENTING: Perhatikan tanggal masing-masing transaksi di bawah. Hari ini adalah tanggal ${todayDateStr}. Bedakan dengan jelas mana transaksi yang baru dicatat HARI INI dan mana transaksi dari hari-hari sebelumnya. Jangan sampai menuduh user berbelanja barang/makanan tertentu hari ini jika transaksi tersebut sebenarnya tercatat di hari kemarin atau hari sebelumnya!

Tugas:
- Berikan pesan singkat (maksimal 2-3 baris, WAJIB singkat).
- Harus relevan dari data pengeluaran aktual user.
- Jangan gunakan template generik.

Data Keuangan Terkini:
- Sisa Saldo Dompet Utama saat ini: Rp ${balance} (Uang yang saat ini tersisa di dompet utama user untuk dibelanjakan)
- Sisa Hari Siklus Gajian: ${daysLeftInMonth} hari lagi (Jumlah hari tersisa menuju gajian berikutnya, termasuk hari ini)
- Jatah Harian Ideal: Rp ${dailyAllowance}/hari (Batas anggaran belanja harian agar uang cukup sampai gajian berikutnya. Dihitung dari Sisa Saldo Dompet Utama dibagi Sisa Hari Siklus)
- Pengeluaran Hari Ini Saja: Rp ${todayExpense} (Total uang yang dibelanjakan HARI INI saja)
- Pengeluaran Kemarin: Rp ${yesterdayExpense} (Total pengeluaran kemarin sebagai data pembanding)
- Total Pemasukan 7 Hari Terakhir: Rp ${totalIncome} (Total seluruh pemasukan rutin & non-rutin dalam seminggu terakhir)
- Total Pengeluaran 7 Hari Terakhir: Rp ${totalExpense} (Total seluruh pengeluaran dalam seminggu terakhir, bukan hari ini saja)
${spendingAlert ? `\nPERINGATAN SISTEM: ${spendingAlert}\n(Gunakan peringatan ini untuk memahami jika terjadi kebocoran anggaran yang serius)` : ''}

Rincian Transaksi Pengeluaran Terakhir:
${expenses.slice(-15).join('\n')}

Aturan:
- WAJIB gunakan bahasa santai Indonesia ala anak muda yang akrab dan rapi tanpa typo.
- JANGAN gunakan emoji sama sekali dalam output.
- DILARANG KERAS menggunakan bahasa Mandarin / China / Inggris ataupun huruf Hanzi/karakter asing.
- WAJIB memformat semua nominal uang/nominal finansial yang kamu sebutkan menggunakan titik sebagai pemisah ribuan (contoh: Rp 15.000, Rp 500.000, Rp 1.200.000). JANGAN menulis nominal tanpa pemisah (seperti Rp 15000 atau Rp 500000).
- Hindari memanggil user dengan kata "bestie" secara berulang-ulang di setiap kalimat. Gunakan panggilan alami seperti "lu/gue", "bro", atau "sis". Buat percakapan mengalir alami seperti dua orang teman nongkrong, bukan bot pencari muka yang lebay.

Output:
Langsung pesanmu sebagai sahabat dalam bahasa Indonesia (tanpa tanda kutip, tanpa penjelasan).
`.trim();
}

// Helper: static fallback roast (safety net terakhir jika semua AI gagal)
function fallbackRoast(
  totalIncome: number,
  totalExpense: number,
  balance: number,
  dailyAllowance: number,
  todayExpense: number
) {
  const overspending = [
    'Eh bro, hari ini agak kebablasan ya? Pengeluaranmu lebih cepet dari biasanya nih. Yuk, ngerem dikit besok!',
    'Jatah harianmu tinggal dikit nih. Kurang-kurangin jajan elit dulu ya biar akhir bulan ga makan promag.',
    'Waduh sis, dompet udah mulai ngos-ngosan nih. Tahan diri dulu ya, kita kan mau hemat bulan ini!',
    'Pengeluaran hari ini agak di luar rencana. Santai, besok kita mulai rapihin lagi anggarannya ya.',
  ];

  const goodButBoring = [
    'Wah, keren banget! Keuanganmu hari ini aman terkendali. Pertahanin konsistensi kayak gini ya!',
    'Hari ini hemat banget, bangga gue. Dompetmu juga pasti senyum lebar ngeliat ini.',
    'Saldo masih sisa aman nih. Bagus, pertahanin ritme hemat ini sampai gajian berikutnya ya!',
    'Mantap, hari ini disiplin belanjanya top! Besok kita jaga lagi ya bareng-bareng.',
  ];

  const broke = [
    'Sisa saldo udah tipis banget nih bro. Semangat ya, mari kita survive bareng-bareng minggu ini!',
    'Waduh, saldo lagi kritis. Kurangin nongkrong dulu ya, mending masak mie instan di rumah aja dulu.',
    'Tenang, ini cuma fase tanggal tua. Yang penting tetep semangat dan jangan tergoda paylater ya!',
    'Sisa hari masih panjang tapi saldo tinggal dikit. Yuk semangat cari tambahan atau super hemat dulu!',
  ];

  if (balance <= 50000 || dailyAllowance < 15000) {
    return broke[Math.floor(Math.random() * broke.length)];
  }

  if (todayExpense > dailyAllowance || totalExpense > totalIncome) {
    return overspending[Math.floor(Math.random() * overspending.length)];
  }
  
  return goodButBoring[Math.floor(Math.random() * goodButBoring.length)];
}

export async function GET(request: NextRequest) {
  try {
    // =====================
    // AUTH
    // =====================
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

    // =====================
    // USER
    // =====================
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { pockets: true },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }

    // =====================
    // MAIN POCKET & TRANSACTIONS (7 DAYS)
    // =====================
    const mainWallet = user.pockets.find((p) => p.type === 'MAIN');
    if (!mainWallet) {
      return NextResponse.json(
        { success: false, message: 'Main pocket not found' },
        { status: 404 }
      );
    }
    const balance = Number(mainWallet.balance || 0);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const transactions = await prisma.transaction.findMany({
      where: {
        userId: user.id,
        pocketId: mainWallet.id,
        date: { gte: sevenDaysAgo },
      },
      include: { category: true },
      orderBy: { date: 'asc' },
    });

    if (!transactions.length) {
      return NextResponse.json({
        success: true,
        data: {
          message:
            '7 hari terakhir jatah harian kosong. Antara disiplin... atau denial finansial.',
        },
      });
    }

    // =====================
    // KALKULASI JATAH HARIAN & LONJAKAN HARI INI
    // =====================
    const now = new Date();
    let hasReceivedEarlySalary = false;
    const paydayDate = user.paydayDate;

    if (paydayDate && paydayDate > 1) {
      const currentDay = now.getDate();
      if (currentDay < paydayDate) {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), currentDay + 1);

        const earlyIncome = await prisma.transaction.findFirst({
          where: {
            userId: user.id,
            type: 'INCOME_ROUTINE',
            status: 'COMPLETED',
            date: {
              gte: startOfMonth,
              lt: todayEnd,
            },
          },
        });

        if (earlyIncome) {
          hasReceivedEarlySalary = true;
        }
      }
    }

    const daysLeftInMonth = getDaysLeftInCycle(now, paydayDate, hasReceivedEarlySalary);
    const dailyAllowance = Math.round(balance / daysLeftInMonth);

    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);

    let totalExpense = 0;
    let totalIncome = 0;
    let todayExpense = 0;
    let yesterdayExpense = 0;

    const expenseList: string[] = [];

    for (const t of transactions) {
      const amount = Number(t.amount);
      const txDate = new Date(t.date);

      if (t.type === 'EXPENSE') {
        totalExpense += amount;

        if (txDate >= startOfToday) {
          todayExpense += amount;
        } else if (txDate >= startOfYesterday && txDate < startOfToday) {
          yesterdayExpense += amount;
        }

        const dateStr = t.date.toISOString().split('T')[0];
        const notesStr = t.notes ? ` (Catatan: "${t.notes}")` : '';
        expenseList.push(
          `- [Tanggal: ${dateStr}] ${t.category?.name || 'Lainnya'} (${t.category?.type === 'WANT' ? 'Keinginan' : 'Kebutuhan'}): Rp ${amount}${notesStr}`
        );
      }

      if (t.type.startsWith('INCOME')) {
        totalIncome += amount;
      }
    }

    // Deteksi lonjakan boros (Opsi 4)
    let spendingAlert = '';
    if (todayExpense > dailyAllowance * 1.5 && dailyAllowance > 0) {
      spendingAlert = `[ALERT: Pengeluaran hari ini (Rp ${todayExpense}) sudah melebihi 150% dari jatah harian ideal (Rp ${dailyAllowance})!]`;
    } else if (todayExpense > yesterdayExpense * 2 && yesterdayExpense > 15000) {
      spendingAlert = `[ALERT: Lonjakan boros! Hari ini habis Rp ${todayExpense}, padahal kemarin cuma Rp ${yesterdayExpense}.]`;
    }

    // =====================
    // TONE & PROMPT SELECTION
    // =====================
    const isGoodSpendingStatus = todayExpense <= dailyAllowance * 0.8 && balance > 50000;
    const isBrokeStatus = balance <= 50000 || dailyAllowance < 15000;

    let selectedTone = '';
    if (isBrokeStatus) {
      const brokeTones = [
        'prihatin tapi memotivasi',
        'empati dan memberikan pelukan virtual hangat',
        'caring friend yang menyemangati di masa krisis keuangan',
        'teman curhat yang ikut prihatin tapi tetap optimis dan support',
      ];
      selectedTone = brokeTones[Math.floor(Math.random() * brokeTones.length)];
    } else if (isGoodSpendingStatus) {
      const goodTones = [
        'bangga, suportif, dan penuh apresiasi',
        'teman baik yang senang melihat kedisiplinan keuanganmu',
        'santai, ceria, dan memberikan tepuk tangan virtual',
        'suportif, memotivasi agar konsisten hemat dengan gaya kasual',
      ];
      selectedTone = goodTones[Math.floor(Math.random() * goodTones.length)];
    } else {
      const roastTones = [
        'nyindir lucu tapi tujuannya baik biar ga bangkrut',
        'gemas karena kamu mulai boros tapi tetap peduli',
        'sarkas ringan ala teman akrab tapi mengingatkan konsekuensinya',
        'teman dekat yang geleng-geleng kepala melihat belanjamu tapi tetap menyemangati',
      ];
      selectedTone = roastTones[Math.floor(Math.random() * roastTones.length)];
    }

    const todayDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }); // YYYY-MM-DD format in Jakarta time

    const prompt = buildRoastPrompt({
      totalIncome,
      totalExpense,
      balance,
      dailyAllowance,
      daysLeftInMonth,
      todayExpense,
      yesterdayExpense,
      spendingAlert,
      expenses: expenseList,
      tone: selectedTone,
      isGoodSpendingStatus,
      todayDateStr,
    });

    // =====================
    // AI CALL — BERTINGKAT
    // =====================

    // ── 1. GEMINI 2.0 FLASH (UTAMA) ──────────────────────────────────────────
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      let text = response.text().trim();
      text = text.replace(/^["']|["']$/g, '');

      if (!text || text.length < 10) throw new Error('Gemini returned weak response');
      if (/[\u4E00-\u9FFF]/.test(text)) throw new Error('Gemini returned Chinese characters');

      console.log('[ROAST] ✅ Berhasil via Gemini 2.0 Flash.');
      return NextResponse.json({ success: true, data: { message: text } });
    } catch (geminiError: any) {
      console.warn('[ROAST] Gemini gagal, beralih ke Hugging Face...', geminiError.message);
    }

    // ── 2. HUGGING FACE ROUTER V1 (FALLBACK GRATIS) ──────────────────────────
    try {
      const hfText = await callHuggingFace(prompt, {
        maxNewTokens: 200,
        temperature: 0.65, // Suhu lebih rendah agar bahasa rapi & tidak typo
      });

      const cleaned = hfText.replace(/^["']|["']$/g, '').trim();

      if (cleaned && cleaned.length >= 10 && !/[\u4E00-\u9FFF]/.test(cleaned)) {
        console.log('[ROAST] ✅ Berhasil via Hugging Face.');
        return NextResponse.json({ success: true, data: { message: cleaned } });
      }

      throw new Error('Hugging Face returned weak response');
    } catch (hfError: any) {
      console.warn('[ROAST] Hugging Face gagal, beralih ke static fallback...', hfError.message);
    }

    // ── 3. STATIC ROAST POOL (SAFETY NET TERAKHIR) ────────────────────────────
    console.log('[ROAST] Menggunakan static roast pool sebagai safety net.');
    return NextResponse.json({
      success: true,
      data: { message: fallbackRoast(totalIncome, totalExpense, balance, dailyAllowance, todayExpense) },
    });

  } catch (error) {
    console.error('ROAST ERROR:', error);

    return NextResponse.json(
      {
        success: false,
        message: 'Failed to generate roast',
        error: String(error),
      },
      { status: 500 }
    );
  }
}