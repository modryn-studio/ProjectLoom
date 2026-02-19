/**
 * Generate Title API Route
 * 
 * Generates a concise, meaningful title for a conversation card
 * based on the first user message and AI response.
 * Uses direct Anthropic/OpenAI provider SDKs.
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateText } from 'ai';
import { createModel, detectProvider as detectModelProvider } from '@/lib/provider-factory';
import { getModelConfig } from '@/lib/model-configs';

export const runtime = 'edge';
export const maxDuration = 30;

type ProviderType = 'anthropic' | 'openai';

interface GenerateTitleRequest {
  userMessage: string;
  assistantMessage: string;
  model: string;
  anthropicKey?: string;
  openaiKey?: string;
}

/**
 * Detect underlying provider from model ID (for temperature config)
 */
function detectProvider(model: string): ProviderType {
  return detectModelProvider(model);
}

/**
 * POST /api/generate-title
 * 
 * Generate a concise title (3-5 words) for a conversation
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as GenerateTitleRequest;
    const { userMessage, assistantMessage, model, anthropicKey, openaiKey } = body;
    const keys = { anthropic: anthropicKey, openai: openaiKey };

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

    if (!model || (!anthropicKey && !openaiKey)) {
      return NextResponse.json(
        { error: 'model and at least one API key are required' },
        { status: 400 }
      );
    }

    const titleModel = model;

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

    // Create model instance via provider factory (no web search needed for title gen)
    const aiModel = createModel(titleModel, keys);
    const modelConfig = getModelConfig(titleModel);

    // GPT-5 Mini only supports temperature: 1
    const titleProvider = detectProvider(titleModel);
    const temperature = (titleProvider === 'openai' && titleModel === 'openai/gpt-5-mini')
      ? 1
      : modelConfig.temperature;

    const result = await generateText({
      model: aiModel,
      system: systemPrompt,
      prompt: userPrompt,
      temperature,
      maxOutputTokens: 20,
    });

    let title = result.text?.trim() || '';

    // Extract usage data
    const usage = {
      promptTokens: result.usage?.inputTokens ?? 0,
      completionTokens: result.usage?.outputTokens ?? 0,
      totalTokens: (result.usage?.inputTokens ?? 0) + (result.usage?.outputTokens ?? 0),
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
      requestedModel: model,
      actualModel: titleModel,
      provider: titleProvider,
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
