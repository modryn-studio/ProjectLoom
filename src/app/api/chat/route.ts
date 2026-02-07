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

// =============================================================================
// TYPES
// =============================================================================

interface ChatRequestBody {
  /** Conversation messages */
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  /** Model identifier (e.g., 'claude-sonnet-4-20250514', 'gpt-4o') */
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
      'Context too long. Try using AI Summary inheritance mode.',
      'CONTEXT_TOO_LONG',
      400,
      { recoverable: false, suggestion: 'use_summary' }
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
    const { messages, model, apiKey, attachments } = body;

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
    const aiMessages = messages.map((msg, idx) => {
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

    // Stream the response
    const result = streamText({
      model: aiModel,
      messages: aiMessages as Parameters<typeof streamText>[0]['messages'],
    });

    // Return streaming response
    return result.toTextStreamResponse();
  } catch (error) {
    console.error('[Chat API Error]', error);
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
