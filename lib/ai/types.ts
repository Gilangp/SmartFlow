/**
 * Finto AI Gateway - TypeScript Interfaces & Types
 */

export type ModelType = 'TEXT' | 'VISION';

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | AIContentPart[];
}

export interface AIContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
  };
}

export interface AIToolFunction {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

export interface AITool {
  type: 'function';
  function: AIToolFunction;
}

export interface AICallOptions {
  modelType?: ModelType;
  temperature?: number;
  maxTokens?: number;
  tools?: AITool[];
  useSecondaryToken?: boolean;
}

export interface AIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

export interface AIResponse {
  success: boolean;
  content: string | null;
  toolCalls?: AIToolCall[];
  modelUsed: string;
  tokenUsed: 'PRIMARY' | 'SECONDARY';
  error?: string;
}
