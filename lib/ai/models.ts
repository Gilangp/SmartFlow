/**
 * Finto AI Gateway - Model Identifiers & Capabilities
 */

export const AI_MODELS = {
  TEXT: process.env.HF_MODEL_TEXT || 'deepseek-ai/DeepSeek-V3',
  VISION: process.env.HF_MODEL_VISION || 'Qwen/Qwen3-VL-8B-Instruct',
  FALLBACK_TEXT: [
    'zai-org/GLM-5.2',
    'meta-llama/Llama-3.3-70B-Instruct',
    'Qwen/Qwen2.5-72B-Instruct',
  ],
} as const;

export const MODEL_CAPABILITIES = {
  [AI_MODELS.TEXT]: {
    supportsTools: true,
    supportsVision: false,
    maxContextTokens: 8192,
  },
  [AI_MODELS.VISION]: {
    supportsTools: false,
    supportsVision: true,
    maxContextTokens: 4096,
  },
};

