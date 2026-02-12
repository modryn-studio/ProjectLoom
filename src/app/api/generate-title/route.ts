/**
 * Generate Title API Route
 * 
 * Generates a concise, meaningful title for a conversation card
 * based on the first user message and AI response.
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';
export const maxDuration = 30;

type ProviderType = 'anthropic' | 'openai' | 'google';

interface GenerateTitleRequest {
  userMessage: string;
  assistantMessage: string;
  model: string;
  apiKey: string;
}

/**
 * Detect provider from model string
 */
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
  return 'anthropic'; // Default
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

    // Build API request based on provider
    let apiEndpoint: string;
    let headers: Record<string, string>;
    let requestBody: {
      model: string;
      messages: Array<{ role: string; content: string }>;
      system?: string;
      temperature?: number;
      max_tokens: number;
    };

    if (provider === 'anthropic') {
      apiEndpoint = 'https://api.anthropic.com/v1/messages';
      headers = {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      };
      requestBody = {
        model: model,
        messages: [{ role: 'user', content: userPrompt }],
        system: systemPrompt,
        // Don't specify temperature - let model use its default
        max_tokens: 20,
      };
    } else if (provider === 'google') {
      // Google Gemini
      apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      headers = {
        'Content-Type': 'application/json',
      };
      requestBody = {
        model: model,
        messages: [
          { role: 'user', content: `${systemPrompt}\n\n${userPrompt}` },
        ],
        max_tokens: 20,
      };
    } else {
      // OpenAI / OpenRouter
      apiEndpoint = 'https://api.openai.com/v1/chat/completions';
      headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      };
      requestBody = {
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        // Don't specify temperature - some models like GPT-5 Mini only support default (1.0)
        max_tokens: 20,
      };
    }

    // Call AI provider
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Title generation failed:', errorData);
      return NextResponse.json(
        { error: 'Failed to generate title', details: errorData },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Extract title and usage from response based on provider
    let title: string;
    let usage: { promptTokens: number; completionTokens: number; totalTokens: number } | undefined;
    
    if (provider === 'anthropic') {
      title = data.content?.[0]?.text?.trim() || '';
      // Extract Anthropic usage data
      if (data.usage) {
        usage = {
          promptTokens: data.usage.input_tokens || 0,
          completionTokens: data.usage.output_tokens || 0,
          totalTokens: (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0),
        };
      }
    } else if (provider === 'google') {
      // Google Gemini
      title = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
      // Extract Google usage data
      if (data.usageMetadata) {
        usage = {
          promptTokens: data.usageMetadata.promptTokenCount || 0,
          completionTokens: data.usageMetadata.candidatesTokenCount || 0,
          totalTokens: data.usageMetadata.totalTokenCount || 0,
        };
      }
    } else {
      // OpenAI
      title = data.choices?.[0]?.message?.content?.trim() || '';
      // Extract OpenAI usage data
      if (data.usage) {
        usage = {
          promptTokens: data.usage.prompt_tokens || 0,
          completionTokens: data.usage.completion_tokens || 0,
          totalTokens: data.usage.total_tokens || 0,
        };
      }
    }

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
      // Extract first few words from user message as fallback
      const fallbackWords = userMessage.split(/\s+/).slice(0, 3).join(' ');
      title = fallbackWords.charAt(0).toUpperCase() + fallbackWords.slice(1);
    }

    // Log usage data for diagnostics
    if (usage) {
      console.log('[Generate Title API] Usage tracked:', { provider, model, usage });
    } else {
      console.warn('[Generate Title API] No usage data from provider:', { provider, model });
    }

    return NextResponse.json({ title, usage });
  } catch (error) {
    console.error('Error generating title:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
