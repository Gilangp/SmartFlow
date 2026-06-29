/**
 * lib/huggingface.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Helper reusable untuk memanggil Hugging Face Serverless Inference API.
 *
 * Fitur:
 *   - Token Rotation: Otomatis beralih ke token ke-2 jika token ke-1 kena 429
 *   - Mendukung Text Generation (untuk Smart Input, Roasting, parsing OCR teks)
 *   - Sama sekali tidak memerlukan package tambahan (murni fetch bawaan Node.js)
 *
 * ENV yang dibutuhkan (.env.local & Vercel Environment Variables):
 *   HF_TOKEN_PRIMARY   = hf_xxxxx  (dari Akun HF ke-1)
 *   HF_TOKEN_SECONDARY = hf_xxxxx  (dari Akun HF ke-2)
 * ─────────────────────────────────────────────────────────────────────────────
 */

// Model default yang direkomendasikan untuk berbagai kebutuhan SmartFlow
export const HF_MODELS = {
  /** Terbaik untuk parsing JSON, Smart Input, dan memahami bahasa Indonesia */
  TEXT_GENERAL: 'Qwen/Qwen2.5-7B-Instruct',
  /** Alternatif backup untuk text generation */
  TEXT_BACKUP: 'meta-llama/Meta-Llama-3-8B-Instruct',
  /** Untuk Roasting: lebih kreatif dan ekspresif */
  TEXT_CREATIVE: 'Qwen/Qwen2.5-7B-Instruct',
};

const HF_API_BASE = 'https://api-inference.huggingface.co/models';

type HfTextOptions = {
  maxNewTokens?: number;
  temperature?: number;
  model?: string;
};

/**
 * Memanggil Hugging Face Text Generation API.
 * Secara otomatis beralih ke token sekunder jika token primer terkena rate limit (429).
 *
 * @param prompt   - Instruksi/teks yang akan diproses oleh model
 * @param options  - Konfigurasi model (opsional)
 * @returns        - Teks hasil generasi model
 */
export async function callHuggingFace(
  prompt: string,
  options: HfTextOptions = {}
): Promise<string> {
  const {
    maxNewTokens = 512,
    temperature = 0.2,
    model = HF_MODELS.TEXT_GENERAL,
  } = options;

  const tokens = [
    process.env.HF_TOKEN_PRIMARY,
    process.env.HF_TOKEN_SECONDARY,
  ].filter(Boolean) as string[];

  if (tokens.length === 0) {
    throw new Error('[HuggingFace] Tidak ada HF_TOKEN yang dikonfigurasi di environment.');
  }

  let lastError: Error | null = null;

  // Coba setiap token yang tersedia (Token Rotation)
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const tokenLabel = i === 0 ? 'PRIMARY' : 'SECONDARY';

    try {
      console.log(`[HuggingFace] Mencoba model "${model}" dengan token ${tokenLabel}...`);

      const response = await fetch(`${HF_API_BASE}/${model}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            max_new_tokens: maxNewTokens,
            temperature,
            return_full_text: false,
            do_sample: temperature > 0,
          },
        }),
        signal: AbortSignal.timeout(30000), // 30 detik timeout
      });

      // Model sedang loading (cold start), lempar error agar bisa dicoba token berikutnya
      if (response.status === 503) {
        const body = await response.json().catch(() => ({}));
        const estimatedTime = (body as any)?.estimated_time ?? '?';
        throw new Error(`Model sedang loading (cold start), estimasi ${estimatedTime}s.`);
      }

      // Rate limit token ini, coba token berikutnya
      if (response.status === 429) {
        console.warn(`[HuggingFace] Token ${tokenLabel} terkena rate limit. Beralih ke token berikutnya...`);
        lastError = new Error(`Token ${tokenLabel} rate limited.`);
        continue;
      }

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`HF API error ${response.status}: ${errText}`);
      }

      const result = await response.json();

      // Response bisa berupa array [{ generated_text: "..." }] atau object langsung
      if (Array.isArray(result) && result[0]?.generated_text !== undefined) {
        const text = result[0].generated_text as string;
        console.log(`[HuggingFace] ✅ Berhasil dengan token ${tokenLabel}. Output: ${text.length} karakter.`);
        return text.trim();
      }

      if (typeof result?.generated_text === 'string') {
        return result.generated_text.trim();
      }

      throw new Error('Format respons HF tidak dikenali: ' + JSON.stringify(result));
    } catch (err: any) {
      lastError = err;
      // Jika bukan masalah rate-limit, langsung lempar error
      if (!err.message?.includes('rate limited')) {
        console.warn(`[HuggingFace] Error dengan token ${tokenLabel}:`, err.message);
        // Tetap coba token berikutnya jika masih ada
        if (i < tokens.length - 1) continue;
      }
    }
  }

  throw lastError ?? new Error('[HuggingFace] Semua token gagal.');
}

/**
 * Helper untuk membersihkan dan mem-parse JSON dari output teks AI.
 * Model open-source terkadang menambahkan teks di luar JSON, fungsi ini menangani hal tersebut.
 *
 * @param rawText - Teks mentah dari hasil generasi AI
 * @returns       - Object hasil parse JSON, atau null jika gagal
 */
export function extractJsonFromHfOutput(rawText: string): Record<string, any> | null {
  try {
    // Bersihkan blok markdown code fence jika ada
    const cleaned = rawText
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();

    return JSON.parse(cleaned);
  } catch {
    // Coba ekstrak sub-string JSON dari teks
    const match = rawText.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}
