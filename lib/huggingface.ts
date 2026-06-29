/**
 * lib/huggingface.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Helper reusable untuk memanggil Hugging Face Serverless Inference API.
 *
 * Fitur:
 *   - Token Rotation: Otomatis beralih ke token ke-2 jika token ke-1 kena 429
 *   - Model Cascade: Coba model kecil/cepat dahulu, fallback ke model lebih besar
 *   - Timeout 8 detik: Aman dalam batas Vercel Hobby (10 detik per function)
 *
 * ENV yang dibutuhkan:
 *   HF_TOKEN_PRIMARY   = hf_xxxxx  (dari Akun HF ke-1)
 *   HF_TOKEN_SECONDARY = hf_xxxxx  (dari Akun HF ke-2)
 *
 * CATATAN MODEL:
 *   Model besar (7B+) memerlukan cold start 20-30 detik — tidak cocok di Vercel Hobby.
 *   Gunakan model kecil yang SELALU warm di free tier:
 *     - microsoft/Phi-3-mini-4k-instruct (3.8B, sangat cepat)
 *     - HuggingFaceH4/zephyr-7b-beta     (7B, biasanya warm)
 *     - google/gemma-2-2b-it             (2B, tercepat)
 * ─────────────────────────────────────────────────────────────────────────────
 */

// Model yang diurutkan dari paling ringan/cepat ke paling berat
// Semua model ini tersedia di free tier dan biasanya sudah warm
export const HF_MODELS = {
  /**
   * Model utama: kecil (2B), sangat cepat, warm 24/7 di HF free tier.
   * Cukup pintar untuk parsing JSON & roasting singkat.
   */
  TEXT_FAST: 'google/gemma-2-2b-it',

  /**
   * Model fallback: sedikit lebih besar (3.8B), sangat baik untuk bahasa Indonesia.
   * Digunakan jika gemma-2-2b gagal.
   */
  TEXT_MEDIUM: 'microsoft/Phi-3-mini-4k-instruct',

  /**
   * Model backup terakhir: 7B, tapi biasanya sudah warm karena sangat populer.
   */
  TEXT_LARGE: 'HuggingFaceH4/zephyr-7b-beta',
};

// Urutan model yang akan dicoba (dari tercepat ke terbesar)
const MODEL_CASCADE = [
  HF_MODELS.TEXT_FAST,
  HF_MODELS.TEXT_MEDIUM,
  HF_MODELS.TEXT_LARGE,
];

const HF_API_BASE = 'https://api-inference.huggingface.co/models';

// Timeout ketat agar tidak melampaui batas Vercel Hobby (10 detik per function)
// 8 detik: memberi 2 detik buffer untuk overhead Next.js
const VERCEL_SAFE_TIMEOUT_MS = 8000;

type HfTextOptions = {
  maxNewTokens?: number;
  temperature?: number;
  /** Jika diset, langsung gunakan model ini tanpa cascade */
  model?: string;
};

/**
 * Memanggil Hugging Face Text Generation API.
 * Strategi: Token Rotation + Model Cascade untuk ketahanan maksimal.
 *
 * @param prompt   - Instruksi/teks yang akan diproses oleh model
 * @param options  - Konfigurasi opsional
 * @returns        - Teks hasil generasi model
 */
export async function callHuggingFace(
  prompt: string,
  options: HfTextOptions = {}
): Promise<string> {
  const {
    maxNewTokens = 256,
    temperature = 0.2,
    model: preferredModel,
  } = options;

  const tokens = [
    process.env.HF_TOKEN_PRIMARY,
    process.env.HF_TOKEN_SECONDARY,
  ].filter(Boolean) as string[];

  if (tokens.length === 0) {
    throw new Error('[HuggingFace] Tidak ada HF_TOKEN yang dikonfigurasi di environment.');
  }

  // Jika model spesifik diminta, gunakan itu saja. Jika tidak, gunakan cascade.
  const modelsToTry = preferredModel ? [preferredModel] : MODEL_CASCADE;

  let lastError: Error | null = null;

  // Cascade: coba tiap model secara berurutan
  for (const model of modelsToTry) {
    // Untuk tiap model, coba tiap token (rotation)
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const tokenLabel = i === 0 ? 'PRIMARY' : 'SECONDARY';

      try {
        console.log(`[HuggingFace] Mencoba model "${model}" dengan token ${tokenLabel}...`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), VERCEL_SAFE_TIMEOUT_MS);

        let response: Response;
        try {
          response = await fetch(`${HF_API_BASE}/${model}`, {
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
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeoutId);
        }

        // Model sedang cold start — coba model berikutnya (lebih ringan tidak cold start)
        if (response.status === 503) {
          const body = await response.json().catch(() => ({}));
          const estimatedTime = (body as any)?.estimated_time ?? '?';
          console.warn(`[HuggingFace] Model "${model}" cold start (~${estimatedTime}s). Coba model berikutnya...`);
          lastError = new Error(`Model ${model} cold start.`);
          break; // Keluar dari loop token, coba model berikutnya
        }

        // Rate limit token ini — coba token berikutnya
        if (response.status === 429) {
          console.warn(`[HuggingFace] Token ${tokenLabel} rate limit. Coba token berikutnya...`);
          lastError = new Error(`Token ${tokenLabel} rate limited.`);
          continue;
        }

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`HF HTTP ${response.status}: ${errText.slice(0, 200)}`);
        }

        const result = await response.json();

        // Parse response: bisa array atau object langsung
        let outputText: string | null = null;

        if (Array.isArray(result) && typeof result[0]?.generated_text === 'string') {
          outputText = result[0].generated_text;
        } else if (typeof result?.generated_text === 'string') {
          outputText = result.generated_text;
        }

        if (!outputText) {
          throw new Error('Format respons HF tidak dikenali: ' + JSON.stringify(result).slice(0, 100));
        }

        console.log(`[HuggingFace] Berhasil! Model: "${model}", Token: ${tokenLabel}, Output: ${outputText.length} karakter.`);
        return outputText.trim();

      } catch (err: any) {
        lastError = err;
        const isTimeout = err.name === 'AbortError';
        const isRateLimit = err.message?.includes('rate limited');

        if (isTimeout) {
          console.warn(`[HuggingFace] Timeout (>${VERCEL_SAFE_TIMEOUT_MS}ms) pada model "${model}" token ${tokenLabel}. Coba model berikutnya...`);
          break; // Timeout = model lambat, skip ke model berikutnya
        }

        if (!isRateLimit) {
          console.warn(`[HuggingFace] Error pada model "${model}" token ${tokenLabel}:`, err.message);
          if (i < tokens.length - 1) continue; // Coba token berikutnya
        }
      }
    }
  }

  throw lastError ?? new Error('[HuggingFace] Semua model dan token gagal.');
}

/**
 * Helper untuk membersihkan dan mem-parse JSON dari output teks AI.
 */
export function extractJsonFromHfOutput(rawText: string): Record<string, any> | null {
  try {
    const cleaned = rawText
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();

    return JSON.parse(cleaned);
  } catch {
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
