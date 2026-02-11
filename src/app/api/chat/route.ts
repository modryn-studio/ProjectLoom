/**
 * Chat API Route
 * 
 * Streaming chat endpoint using Vercel AI SDK.
 * Supports Claude (Anthropic) and OpenAI models with BYOK (Bring Your Own Key).
 * 
 * @version 1.0.0
 */

import { streamText, tool } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
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
  /** Optional Tavily API key for web search tool */
  tavilyKey?: string;
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
    const { messages, model, apiKey, attachments, canvasContext, tavilyKey } = body;

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
    
    // Collect ALL system messages and combine them into ONE system prompt
    // Anthropic requires all system content in a single system parameter
    const systemMessageParts: string[] = [];
    
    // Add canvas context to system prompt
    if (canvasContext?.instructions?.trim()) {
      systemMessageParts.push(`[Workspace Instructions]\n\n${canvasContext.instructions.trim()}`);
    }
    if (canvasContext?.knowledgeBase?.trim()) {
      systemMessageParts.push(`[Knowledge Base]\n\n${canvasContext.knowledgeBase.trim()}`);
    }

    // Extract system messages from conversation and only keep user/assistant messages
    const conversationMessages = messages
      .map((msg, originalIdx) => {
        // Check if this is the last user message using the original index
        const isLastUserMessage = msg.role === 'user' && originalIdx === lastUserMessageIdx;
        
        if (msg.role === 'system') {
          // Add to system prompt parts instead of keeping in message flow
          systemMessageParts.push(msg.content);
          return null; // Will filter out
        }
        
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
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        };
      })
      .filter((msg): msg is NonNullable<typeof msg> => msg !== null);

    // Get per-model tuning (temperature, maxTokens)
    const modelConfig = getModelConfig(model);

    // Combine all system messages into ONE system prompt
    // This ensures Anthropic compatibility (requires single system parameter)
    const combinedSystemPrompt = systemMessageParts.length > 0
      ? systemMessageParts.join('\n\n---\n\n')
      : modelConfig.systemPrompt;

    // OpenAI GPT-5+ models require maxCompletionTokens instead of maxTokens
    const tokenConfig = providerType === 'openai'
      ? { maxCompletionTokens: modelConfig.maxTokens }
      : { maxTokens: modelConfig.maxTokens };

    // GPT-5 Mini/Nano only support temperature: 1. Omit parameter entirely to prevent
    // SDK from overriding with temperature: 0 when tools are present.
    const temperatureConfig = (providerType === 'openai' && 
                               ['gpt-5-mini', 'gpt-5-nano'].includes(model))
      ? {} // Must omit - these models reject any temperature except default (1)
      : { temperature: modelConfig.temperature };

    // Build tools object — only include tavily_search when key is available
    const tools = tavilyKey?.trim()
      ? {
          tavily_search: tool({
            description: 'Search the web for current, up-to-date information. Use this when the user asks about recent events, latest versions, current prices, news, or anything that may have changed after your training data cutoff.',
            parameters: z.object({
              query: z.string().describe('The search query to find relevant information'),
            }),
            execute: async ({ query }) => {
              console.log('[Chat API] Tool call: tavily_search, query:', query);
              try {
                const searchResponse = await fetch('https://api.tavily.com/search', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    api_key: tavilyKey,
                    query,
                    max_results: 5,
                    search_depth: 'advanced',
                    include_answer: true,
                    include_raw_content: false,
                  }),
                  signal: AbortSignal.timeout(15000),
                });

                if (!searchResponse.ok) {
                  const errText = await searchResponse.text().catch(() => '');
                  console.error('[Chat API] Tavily error:', searchResponse.status, errText);
                  return { error: `Search failed (${searchResponse.status})`, results: [] };
                }

                const data = await searchResponse.json() as {
                  answer?: string;
                  results?: Array<{ title?: string; url: string; content?: string }>;
                };

                const sources = (data.results ?? [])
                  .filter((r) => r.url)
                  .slice(0, 5)
                  .map((r) => ({
                    title: r.title || r.url,
                    url: r.url,
                    snippet: r.content?.slice(0, 200) || '',
                  }));

                return {
                  answer: data.answer || 'No summary available.',
                  sources,
                };
              } catch (err) {
                console.error('[Chat API] Tavily search error:', err);
                return {
                  error: err instanceof Error ? err.message : 'Search failed',
                  results: [],
                };
              }
            },
          }),
        }
      : undefined;

    // Stream the response with error handling
    const result = streamText({
      model: aiModel,
      system: combinedSystemPrompt,
      ...temperatureConfig,
      ...tokenConfig,
      messages: conversationMessages as Parameters<typeof streamText>[0]['messages'],
      ...(tools ? { tools, maxSteps: 3 } : {}),
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
