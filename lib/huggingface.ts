/**
 * lib/huggingface.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Helper reusable untuk memanggil Hugging Face Serverless Router API (v1).
 *
 * Fitur:
 *   - Menggunakan endpoint resmi terbaru Hugging Face Router v1 (OpenAI-compatible)
 *   - Token Rotation: Otomatis beralih ke token ke-2 jika token ke-1 limit
 *   - Model Cascade: Menggunakan model-model aktif tercepat dan terstabil
 *   - Timeout 8 detik: Sangat aman di dalam batas Vercel Hobby (10 detik)
 *
 * ENV yang dibutuhkan:
 *   HF_TOKEN_PRIMARY   = hf_xxxxx  (dari Akun HF ke-1)
 *   HF_TOKEN_SECONDARY = hf_xxxxx  (dari Akun HF ke-2)
 * ─────────────────────────────────────────────────────────────────────────────
 */

// Model aktif di Hugging Face Serverless Router yang tercepat & terbukti stabil
export const HF_MODELS = {
  /** Model utama: Sangat cepat, pintar, dan sangat stabil di HF Router */
  TEXT_FAST: 'Qwen/Qwen2.5-7B-Instruct',

  /** Model fallback ke-1: Llama 3.1 8B Instruct, sangat bagus untuk JSON & teks */
  TEXT_MEDIUM: 'meta-llama/Llama-3.1-8B-Instruct',

  /** Model fallback ke-2: DeepSeek R1 Distill Qwen 7B */
  TEXT_LARGE: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-7B',
};

// Urutan model yang akan dicoba secara berurutan
const MODEL_CASCADE = [
  HF_MODELS.TEXT_FAST,
  HF_MODELS.TEXT_MEDIUM,
  HF_MODELS.TEXT_LARGE,
];

// Endpoint resmi terbaru Hugging Face Serverless Router (OpenAI compatible)
const HF_API_BASE = 'https://router.huggingface.co/v1/chat/completions';

// Timeout aman untuk Vercel Hobby (10 detik per function)
const VERCEL_SAFE_TIMEOUT_MS = 8000;

type HfTextOptions = {
  maxNewTokens?: number;
  temperature?: number;
  /** Jika diset, langsung gunakan model ini tanpa cascade */
  model?: string;
};

/**
 * Memanggil Hugging Face Router API (v1 Chat Completions).
 * Strategi: Token Rotation + Model Cascade untuk ketahanan maksimal.
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

  const modelsToTry = preferredModel ? [preferredModel] : MODEL_CASCADE;
  let lastError: Error | null = null;

  for (const model of modelsToTry) {
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const tokenLabel = i === 0 ? 'PRIMARY' : 'SECONDARY';

      try {
        console.log(`[HuggingFace] Mencoba model "${model}" dengan token ${tokenLabel}...`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), VERCEL_SAFE_TIMEOUT_MS);

        let response: Response;
        try {
          response = await fetch(HF_API_BASE, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: model,
              messages: [{ role: 'user', content: prompt }],
              max_tokens: maxNewTokens,
              temperature,
            }),
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeoutId);
        }

        if (response.status === 503 || response.status === 504) {
          console.warn(`[HuggingFace] Model "${model}" sibuk/loading (${response.status}). Coba model berikutnya...`);
          lastError = new Error(`Model ${model} sibuk/loading.`);
          break; // Coba model berikutnya di cascade
        }

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
        let outputText: string | null = null;

        // OpenAI format (Router v1)
        if (result?.choices?.[0]?.message?.content) {
          outputText = result.choices[0].message.content;
        } else if (Array.isArray(result) && typeof result[0]?.generated_text === 'string') {
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
          break;
        }

        if (!isRateLimit) {
          console.warn(`[HuggingFace] Error pada model "${model}" token ${tokenLabel}:`, err.message);
          if (i < tokens.length - 1) continue;
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
