/**
 * Chat API Route
 * 
 * Streaming chat endpoint using Vercel AI SDK.
 * All models route through the Perplexity Agent API gateway with a single API key.
 * Model IDs use provider prefix format: 'anthropic/claude-sonnet-4-6', 'openai/gpt-5.2', etc.
 * Sonar models include built-in web search — no external search orchestration needed.
 * 
 * @version 3.0.0
 */

export const runtime = 'edge';

import { streamText } from 'ai';
import { createPerplexityAgent } from '@/lib/perplexity-agent-provider';
import { getModelConfig } from '@/lib/model-configs';

// =============================================================================
// TYPES
// =============================================================================

interface ChatRequestBody {
  /** Conversation messages */
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content?: string | Array<{ type: string; text?: string }>;
    parts?: Array<{ type: string; text?: string }>;
  }>;
  /** Canvas-level context for Phase 2 */
  canvasContext?: {
    instructions?: string;
    knowledgeBase?: string;
  };
  /** Model identifier (e.g., 'anthropic/claude-sonnet-4-6', 'openai/gpt-5.2', 'sonar-pro') */
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

function extractMessageText(message: ChatRequestBody['messages'][number]): string {
  if (typeof message.content === 'string') {
    return message.content;
  }

  if (Array.isArray(message.content)) {
    return message.content
      .filter((part): part is { type: string; text: string } => part.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text)
      .join('');
  }

  if (Array.isArray(message.parts)) {
    return message.parts
      .filter((part): part is { type: string; text: string } => part.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text)
      .join('');
  }

  return '';
}

// =============================================================================
// PROVIDER DETECTION
// =============================================================================

type ProviderType = 'anthropic' | 'openai' | 'google' | 'perplexity';

function detectProvider(model: string): ProviderType {
  if (model.startsWith('anthropic/')) return 'anthropic';
  if (model.startsWith('openai/')) return 'openai';
  if (model.startsWith('google/')) return 'google';
  if (model.startsWith('perplexity/')) return 'perplexity';
  if (model.startsWith('sonar')) return 'perplexity';
  // Legacy bare model IDs
  if (model.startsWith('claude')) return 'anthropic';
  if (model.startsWith('gpt') || model.startsWith('o1') || model.startsWith('o3')) return 'openai';
  if (model.startsWith('gemini')) return 'google';
  return 'perplexity';
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
    
    console.log('[chat/route] Request received:', {
      model,
      messageCount: messages?.length || 0,
      hasCanvasContext: !!canvasContext,
      canvasContextKeys: canvasContext ? Object.keys(canvasContext) : [],
      hasInstructions: !!canvasContext?.instructions,
      hasKnowledgeBase: !!canvasContext?.knowledgeBase,
      instructionsPreview: canvasContext?.instructions?.substring(0, 50),
      knowledgeBasePreview: canvasContext?.knowledgeBase?.substring(0, 100)
    });

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

    // Detect underlying provider for config adjustments
    const providerType = detectProvider(model);
    
    // All models route through Perplexity Agent API
    const perplexity = createPerplexityAgent({ apiKey });
    const aiModel = perplexity(model);

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
              // Properly decode base64 with Unicode support
              const binaryString = atob(base64Data);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              const textContent = new TextDecoder('utf-8').decode(bytes);
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
    
    // Add model identity so the AI can answer correctly about itself
    const { getModelById } = await import('@/lib/vercel-ai-integration');
    const modelInfo = getModelById(model);
    if (modelInfo) {
      systemMessageParts.push(`You are ${modelInfo.name} (model ID: ${model}), ${modelInfo.description}`);
      console.log('[chat/route] Model identity injected:', { model, name: modelInfo.name });
    } else {
      console.warn('[chat/route] Model not found in registry:', model);
    }
    
    // Add canvas context to system prompt
    if (canvasContext?.instructions?.trim()) {
      systemMessageParts.push(`## Workspace Instructions\n\n${canvasContext.instructions.trim()}`);
      console.log('[chat/route] Instructions added, length:', canvasContext.instructions.length);
    }
    if (canvasContext?.knowledgeBase?.trim()) {
      systemMessageParts.push(`## Knowledge Base Context\n\nYou have been provided with the following workspace files and content. These files ARE available to you - reference them directly in your responses:\n\n${canvasContext.knowledgeBase.trim()}`);
      console.log('[chat/route] Knowledge base content added, length:', canvasContext.knowledgeBase.length);
    } else {
      console.log('[chat/route] No knowledge base content in request');
    }

    // Extract system messages from conversation and only keep user/assistant messages
    const conversationMessages = messages
      .map((msg, originalIdx) => {
        // Check if this is the last user message using the original index
        const isLastUserMessage = msg.role === 'user' && originalIdx === lastUserMessageIdx;
        
        if (msg.role === 'system') {
          // Add to system prompt parts instead of keeping in message flow
          systemMessageParts.push(extractMessageText(msg));
          return null; // Will filter out
        }
        
        if (isLastUserMessage && attachments && attachments.length > 0) {
          // Prepend text attachment content to message
          const messageWithAttachments = textAttachmentContent + extractMessageText(msg);
          
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
          content: extractMessageText(msg),
        };
      })
      .filter((msg): msg is NonNullable<typeof msg> => msg !== null);

    // Get per-model tuning (temperature, maxTokens)
    const modelConfig = getModelConfig(model);

    // Combine all system messages into ONE system prompt
    // This ensures Anthropic compatibility (requires single system parameter)
    const combinedSystemPrompt = systemMessageParts.length > 0
      ? systemMessageParts.join('\n\n')
      : modelConfig.systemPrompt;

    console.log('[chat/route] Final system prompt length:', combinedSystemPrompt?.length || 0);
    console.log('[chat/route] System prompt preview:', combinedSystemPrompt?.substring(0, 200) || 'none');

    // Token config — use maxTokens uniformly through Perplexity gateway
    const tokenConfig = { maxOutputTokens: modelConfig.maxTokens };

    // GPT-5 Mini only supports temperature: 1. MUST explicitly set it (not omit)
    const temperatureConfig = (providerType === 'openai' &&
                               model === 'openai/gpt-5-mini')
      ? { temperature: 1 }
      : { temperature: modelConfig.temperature };

    // =========================================================================
    // SYSTEM PROMPT FINALIZATION
    // =========================================================================
    // Sonar models (Perplexity) include built-in web search — results are
    // automatically woven into the response. No external search needed.
    // =========================================================================

    const finalSystemPrompt = combinedSystemPrompt;

    // Stream the response with error handling
    const result = streamText({
      model: aiModel,
      system: finalSystemPrompt,
      ...temperatureConfig,
      ...tokenConfig,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: conversationMessages as any,
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

    return result.toUIMessageStreamResponse({
      // Extract and pass citations via metadata for dropdown UI display.
      // Note: messageMetadata only receives { part }, not { message }.
      // We accumulate text from text-delta parts and extract citations on finish.
      messageMetadata: (() => {
        let accumulatedText = '';
        return ({ part }: { part: { type: string; text?: string; totalUsage?: { inputTokens?: number; outputTokens?: number } } }) => {
        const metadata: Record<string, unknown> = {};

        // Accumulate text from text-delta parts
        if (part.type === 'text-delta' && typeof part.text === 'string') {
          accumulatedText += part.text;
        }

        if (part.type === 'finish') {
          const usage = {
            inputTokens: part.totalUsage?.inputTokens ?? 0,
            outputTokens: part.totalUsage?.outputTokens ?? 0,
          };
          console.log('[chat/route] Sending usage metadata:', usage);
          metadata.usage = usage;

          // Extract citations from accumulated text (markdown format from Sonar)
          // Only extract links that appear after the "---\n\n**Sources:**" section
          // to avoid treating normal user markdown links as citations
          const sourcesMatch = accumulatedText.match(/\n\n---\n\n\*\*Sources:\*\*\n\n([\s\S]+)$/);
          if (sourcesMatch && sourcesMatch[1]) {
            const sourcesSection = sourcesMatch[1];
            const citationMatches = sourcesSection.match(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g);
            
            if (citationMatches && citationMatches.length > 0) {
              const sources = citationMatches.map(match => {
                const titleMatch = match.match(/\[([^\]]+)\]/);
                const urlMatch = match.match(/\((https?:\/\/[^\)]+)\)/);
                return {
                  title: titleMatch ? titleMatch[1] : 'Unknown',
                  url: urlMatch ? urlMatch[1] : '',
                };
              });

              metadata.custom = {
                webSearch: {
                  used: true,
                  sources,
                },
              };
            }
          }
        }

        return Object.keys(metadata).length > 0 ? metadata : undefined;
        };
      })(),
      onError: (error) => {
        console.error('[Chat API Stream Error]', error);
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
