/**
 * Finto AI Gateway - Model Provider Payload Formatters & Parsers
 */

import { AIMessage, AICallOptions, AIResponse } from './types';
import { AI_MODELS } from './models';
import { callHuggingFaceAPI, callHuggingFaceRouterAPI } from './client';

export async function executeTextModel(
  messages: AIMessage[],
  options: AICallOptions = {}
): Promise<AIResponse> {
  const model = AI_MODELS.TEXT;
  const temperature = options.temperature ?? 0.4;
  const max_tokens = options.maxTokens ?? 600;

  // Format messages to standard OpenAI array format
  const chatMessages: Array<{ role: string; content: string }> = [];
  for (const msg of messages) {
    const textContent = typeof msg.content === 'string'
      ? msg.content
      : msg.content.map(part => part.text || '').join('\n');

    chatMessages.push({
      role: msg.role,
      content: textContent,
    });
  }

  // 0. Try 9Router (Local OpenAI Gateway Proxy) if NINE_ROUTER_API_KEY / LOCAL_AI_API_KEY is defined
  const nineRouterKey = process.env.NINE_ROUTER_API_KEY || process.env.LOCAL_AI_API_KEY;
  const nineRouterUrl = process.env.NINE_ROUTER_BASE_URL || 'http://localhost:20128/v1';

  if (nineRouterKey) {
    try {
      const endpoint = `${nineRouterUrl.replace(/\/+$/, '')}/chat/completions`;
      const timeoutMs = options.timeoutMs || 30000;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      let nrRes: Response;
      try {
        nrRes = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${nineRouterKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: process.env.NINE_ROUTER_MODEL || 'finto',
            messages: chatMessages,
            temperature,
            max_tokens,
            max_completion_tokens: max_tokens,
            stream: false,
          }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }

      if (nrRes.ok) {
        const rawText = await nrRes.text();
        let text = '';

        try {
          const nrData = JSON.parse(rawText);
          text = nrData.choices?.[0]?.message?.content || '';
        } catch {
          // Robust SSE stream parser jika 9Router mengirimkan response format streaming (data: ...)
          const lines = rawText.split('\n');
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('data:') && !trimmed.includes('[DONE]')) {
              try {
                const jsonStr = trimmed.replace(/^data:\s*/, '');
                const parsed = JSON.parse(jsonStr);
                const chunkContent = parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.message?.content;
                if (chunkContent) text += chunkContent;
              } catch {
                // Ignore malformed SSE line
              }
            }
          }
        }

        if (text) {
          console.log('[AI Gateway Provider] ✅ Berhasil via 9Router Gateway.');
          return {
            success: true,
            content: text.trim(),
            modelUsed: process.env.NINE_ROUTER_MODEL || 'finto',
            tokenUsed: 'PRIMARY',
          };
        }
      }
    } catch (nrErr: any) {
      console.warn('[AI Gateway Provider] 9Router Local Gateway error:', nrErr.message);
    }
  }

  // 1. Try Primary Model (zai-org/GLM-5.2) via HF Router API
  try {
    const { text, tokenLabel } = await callHuggingFaceRouterAPI(model, chatMessages, {
      temperature,
      maxTokens: max_tokens,
      useSecondaryToken: options.useSecondaryToken,
      timeoutMs: 8500,
    });

    if (text) {
      return {
        success: true,
        content: text.trim(),
        modelUsed: model,
        tokenUsed: tokenLabel,
      };
    }
  } catch (err: any) {
    console.warn(`[AI Gateway Provider] HF Model ${model} gagal (${err.message}). Mencoba model alternatif HF...`);
  }

  // 2. Try Fallback Models on Hugging Face Router
  const fallbackModels = AI_MODELS.FALLBACK_TEXT;

  for (const altModel of fallbackModels) {
    try {
      const { text, tokenLabel } = await callHuggingFaceRouterAPI(altModel, chatMessages, {
        temperature,
        maxTokens: max_tokens,
        useSecondaryToken: options.useSecondaryToken,
        timeoutMs: 6000,
      });

      if (text) {
        console.log(`[AI Gateway Provider] ✅ Berhasil via HF Model Alternatif: ${altModel}`);
        return {
          success: true,
          content: text.trim(),
          modelUsed: altModel,
          tokenUsed: tokenLabel,
        };
      }
    } catch {
      // Continue trying next alt model
    }
  }

  // 3. Fallback Engine: Gemini 2.0 Flash
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || '';
    if (apiKey) {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(apiKey);
      const geminiModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

      let systemPrompt = '';
      let userPrompt = '';
      for (const m of chatMessages) {
        if (m.role === 'system') systemPrompt += `${m.content}\n`;
        else userPrompt += `${m.role.toUpperCase()}: ${m.content}\n`;
      }

      const result = await geminiModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n${userPrompt}` }] }],
        generationConfig: { temperature, maxOutputTokens: max_tokens },
      });
      const text = result.response.text();
      if (text) {
        console.log('[AI Gateway Provider] ✅ Berhasil via Gemini 2.0 Flash Fallback.');
        return {
          success: true,
          content: text.trim(),
          modelUsed: 'gemini-2.0-flash',
          tokenUsed: 'PRIMARY',
        };
      }
    }
  } catch (geminiErr: any) {
    console.warn('[AI Gateway Provider] Gemini Fallback error:', geminiErr.message);
  }

  return {
    success: false,
    content: null,
    modelUsed: model,
    tokenUsed: options.useSecondaryToken ? 'SECONDARY' : 'PRIMARY',
    error: 'Semua provider AI sedang dalam pemeliharaan atau melampaui batas kuota.',
  };
}

export async function executeVisionModel(
  imageUrl: string,
  prompt: string,
  options: AICallOptions = {}
): Promise<AIResponse> {
  // 0. Try 9Router (finto / custom vision model)
  const nineRouterKey = process.env.NINE_ROUTER_API_KEY || process.env.LOCAL_AI_API_KEY;
  const nineRouterUrl = process.env.NINE_ROUTER_BASE_URL || 'http://localhost:20128/v1';

  if (nineRouterKey) {
    try {
      const endpoint = `${nineRouterUrl.replace(/\/+$/, '')}/chat/completions`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), options.timeoutMs || 20000);

      const nrRes = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${nineRouterKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: process.env.NINE_ROUTER_MODEL || 'finto',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt || 'Ekstrak detail teks dari gambar ini.' },
                { type: 'image_url', image_url: { url: imageUrl } },
              ],
            },
          ],
          temperature: options.temperature ?? 0.2,
          max_tokens: options.maxTokens ?? 1024,
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (nrRes.ok) {
        const nrData = await nrRes.json();
        const text = nrData.choices?.[0]?.message?.content || '';
        if (text) {
          console.log('[AI Gateway Provider Vision] ✅ Berhasil via 9Router Gateway.');
          return {
            success: true,
            content: text.trim(),
            modelUsed: process.env.NINE_ROUTER_MODEL || 'finto',
            tokenUsed: 'PRIMARY',
          };
        }
      }
    } catch (nrErr: any) {
      console.warn('[AI Gateway Provider Vision] 9Router error:', nrErr.message);
    }
  }

  const model = AI_MODELS.VISION;

  const payload = {
    inputs: {
      image: imageUrl,
      prompt: prompt || 'Ekstrak detail teks dari gambar ini.',
    },
    parameters: {
      max_new_tokens: options.maxTokens ?? 1024,
      temperature: options.temperature ?? 0.2,
    },
  };

  try {
    const { data, tokenLabel } = await callHuggingFaceAPI(model, payload, true); // Vision defaults to secondary token

    let resultText = '';
    if (Array.isArray(data) && data[0]?.generated_text) {
      resultText = data[0].generated_text;
    } else if (typeof data === 'string') {
      resultText = data;
    } else if (data?.generated_text) {
      resultText = data.generated_text;
    } else {
      resultText = JSON.stringify(data);
    }

    return {
      success: true,
      content: resultText.trim(),
      modelUsed: model,
      tokenUsed: tokenLabel,
    };
  } catch (err: any) {
    console.warn(`[AI Gateway Provider Vision] Qwen3-VL Model ${model} gagal (${err.message}). Beralih ke fallback Gemini Vision...`);

    try {
      const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || '';
      if (apiKey && imageUrl.startsWith('data:image/')) {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(apiKey);
        const geminiModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const matches = imageUrl.match(/^data:(image\/\w+);base64,(.+)$/);
        if (matches) {
          const mimeType = matches[1];
          const base64Data = matches[2];
          const result = await geminiModel.generateContent({
            contents: [{
              role: 'user',
              parts: [
                { inlineData: { mimeType, data: base64Data } },
                { text: prompt || 'Ekstrak detail teks dari gambar ini.' },
              ],
            }],
            generationConfig: { temperature: options.temperature ?? 0.2, maxOutputTokens: options.maxTokens ?? 1024 },
          });
          const text = result.response.text();
          if (text) {
            console.log('[AI Gateway Provider Vision] ✅ Berhasil via Gemini 2.0 Flash Vision Fallback.');
            return {
              success: true,
              content: text.trim(),
              modelUsed: 'gemini-2.0-flash-vision',
              tokenUsed: 'PRIMARY',
            };
          }
        }
      }
    } catch (geminiErr: any) {
      console.error('[AI Gateway Provider Vision] Gemini Vision Fallback error:', geminiErr.message);
    }

    return {
      success: false,
      content: null,
      modelUsed: model,
      tokenUsed: 'SECONDARY',
      error: err.message,
    };
  }
}

