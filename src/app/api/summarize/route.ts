/**
 * Summarize API Route
 * 
 * Generates AI-powered conversation summaries for context inheritance.
 * Uses Vercel AI SDK generateText (non-streaming) with BYOK pattern.
 * 
 * @version 1.0.0
 */

import { generateText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { getModelConfig } from '@/lib/model-configs';

// =============================================================================
// TYPES
// =============================================================================

interface SummarizeRequestBody {
  /** Conversation messages to summarize */
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  /** Model identifier */
  model: string;
  /** User's API key for the provider */
  apiKey: string;
  /** Parent card title for context */
  parentTitle?: string;
}

interface SummarizeResponse {
  /** Generated summary text */
  summary: string;
  /** Token usage info */
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

interface APIError {
  error: string;
  code: string;
  recoverable: boolean;
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
  return 'anthropic';
}

// =============================================================================
// ERROR HANDLING
// =============================================================================

function createErrorResponse(
  message: string,
  code: string,
  status: number,
  recoverable = true
): Response {
  const error: APIError = { error: message, code, recoverable };
  return Response.json(error, { status });
}

function handleProviderError(error: unknown): Response {
  const err = error as { status?: number; message?: string; code?: string };

  if (err.status === 401 || err.message?.includes('invalid_api_key')) {
    return createErrorResponse(
      'Invalid API key. Please check your settings.',
      'INVALID_API_KEY',
      401
    );
  }

  if (err.status === 429) {
    return createErrorResponse(
      'Rate limit exceeded. Wait a moment and try again.',
      'RATE_LIMIT',
      429
    );
  }

  if (err.status === 400 && err.message?.includes('context_length')) {
    return createErrorResponse(
      'Conversation too long to summarize with this model.',
      'CONTEXT_TOO_LONG',
      400,
      false
    );
  }

  return createErrorResponse(
    err.message || 'Failed to generate summary.',
    'UNKNOWN_ERROR',
    500
  );
}

// =============================================================================
// SUMMARY PROMPT
// =============================================================================

function buildSummaryPrompt(
  messages: SummarizeRequestBody['messages'],
  parentTitle?: string
): string {
  const conversationText = messages
    .map((m) => `[${m.role.toUpperCase()}]: ${m.content}`)
    .join('\n\n');

  const titleContext = parentTitle 
    ? `The conversation is titled "${parentTitle}". ` 
    : '';

  return `You are summarizing a conversation for context inheritance in a thinking workspace. ${titleContext}The summary will be used as context for a branched follow-up conversation, so preserve:

1. Key decisions made and their rationale
2. Important conclusions or findings
3. Unresolved questions or open items
4. Technical details that would be needed for follow-up
5. The overall direction/goal of the conversation

Be concise but thorough. Write in 200-300 words. Use clear, factual language.

CONVERSATION (${messages.length} messages):

${conversationText}

SUMMARY:`;
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

export async function POST(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as SummarizeRequestBody;
    const { messages, model, apiKey, parentTitle } = body;

    // Validate required fields
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return createErrorResponse(
        'Messages array is required.',
        'INVALID_REQUEST',
        400,
        false
      );
    }

    if (!model) {
      return createErrorResponse(
        'Model is required.',
        'INVALID_REQUEST',
        400,
        false
      );
    }

    if (!apiKey) {
      return createErrorResponse(
        'API key is required. Configure it in Settings.',
        'MISSING_API_KEY',
        401
      );
    }

    // Create provider model instance
    const providerType = detectProvider(model);
    let aiModel;

    if (providerType === 'anthropic') {
      const anthropic = createAnthropic({ apiKey });
      aiModel = anthropic(model);
    } else {
      const openai = createOpenAI({ apiKey });
      aiModel = openai(model);
    }

    // Get per-model temperature
    const modelConfig = getModelConfig(model);

    // GPT-5 Mini/Nano only support temperature: 1. Omit parameter entirely for consistency.
    const temperatureConfig = (providerType === 'openai' && 
                               ['gpt-5-mini', 'gpt-5-nano'].includes(model))
      ? {} // Must omit - these models reject any temperature except default (1)
      : { temperature: modelConfig.temperature };

    // Generate summary (non-streaming)
    const result = await generateText({
      model: aiModel,
      prompt: buildSummaryPrompt(messages, parentTitle),
      ...temperatureConfig,
      maxTokens: 1000, // Summaries should be concise
    });

    const response: SummarizeResponse = {
      summary: result.text,
      usage: {
        promptTokens: result.usage?.promptTokens ?? 0,
        completionTokens: result.usage?.completionTokens ?? 0,
        totalTokens: result.usage?.totalTokens ?? 0,
      },
    };

    return Response.json(response);
  } catch (error) {
    console.error('[Summarize API Error]', error);
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
