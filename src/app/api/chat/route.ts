/**
 * Chat API Route
 * 
 * Streaming chat endpoint using Vercel AI SDK.
 * Supports Claude (Anthropic) and OpenAI models with BYOK (Bring Your Own Key).
 * 
 * @version 1.0.0
 */

import { streamText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { getModelConfig } from '@/lib/model-configs';

// =============================================================================
// TYPES
// =============================================================================

interface ChatRequestBody {
  /** Conversation messages */
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  /** Canvas-level context for Phase 2 */
  canvasContext?: {
    instructions?: string;
    knowledgeBase?: string;
  };
  /** Model identifier (e.g., 'claude-sonnet-4-5', 'gpt-5.2') */
  model: string;
  /** User's API key for the provider */
  apiKey: string;
  /** Optional image attachments for the current message (vision support) */
  attachments?: Array<{
    contentType: string;
    name: string;
    url: string; // base64 data URL
  }>;
}

interface APIError {
  error: string;
  code: string;
  recoverable: boolean;
  retryAfter?: number;
  suggestion?: string;
}

// =============================================================================
// PROVIDER DETECTION
// =============================================================================

type ProviderType = 'anthropic' | 'openai';

function detectProvider(model: string): ProviderType {
  if (model.startsWith('claude') || model.startsWith('anthropic')) {
    return 'anthropic';
  }
  if (model.startsWith('gpt') || model.startsWith('o1') || model.startsWith('o3')) {
    return 'openai';
  }
  // Default to anthropic for unknown models
  return 'anthropic';
}

// =============================================================================
// ERROR HANDLING
// =============================================================================

function createErrorResponse(
  message: string,
  code: string,
  status: number,
  options?: { recoverable?: boolean; retryAfter?: number; suggestion?: string }
): Response {
  const error: APIError = {
    error: message,
    code,
    recoverable: options?.recoverable ?? true,
    retryAfter: options?.retryAfter,
    suggestion: options?.suggestion,
  };

  return Response.json(error, { status });
}

function handleProviderError(error: unknown): Response {
  // Type guard for error objects
  const err = error as { status?: number; message?: string; code?: string };
  
  // Invalid API key
  if (err.status === 401 || err.message?.includes('invalid_api_key')) {
    return createErrorResponse(
      'Invalid API key. Please check your settings.',
      'INVALID_API_KEY',
      401,
      { recoverable: true, suggestion: 'check_api_key' }
    );
  }

  // Rate limit
  if (err.status === 429) {
    return createErrorResponse(
      'Rate limit exceeded. Wait a moment and try again.',
      'RATE_LIMIT',
      429,
      { recoverable: true, retryAfter: 60 }
    );
  }

  // Context length exceeded
  if (err.status === 400 && err.message?.includes('context_length')) {
    return createErrorResponse(
      'Context too long. Try starting a new branch to reduce message history.',
      'CONTEXT_TOO_LONG',
      400,
      { recoverable: false }
    );
  }

  // Network/timeout errors
  if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
    return createErrorResponse(
      'Network timeout. Check your connection.',
      'NETWORK_ERROR',
      408,
      { recoverable: true }
    );
  }

  // Generic error
  return createErrorResponse(
    err.message || 'An unexpected error occurred.',
    'UNKNOWN_ERROR',
    500,
    { recoverable: true }
  );
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

export async function POST(req: Request): Promise<Response> {
  try {
    const body = await req.json() as ChatRequestBody;
    const { messages, model, apiKey, attachments, canvasContext } = body;

    // Validate required fields
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return createErrorResponse(
        'Messages array is required.',
        'INVALID_REQUEST',
        400,
        { recoverable: false }
      );
    }

    if (!model) {
      return createErrorResponse(
        'Model is required.',
        'INVALID_REQUEST',
        400,
        { recoverable: false }
      );
    }

    if (!apiKey) {
      return createErrorResponse(
        'API key is required. Configure it in Settings.',
        'MISSING_API_KEY',
        401,
        { recoverable: true, suggestion: 'add_api_key' }
      );
    }

    // Detect provider and create model instance
    const providerType = detectProvider(model);
    
    let aiModel;
    
    if (providerType === 'anthropic') {
      const anthropic = createAnthropic({ apiKey });
      aiModel = anthropic(model);
    } else {
      const openai = createOpenAI({ apiKey });
      aiModel = openai(model);
    }

    // Build messages for AI SDK, injecting image attachments into the last user message
    // Find the index of the last user message (not just checking if the last message overall is user)
    const lastUserMessageIdx = messages.reduce((lastIdx, msg, idx) => 
      msg.role === 'user' ? idx : lastIdx, -1
    );
    if (attachments && attachments.length > 0 && lastUserMessageIdx === -1) {
      return createErrorResponse(
        'Image attachments require at least one user message.',
        'INVALID_REQUEST',
        400,
        { recoverable: false }
      );
    }
    const contextMessages: Array<{ role: 'system'; content: string }> = [];
    if (canvasContext?.instructions?.trim()) {
      contextMessages.push({
        role: 'system',
        content: `[Workspace Instructions]\n\n${canvasContext.instructions.trim()}`,
      });
    }
    if (canvasContext?.knowledgeBase?.trim()) {
      contextMessages.push({
        role: 'system',
        content: `[Knowledge Base]\n\n${canvasContext.knowledgeBase.trim()}`,
      });
    }

    const conversationMessages = messages.map((msg, idx) => {
      const isLastUserMessage = msg.role === 'user' && idx === lastUserMessageIdx;
      
      if (isLastUserMessage && attachments && attachments.length > 0) {
        // Convert to multimodal content parts
        const parts: Array<{ type: 'text'; text: string } | { type: 'image'; image: string; mimeType?: string }> = [
          { type: 'text' as const, text: msg.content },
        ];
        
        for (const att of attachments) {
          if (att.url.startsWith('data:')) {
            // Extract base64 data from data URL
            const base64Data = att.url.split(',')[1];
            if (base64Data) {
              parts.push({
                type: 'image' as const,
                image: base64Data,
                mimeType: att.contentType,
              });
            } else {
              console.warn(`[chat/route] Skipping malformed attachment: ${att.name || 'unknown'}`);
            }
          }
        }
        
        return {
          role: msg.role as 'user',
          content: parts,
        };
      }
      
      return {
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
      };
    });

    // Only prepend system messages when the user has set canvas context
    const aiMessages = contextMessages.length > 0
      ? [...contextMessages, ...conversationMessages]
      : conversationMessages;

    // Get per-model tuning (temperature, maxTokens)
    const modelConfig = getModelConfig(model);

    // OpenAI GPT-5+ models require maxCompletionTokens instead of maxTokens
    const tokenConfig = providerType === 'openai'
      ? { maxCompletionTokens: modelConfig.maxTokens }
      : { maxTokens: modelConfig.maxTokens };

    // Some models only support default temperature (1.0), omit parameter for those
    const temperatureConfig = modelConfig.temperature === 1.0 && providerType === 'openai'
      ? {} // Omit temperature to use default
      : { temperature: modelConfig.temperature };

    // Stream the response with error handling
    const result = streamText({
      model: aiModel,
      system: modelConfig.systemPrompt,
      ...temperatureConfig,
      ...tokenConfig,
      messages: aiMessages as Parameters<typeof streamText>[0]['messages'],
      onError: (error) => {
        // Log streaming errors for debugging
        console.error('[Chat API Streaming Error]', {
          provider: providerType,
          model,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          // Include error details if available
          ...(typeof error === 'object' && error !== null ? error : {}),
        });
      },
    });

    // Return streaming response
    return result.toDataStreamResponse();
  } catch (error) {
    // Log the full error object for debugging
    console.error('[Chat API Error]', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      // Include error details if available
      ...(typeof error === 'object' && error !== null ? error : {}),
    });
    return handleProviderError(error);
  }
}

// =============================================================================
// OPTIONS HANDLER (CORS)
// =============================================================================

export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
