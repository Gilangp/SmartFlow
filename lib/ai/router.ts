/**
 * Finto AI Gateway - Central Router
 * Provides unified interface with automatic model routing and fallback
 */

import { AIMessage, AICallOptions, AIResponse } from './types';
import { executeTextModel, executeVisionModel } from './provider';

export async function routeAICall(
  messages: AIMessage[],
  options: AICallOptions = {}
): Promise<AIResponse> {
  const modelType = options.modelType || 'TEXT';

  if (modelType === 'VISION') {
    // Extract image URL from user message if available
    let imageUrl = '';
    let promptText = '';

    for (const msg of messages) {
      if (Array.isArray(msg.content)) {
        for (const part of msg.content) {
          if (part.type === 'image_url' && part.image_url?.url) {
            imageUrl = part.image_url.url;
          }
          if (part.type === 'text' && part.text) {
            promptText += `${part.text}\n`;
          }
        }
      } else if (typeof msg.content === 'string') {
        promptText += `${msg.content}\n`;
      }
    }

    if (!imageUrl) {
      return {
        success: false,
        content: null,
        modelUsed: 'Qwen/Qwen3-VL-8B-Instruct',
        tokenUsed: 'SECONDARY',
        error: 'Panggilan VISION membutuhkan image_url.',
      };
    }

    return await executeVisionModel(imageUrl, promptText.trim(), options);
  }

  // Text Model execution with fallback
  let response = await executeTextModel(messages, options);

  // If primary fails, retry with secondary token
  if (!response.success && !options.useSecondaryToken) {
    console.warn('[AI Router] Retrying text call with secondary HF token...');
    response = await executeTextModel(messages, { ...options, useSecondaryToken: true });
  }

  return response;
}export function extractJsonFromOutput(output: string): any {
  if (!output) return null;
  try {
    return JSON.parse(output);
  } catch {
    const jsonMatch = output.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      try {
        return JSON.parse(jsonMatch[1].trim());
      } catch {
        // Fallthrough
      }
    }

    const bracketMatch = output.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
    if (bracketMatch && bracketMatch[0]) {
      try {
        return JSON.parse(bracketMatch[0].trim());
      } catch {
        // Fallthrough
      }
    }
    return null;
  }
}
