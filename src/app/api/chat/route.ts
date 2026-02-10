/**
 * Chat API Route
 * 
 * Streaming chat endpoint using Vercel AI SDK.
 * Supports Claude (Anthropic) and OpenAI models with BYOK (Bring Your Own Key).
 * 
 * @version 1.0.0
 */

import { streamText, tool, StreamData } from 'ai';
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
  /** Optional Tavily API key for web search */
  tavilyKey?: string;
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
// WEB SEARCH
// =============================================================================

const WEB_SEARCH_SYSTEM_PROMPT = `When the user needs up-to-date info or explicitly asks to research, call the web_search tool.
Do not fabricate sources. If you use web_search, your response should summarize findings plainly; citations are handled separately.`;

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
    const contextMessages: Array<{ role: 'system'; content: string }> = [];
    if (canvasContext?.instructions?.trim()) {
      contextMessages.push({
        role: 'system',
        content: canvasContext.instructions.trim(),
      });
    }
    if (canvasContext?.knowledgeBase?.trim()) {
      contextMessages.push({
        role: 'system',
        content: `Knowledge Base:\n\n${canvasContext.knowledgeBase.trim()}`,
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
    const streamData = new StreamData();

    const webSearchTool = tavilyKey?.trim() ? tool({
      description: 'Search the web for recent or unknown information and return a concise summary with sources.',
      parameters: z.object({
        query: z.string().min(3).describe('The search query'),
        maxResults: z.number().min(1).max(3).optional().describe('Max sources to return (1-3)'),
      }),
      execute: async ({ query, maxResults }) => {
        const cappedResults = Math.min(maxResults ?? 3, 3);
        streamData.append({ type: 'web_search_start', query });

        try {
          // 10 second timeout for web search to prevent hanging
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);

          const response = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              api_key: tavilyKey,
              query,
              max_results: cappedResults,
              search_depth: 'advanced',
              include_answer: true,
              include_raw_content: false,
            }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            // Return empty results instead of error to prevent stream hang
            const errorMsg = response.status === 401 
              ? 'Invalid Tavily API key. Please check your settings.'
              : `Web search unavailable (status ${response.status})`;
            console.warn(`[Web Search] ${errorMsg}`);
            streamData.append({ type: 'web_search_end', query });
            return {
              summary: errorMsg,
              sources: [],
            };
          }

          const data = await response.json() as {
            answer?: string;
            results?: Array<{ title?: string; url: string; content?: string }>;
          };

          const sources = (data.results ?? [])
            .filter((result) => result.url)
            .slice(0, cappedResults)
            .map((result) => ({
              title: result.title || result.url,
              url: result.url,
            }));

          streamData.append({ type: 'web_search_result', sources });
          streamData.append({ type: 'web_search_end', query });

          return {
            summary: data.answer || 'No results found.',
            sources,
          };
        } catch (error) {
          // Catch all errors (timeout, network, etc.) and return gracefully
          const errorMsg = error instanceof Error && error.name === 'AbortError'
            ? 'Web search timed out after 10 seconds'
            : 'Web search failed due to network error';
          console.error(`[Web Search Error]`, error);
          streamData.append({ type: 'web_search_end', query });
          return {
            summary: errorMsg,
            sources: [],
          };
        }
      },
    }) : undefined;

    const systemPromptParts = [modelConfig.systemPrompt];
    if (tavilyKey?.trim()) {
      systemPromptParts.push(WEB_SEARCH_SYSTEM_PROMPT);
    }
    const systemPrompt = systemPromptParts.filter(Boolean).join('\n\n');

    // Stream the response
    const result = streamText({
      model: aiModel,
      temperature: modelConfig.temperature,
      maxTokens: modelConfig.maxTokens,
      ...(systemPrompt ? { system: systemPrompt } : {}),
      messages: aiMessages as Parameters<typeof streamText>[0]['messages'],
      ...(webSearchTool ? { tools: { web_search: webSearchTool }, toolChoice: 'auto', maxSteps: 3 } : {}),
    });

    // Return streaming response with usage (data protocol)
    return result.toDataStreamResponse({ data: streamData });
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
