/**
 * Chat API Route
 * 
 * Streaming chat endpoint using Vercel AI SDK.
 * Supports Claude (Anthropic), OpenAI, and Google Gemini models with BYOK (Bring Your Own Key).
 * 
 * @version 1.0.0
 */

export const runtime = 'edge';

import { streamText, createDataStreamResponse } from 'ai';
import type { LanguageModelV1 } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { getModelConfig } from '@/lib/model-configs';
import { orchestrateSearch } from '@/lib/search-orchestration';

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

type ProviderType = 'anthropic' | 'openai' | 'google';

function detectProvider(model: string): ProviderType {
  if (model.startsWith('claude') || model.startsWith('anthropic')) {
    return 'anthropic';
  }
  if (model.startsWith('gpt') || model.startsWith('o1') || model.startsWith('o3')) {
    return 'openai';
  }
  if (model.startsWith('gemini')) {
    return 'google';
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
    
    let aiModel: LanguageModelV1;
    
    if (providerType === 'anthropic') {
      const anthropic = createAnthropic({ apiKey });
      aiModel = anthropic(model) as unknown as LanguageModelV1;
    } else if (providerType === 'google') {
      const google = createGoogleGenerativeAI({ apiKey });
      aiModel = google(model) as unknown as LanguageModelV1;
    } else {
      const openai = createOpenAI({ apiKey });
      aiModel = openai(model) as unknown as LanguageModelV1;
    }

    // Build messages for AI SDK, handling both text and image attachments
    // Find the index of the last user message (not just checking if the last message overall is user)
    const lastUserMessageIdx = messages.reduce((lastIdx, msg, idx) => 
      msg.role === 'user' ? idx : lastIdx, -1
    );
    if (attachments && attachments.length > 0 && lastUserMessageIdx === -1) {
      return createErrorResponse(
        'Attachments require at least one user message.',
        'INVALID_REQUEST',
        400,
        { recoverable: false }
      );
    }
    
    // Separate attachments by type
    const textAttachments = attachments?.filter(att => att.contentType.startsWith('text/')) ?? [];
    const imageAttachments = attachments?.filter(att => att.contentType.startsWith('image/')) ?? [];
    
    // Process text attachments - extract content to prepend
    let textAttachmentContent = '';
    if (textAttachments.length > 0) {
      const textParts: string[] = [];
      for (const att of textAttachments) {
        try {
          if (att.url.startsWith('data:')) {
            const base64Data = att.url.split(',')[1];
            if (base64Data) {
              const textContent = decodeURIComponent(escape(atob(base64Data)));
              textParts.push(`[Attached file: ${att.name}]\n\n${textContent}`);
            }
          }
        } catch (error) {
          console.error(`[chat/route] Failed to decode text attachment: ${att.name}`, error);
        }
      }
      if (textParts.length > 0) {
        textAttachmentContent = textParts.join('\n\n---\n\n') + '\n\n---\n\n';
      }
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
          // Prepend text attachment content to message
          const messageWithAttachments = textAttachmentContent + msg.content;
          
          // If there are image attachments, create multimodal content
          if (imageAttachments.length > 0) {
            const parts: Array<{ type: 'text'; text: string } | { type: 'image'; image: string; mimeType?: string }> = [
              { type: 'text' as const, text: messageWithAttachments },
            ];
            
            for (const att of imageAttachments) {
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
                  console.warn(`[chat/route] Skipping malformed image attachment: ${att.name || 'unknown'}`);
                }
              }
            }
            
            return {
              role: msg.role as 'user',
              content: parts,
            };
          }
          
          // Only text attachments - return as simple string
          return {
            role: msg.role as 'user',
            content: messageWithAttachments,
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

    // GPT-5 Mini only supports temperature: 1. MUST explicitly set it (not omit)
    const temperatureConfig = (providerType === 'openai' &&
                               model === 'gpt-5-mini')
      ? { temperature: 1 }
      : { temperature: modelConfig.temperature };

    // =========================================================================
    // WEB SEARCH ORCHESTRATION
    // =========================================================================
    // Search runs BEFORE the LLM call. Results are injected into the system
    // prompt so the model can cite them naturally — no tool-calling needed.
    // =========================================================================

    // Extract the last user message text for search intent detection
    const lastUserMessage = messages[messages.length - 1];
    const lastUserText = typeof lastUserMessage?.content === 'string'
      ? lastUserMessage.content
      : '';

    // Run search orchestration with error handling to prevent route crashes
    let searchResult = null;
    if (tavilyKey?.trim() && lastUserText.trim()) {
      try {
        searchResult = await orchestrateSearch(lastUserText, tavilyKey);
      } catch (searchError) {
        console.error('[Chat API] Search orchestration failed:', searchError);
        // Continue without search results rather than crashing the entire request
      }
    }

    // If search returned results, append context to system prompt
    const finalSystemPrompt = searchResult
      ? (combinedSystemPrompt ? combinedSystemPrompt + '\n\n---\n\n' : '') + searchResult.searchContext
      : combinedSystemPrompt;

    // Stream the response with error handling, wrapped in a data stream
    // so we can send search source metadata alongside the LLM output.
    return createDataStreamResponse({
      execute: (dataStream) => {
        // Write search sources as a message annotation BEFORE the LLM stream
        // starts, so they arrive in onFinish's message.annotations on the client.
        if (searchResult && searchResult.sources.length > 0) {
          dataStream.writeMessageAnnotation({
            webSearch: {
              used: true,
              sources: searchResult.sources.map((s) => ({
                title: s.title,
                url: s.url,
                snippet: s.snippet || '',
              })),
            },
          });
        }

        const result = streamText({
          model: aiModel,
          system: finalSystemPrompt,
          ...temperatureConfig,
          ...tokenConfig,
          messages: conversationMessages as Parameters<typeof streamText>[0]['messages'],
          onError: (error) => {
            console.error('[Chat API Streaming Error]', {
              provider: providerType,
              model,
              error: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined,
              ...(typeof error === 'object' && error !== null ? error : {}),
            });
          },
        });

        result.mergeIntoDataStream(dataStream);
      },
      onError: (error) => {
        console.error('[Chat API DataStream Error]', error);
        return error instanceof Error ? error.message : 'An error occurred';
      },
    });
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
