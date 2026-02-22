/**
 * Chat API Route
 * 
 * Streaming chat endpoint using Vercel AI SDK.
 * Models connect directly to Anthropic and OpenAI via their official provider SDKs.
 * Model IDs use provider prefix format: 'anthropic/claude-sonnet-4-6', 'openai/gpt-5.2', etc.
 * Web search is supported via provider-native tools (Anthropic web_search, OpenAI Responses API).
 * 
 * @version 4.0.0
 */

export const runtime = 'edge';

import { streamText, createUIMessageStream, createUIMessageStreamResponse, generateId } from 'ai';
import { createModel, getWebSearchTools, detectProvider as detectModelProvider } from '@/lib/provider-factory';
import { getModelConfig } from '@/lib/model-configs';
import { getMockResponse, getOnboardingResponse, chunkResponse } from '@/lib/mock-responses';

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
  /** Model identifier (e.g., 'anthropic/claude-sonnet-4-6', 'openai/gpt-5.2') */
  model: string;
  /** User's Anthropic API key (for Claude models) */
  anthropicKey?: string;
  /** User's OpenAI API key (for GPT models) */
  openaiKey?: string;
  /** Optional image attachments for the current message (vision support) */
  attachments?: Array<{
    contentType: string;
    name: string;
    url: string; // base64 data URL
  }>;
  /** When true, allows mock responses without an API key (onboarding mode) */
  onboarding?: boolean;
  /** Onboarding step ID for step-keyed scripted responses */
  onboardingStep?: string;
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

type ProviderType = 'anthropic' | 'openai';

function detectProvider(model: string): ProviderType {
  return detectModelProvider(model);
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
  const reqId = Math.random().toString(36).slice(2, 7).toUpperCase();
  const reqStart = Date.now();
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`[chat/route] ▶ START [${reqId}] ${new Date().toISOString()}`);
  try {
    const body = await req.json() as ChatRequestBody;
    const { messages, model, anthropicKey, openaiKey, attachments, canvasContext, onboarding } = body;
    
    const keys = { anthropic: anthropicKey, openai: openaiKey };
    const lastUserMsg = [...(messages ?? [])].reverse().find(m => m.role === 'user');
    const lastUserPreview = typeof lastUserMsg?.content === 'string'
      ? lastUserMsg.content.substring(0, 120)
      : Array.isArray(lastUserMsg?.parts)
        ? (lastUserMsg.parts.find((p: { type: string; text?: string }) => p.type === 'text')?.text ?? '').substring(0, 120) || '[multipart]'
        : '[multipart]';

    console.log(`[chat/route] [${reqId}] Request received:`, {
      model,
      messageCount: messages?.length || 0,
      lastUserMessage: lastUserPreview,
      hasAttachments: !!(attachments?.length),
      attachmentCount: attachments?.length ?? 0,
      hasCanvasContext: !!canvasContext,
      hasInstructions: !!canvasContext?.instructions,
      hasKnowledgeBase: !!canvasContext?.knowledgeBase,
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

    if (!anthropicKey && !openaiKey) {
      // ── Onboarding mock response ──
      // When no API key is set and the client signals onboarding mode,
      // return a canned streaming response so the user can experience
      // the full interaction loop without paying for API calls.
      if (onboarding) {
        const stepId = body.onboardingStep;
        console.log(`[chat/route] [${reqId}] 🎓 Onboarding mode — step: ${stepId ?? 'none'}`);
        // Use step-keyed scripted response if available, else fall back to intent detection
        const scriptedResponse = stepId ? getOnboardingResponse(stepId) : null;
        const userText = lastUserPreview ?? '';
        const mockText = scriptedResponse ?? getMockResponse(userText);
        const chunks = chunkResponse(mockText);

        const stream = createUIMessageStream({
          execute: async ({ writer }) => {
            const partId = generateId();
            writer.write({ type: 'text-start', id: partId });
            for (const chunk of chunks) {
              writer.write({ type: 'text-delta', delta: chunk, id: partId });
              // Simulate ~30 wpm typing speed
              await new Promise((r) => setTimeout(r, 15 + Math.random() * 25));
            }
            writer.write({ type: 'text-end', id: partId });
            writer.write({
              type: 'finish',
              finishReason: 'stop',
            });
          },
        });

        return createUIMessageStreamResponse({ stream });
      }

      return createErrorResponse(
        'At least one API key is required. Configure Anthropic or OpenAI key in Settings.',
        'MISSING_API_KEY',
        401,
        { recoverable: true, suggestion: 'add_api_key' }
      );
    }

    // Validate that the selected model's provider key is present
    const providerType = detectProvider(model);
    const providerKey = providerType === 'anthropic' ? anthropicKey : openaiKey;
    if (!providerKey) {
      return createErrorResponse(
        `${providerType === 'anthropic' ? 'Anthropic' : 'OpenAI'} API key is required for this model. Configure it in Settings.`,
        'MISSING_API_KEY',
        401,
        { recoverable: true, suggestion: 'add_api_key' }
      );
    }
    
    // Create model instance via provider factory
    // Web search tools are added separately via getWebSearchTools()
    const aiModel = createModel(model, keys);
    const webSearchTools = getWebSearchTools(model, keys, { webSearch: true });

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
    // Also handle empty/undefined contentType (Windows .md files before normalizeContentType fix)
    const textAttachments = attachments?.filter(att => {
      const ct = att.contentType ?? '';
      const url = att.url ?? '';
      return ct.startsWith('text/') || (!ct.startsWith('image/') && url.startsWith('data:'));
    }) ?? [];
    const imageAttachments = attachments?.filter(att => (att.contentType ?? '').startsWith('image/')) ?? [];
    
    // Process text attachments - extract content to prepend
    let textAttachmentContent = '';
    if (textAttachments.length > 0) {
      const textParts: string[] = [];
      for (const att of textAttachments) {
        try {
          const attUrl = att.url ?? '';
          if (attUrl.startsWith('data:')) {
            const base64Data = attUrl.split(',')[1];
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

    // Token config
    const tokenConfig = { maxOutputTokens: modelConfig.maxTokens };

    // Reasoning models (gpt-5.2, gpt-5.1) don't support temperature — omit entirely.
    // GPT-5 Mini only supports temperature: 1 — must explicitly set it.
    const temperatureConfig = modelConfig.reasoning
      ? {}
      : (providerType === 'openai' && model === 'openai/gpt-5-mini')
        ? { temperature: 1 }
        : { temperature: modelConfig.temperature };

    // =========================================================================
    // SYSTEM PROMPT FINALIZATION
    // =========================================================================

    const finalSystemPrompt = combinedSystemPrompt;

    // Stream the response with error handling
    const result = streamText({
      model: aiModel,
      system: finalSystemPrompt,
      ...temperatureConfig,
      ...tokenConfig,
      // Provider-native web search tools (Anthropic webSearch / OpenAI Responses API)
      ...(Object.keys(webSearchTools).length > 0 ? { tools: webSearchTools } : {}),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: conversationMessages as any,
      onStepFinish: ({ toolCalls, toolResults }) => {
        toolCalls?.forEach((call) => {
          if (call.toolName === 'web_search') {
            // Anthropic's provider-defined webSearch tool does NOT expose the query
            // in toolCalls.args — it's resolved internally by the provider.
            // OpenAI also exposes the query only on the tool result (output.action.query).
            // So we only log here if args actually contain something useful.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const args = (call as any).args as Record<string, unknown> | undefined;
            const query = args?.query ?? args?.input;
            if (query) {
              console.log('[chat/route] 🔍 Web search query:', query);
            } else {
              console.log('[chat/route] 🔍 Web search triggered (query resolved by provider)');
            }
          }
        });
        toolResults?.forEach((result) => {
          if (result.toolName === 'web_search') {
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const raw = (result as any).result ?? (result as any).output ?? result;
              // OpenAI: output.action.query contains the search query used
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const oaiQuery = (raw as any)?.action?.query;
              if (oaiQuery) {
                console.log('[chat/route] 🔍 Web search query (OpenAI result):', oaiQuery);
              }
              const size = JSON.stringify(raw).length;
              console.log('[chat/route] 🔍 Web search result received:', { sizeBytes: size });
            } catch {
              console.log('[chat/route] 🔍 Web search result received (size unknown)');
            }
          }
        });
      },
      onError: (error) => {
        console.error(`[chat/route] [${reqId}] ❌ Streaming error after ${Date.now() - reqStart}ms`, {
          provider: providerType,
          model,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          ...(typeof error === 'object' && error !== null ? error : {}),
        });
      },
      onFinish: ({ sources, usage }) => {
        const elapsed = Date.now() - reqStart;
        if (sources && sources.length > 0) {
          console.log(`[chat/route] [${reqId}] 🔍 Web search sources found:`, sources.length);
        }
        console.log(`[chat/route] [${reqId}] ✅ Stream finished in ${elapsed}ms`, {
          inputTokens: usage?.inputTokens,
          outputTokens: usage?.outputTokens,
        });
      },
    });

    return result.toUIMessageStreamResponse({
      // Forward source parts (web search citations) to the client.
      // Without this, source-url parts are generated server-side but never sent.
      sendSources: true,
      // Extract and pass citations via metadata for dropdown UI display.
      // Note: messageMetadata only receives { part }, not { message }.
      // We accumulate text from text-delta parts and extract citations on finish.
      messageMetadata: (() => {
        // Captured from 'finish-step' — the only part that carries providerMetadata.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let capturedTokenDetails: any = null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return ({ part }: { part: { type: string; text?: string; totalUsage?: { inputTokens?: number; outputTokens?: number }; usage?: { inputTokens?: number; outputTokens?: number }; providerMetadata?: any } }) => {
        const metadata: Record<string, unknown> = {};

        // 'finish-step' carries providerMetadata — capture token details
        if (part.type === 'finish-step') {
          // Anthropic cache token details
          const anthropicMeta = part.providerMetadata?.anthropic;
          if (anthropicMeta) {
            capturedTokenDetails = {
              cacheCreationInputTokens: anthropicMeta.cacheCreationInputTokens,
              cacheReadInputTokens: anthropicMeta.cacheReadInputTokens,
            };
          }
        }

        if (part.type === 'finish') {
          const usage = {
            inputTokens: part.totalUsage?.inputTokens ?? 0,
            outputTokens: part.totalUsage?.outputTokens ?? 0,
          };
          console.log('[chat/route] Sending usage metadata:', usage);
          metadata.usage = usage;

          if (capturedTokenDetails) {
            metadata.tokenDetails = capturedTokenDetails;
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
