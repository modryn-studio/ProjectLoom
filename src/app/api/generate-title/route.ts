/**
 * Generate Title API Route
 * 
 * Generates a concise, meaningful title for a conversation card
 * based on the first user message and AI response.
 * All models route through the Perplexity Agent API gateway.
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateText } from 'ai';
import type { LanguageModelV1 } from 'ai';
import { createPerplexity } from '@ai-sdk/perplexity';
import { getModelConfig } from '@/lib/model-configs';

export const runtime = 'edge';
export const maxDuration = 30;

type ProviderType = 'anthropic' | 'openai' | 'google' | 'perplexity';

interface GenerateTitleRequest {
  userMessage: string;
  assistantMessage: string;
  model: string;
  apiKey: string;
}

/**
 * Detect underlying provider from model ID (for temperature config)
 */
function detectProvider(model: string): ProviderType {
  if (model.startsWith('anthropic/')) return 'anthropic';
  if (model.startsWith('openai/')) return 'openai';
  if (model.startsWith('google/')) return 'google';
  if (model.startsWith('sonar')) return 'perplexity';
  if (model.startsWith('claude')) return 'anthropic';
  if (model.startsWith('gpt') || model.startsWith('o1') || model.startsWith('o3')) return 'openai';
  if (model.startsWith('gemini')) return 'google';
  return 'perplexity';
}

/**
 * POST /api/generate-title
 * 
 * Generate a concise title (3-5 words) for a conversation
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as GenerateTitleRequest;
    const { userMessage, assistantMessage, model, apiKey } = body;

    console.log('[Generate Title API] Request received:', {
      model,
      provider: detectProvider(model),
      userMessageLength: userMessage?.length,
      assistantMessageLength: assistantMessage?.length,
    });

    if (!userMessage) {
      return NextResponse.json(
        { error: 'userMessage is required' },
        { status: 400 }
      );
    }

    if (!model || !apiKey) {
      return NextResponse.json(
        { error: 'model and apiKey are required' },
        { status: 400 }
      );
    }

    const provider = detectProvider(model);

    // Build prompt for title generation
    const systemPrompt = `You are a title generator. Given a conversation between a user and assistant, generate a concise, descriptive title.

RULES:
- 3-5 words maximum
- Capture the main topic or task
- Be specific and descriptive
- Use title case (e.g., "Recipe App Planning")
- NO quotes, NO punctuation at the end
- Focus on the user's goal or topic

Examples:
- User: "Help me build a recipe app..." → "Recipe App Development"
- User: "I need to optimize database queries..." → "Database Query Optimization"
- User: "Can you explain React hooks?" → "React Hooks Explanation"`;

    const userPrompt = assistantMessage
      ? `USER: ${userMessage.slice(0, 500)}\n\nASSISTANT: ${assistantMessage.slice(0, 500)}\n\nGenerate a concise title (3-5 words):`
      : `USER: ${userMessage.slice(0, 500)}\n\nGenerate a concise title (3-5 words):`;

    // All models route through Perplexity Agent API
    const perplexity = createPerplexity({ apiKey });
    const modelConfig = getModelConfig(model);

    // GPT-5 Mini only supports temperature: 1
    const temperature = (provider === 'openai' && model === 'openai/gpt-5-mini')
      ? 1
      : modelConfig.temperature;

    const result = await generateText({
      model: perplexity(model) as unknown as LanguageModelV1,
      system: systemPrompt,
      prompt: userPrompt,
      temperature,
      maxTokens: 20,
    });

    let title = result.text?.trim() || '';

    // Extract usage data
    const usage = {
      promptTokens: result.usage?.promptTokens ?? 0,
      completionTokens: result.usage?.completionTokens ?? 0,
      totalTokens: result.usage?.totalTokens ?? 0,
    };

    // Clean up title
    title = title
      .replace(/^["']|["']$/g, '') // Remove quotes
      .replace(/[.!?]$/g, '') // Remove trailing punctuation
      .trim();

    // Validate title length (word count)
    const words = title.split(/\s+/);
    if (words.length > 5) {
      title = words.slice(0, 5).join(' ');
    }

    // Final fallback
    if (!title || title.length === 0) {
      const fallbackWords = userMessage.split(/\s+/).slice(0, 3).join(' ');
      title = fallbackWords.charAt(0).toUpperCase() + fallbackWords.slice(1);
    }

    console.log('[Generate Title API] ✅ Generated title:', {
      provider,
      model,
      title,
      titleLength: title.length,
      usage,
    });

    return NextResponse.json({ title, usage });
  } catch (error) {
    console.error('Error generating title:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
