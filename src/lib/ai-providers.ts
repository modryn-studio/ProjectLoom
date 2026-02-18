/**
 * AI Providers
 * 
 * Provider-agnostic AI integration with support for:
 * - Claude (Anthropic)
 * - OpenAI
 * - Mock provider for testing
 * 
 * @version 2.0.0
 */

import { nanoid } from 'nanoid';
import { apiKeyManager } from './api-key-manager';
import type { 
  AIProvider, 
  AIContext, 
  AIResponse, 
  ModelInfo,
  ProviderConfig,
  Message,
} from '@/types';

// =============================================================================
// CONSTANTS
// =============================================================================

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TEMPERATURE = 0.7;

// =============================================================================
// MOCK PROVIDER
// =============================================================================

/**
 * Mock provider for development and testing
 * Returns realistic responses with simulated delay
 */
export class MockProvider implements AIProvider {
  id = 'mock' as const;
  name = 'Mock Provider (Development)';
  config: ProviderConfig = {
    defaultModel: 'mock-1',
    maxTokens: DEFAULT_MAX_TOKENS,
    temperature: DEFAULT_TEMPERATURE,
  };

  private mockResponses = [
    "I understand what you're trying to accomplish. Let me help you work through this step by step.",
    "That's a great question! Here's how I would approach this problem...",
    "Based on the context you've provided, I think the best approach would be to...",
    "Let me analyze this and provide you with a detailed solution.",
    "I see a few potential approaches here. Let me outline them for you.",
  ];

  private getRandomResponse(): string {
    const idx = Math.floor(Math.random() * this.mockResponses.length);
    return this.mockResponses[idx];
  }

  async sendMessage(content: string, _context: AIContext): Promise<AIResponse> {
    void _context;
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));

    const response = this.getRandomResponse();
    
    return {
      content: response + `\n\nYou said: "${content.slice(0, 100)}${content.length > 100 ? '...' : ''}"`,
      model: 'mock-1',
      tokens: {
        input: Math.ceil(content.length / 4),
        output: Math.ceil(response.length / 4),
      },
      finishReason: 'stop',
    };
  }

  async *streamMessage(content: string, context: AIContext): AsyncIterator<AIResponse> {
    const fullResponse = await this.sendMessage(content, context);
    
    // Simulate streaming by yielding chunks
    const words = fullResponse.content.split(' ');
    let accumulated = '';
    
    for (let i = 0; i < words.length; i++) {
      accumulated += (i === 0 ? '' : ' ') + words[i];
      await new Promise(resolve => setTimeout(resolve, 50));
      
      yield {
        content: accumulated,
        model: 'mock-1',
        tokens: fullResponse.tokens,
        finishReason: i === words.length - 1 ? 'stop' : 'length',
      };
    }
  }

  async isAvailable(): Promise<boolean> {
    return true; // Mock is always available
  }

  async getModels(): Promise<ModelInfo[]> {
    return [
      {
        id: 'mock-1',
        name: 'Mock Model',
        maxTokens: 4096,
        supportsStreaming: true,
      },
    ];
  }
}

// =============================================================================
// CLAUDE PROVIDER
// =============================================================================

/**
 * Anthropic Claude provider
 */
export class ClaudeProvider implements AIProvider {
  id = 'claude' as const;
  name = 'Claude (Anthropic)';
  config: ProviderConfig;

  constructor(config?: Partial<ProviderConfig>) {
    this.config = {
      defaultModel: config?.defaultModel ?? 'claude-sonnet-4-6',
      maxTokens: config?.maxTokens ?? DEFAULT_MAX_TOKENS,
      temperature: config?.temperature ?? DEFAULT_TEMPERATURE,
      baseUrl: config?.baseUrl ?? ANTHROPIC_API_URL,
    };
  }

  private getApiKey(): string {
    const key = apiKeyManager.getKey('anthropic');
    if (!key) {
      throw new Error('Anthropic API key not configured. Add it in Settings or set NEXT_PUBLIC_ANTHROPIC_API_KEY environment variable.');
    }
    return key;
  }

  private formatMessages(context: AIContext): Array<{ role: string; content: string }> {
    return context.messages.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content,
    }));
  }

  async sendMessage(content: string, context: AIContext): Promise<AIResponse> {
    const apiKey = this.getApiKey();
    
    const messages = [
      ...this.formatMessages(context),
      { role: 'user', content },
    ];

    const body: Record<string, unknown> = {
      model: this.config.defaultModel,
      max_tokens: this.config.maxTokens,
      messages,
    };

    if (context.systemPrompt) {
      body.system = context.systemPrompt;
    }

    const response = await fetch(this.config.baseUrl!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Claude API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    
    return {
      content: data.content[0]?.text ?? '',
      model: data.model,
      tokens: {
        input: data.usage?.input_tokens ?? 0,
        output: data.usage?.output_tokens ?? 0,
      },
      finishReason: data.stop_reason === 'end_turn' ? 'stop' : 'length',
    };
  }

  async *streamMessage(content: string, context: AIContext): AsyncIterator<AIResponse> {
    const apiKey = this.getApiKey();
    
    const messages = [
      ...this.formatMessages(context),
      { role: 'user', content },
    ];

    const body: Record<string, unknown> = {
      model: this.config.defaultModel,
      max_tokens: this.config.maxTokens,
      messages,
      stream: true,
    };

    if (context.systemPrompt) {
      body.system = context.systemPrompt;
    }

    const response = await fetch(this.config.baseUrl!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Claude API error: ${response.status} - ${error}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let accumulated = '';
    let inputTokens = 0;
    let outputTokens = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            
            if (parsed.type === 'content_block_delta') {
              accumulated += parsed.delta?.text ?? '';
              yield {
                content: accumulated,
                model: this.config.defaultModel!,
                tokens: { input: inputTokens, output: outputTokens },
                finishReason: 'length',
              };
            }
            
            if (parsed.type === 'message_delta' && parsed.usage) {
              outputTokens = parsed.usage.output_tokens;
            }
            
            if (parsed.type === 'message_start' && parsed.message?.usage) {
              inputTokens = parsed.message.usage.input_tokens;
            }
          } catch {
            // Ignore parsing errors for incomplete chunks
          }
        }
      }
    }

    // Final yield with complete response
    yield {
      content: accumulated,
      model: this.config.defaultModel!,
      tokens: { input: inputTokens, output: outputTokens },
      finishReason: 'stop',
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      const key = apiKeyManager.getKey('anthropic');
      return key !== null;
    } catch {
      return false;
    }
  }

  async getModels(): Promise<ModelInfo[]> {
    return [
      {
        id: 'claude-opus-4-6',
        name: 'Claude Opus 4.6',
        maxTokens: 200000,
        supportsStreaming: true,
      },
      {
        id: 'claude-sonnet-4-6',
        name: 'Claude Sonnet 4.6',
        maxTokens: 200000,
        supportsStreaming: true,
      },
      {
        id: 'claude-haiku-4-5',
        name: 'Claude Haiku 4.5',
        maxTokens: 200000,
        supportsStreaming: true,
      },
    ];
  }
}

// =============================================================================
// OPENAI PROVIDER
// =============================================================================

/**
 * OpenAI provider (GPT models)
 */
export class OpenAIProvider implements AIProvider {
  id = 'openai' as const;
  name = 'OpenAI';
  config: ProviderConfig;

  constructor(config?: Partial<ProviderConfig>) {
    this.config = {
      defaultModel: config?.defaultModel ?? 'gpt-5.2',
      maxTokens: config?.maxTokens ?? DEFAULT_MAX_TOKENS,
      temperature: config?.temperature ?? DEFAULT_TEMPERATURE,
      baseUrl: config?.baseUrl ?? OPENAI_API_URL,
    };
  }

  private getApiKey(): string {
    const key = apiKeyManager.getKey('openai');
    if (!key) {
      throw new Error('OpenAI API key not configured. Add it in Settings or set NEXT_PUBLIC_OPENAI_API_KEY environment variable.');
    }
    return key;
  }

  private formatMessages(context: AIContext): Array<{ role: string; content: string }> {
    const messages: Array<{ role: string; content: string }> = [];
    
    if (context.systemPrompt) {
      messages.push({ role: 'system', content: context.systemPrompt });
    }
    
    for (const msg of context.messages) {
      messages.push({
        role: msg.role === 'system' ? 'system' : msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content,
      });
    }
    
    return messages;
  }

  async sendMessage(content: string, context: AIContext): Promise<AIResponse> {
    const apiKey = this.getApiKey();
    
    const messages = [
      ...this.formatMessages(context),
      { role: 'user', content },
    ];

    const response = await fetch(this.config.baseUrl!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.defaultModel,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        messages,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    
    return {
      content: data.choices[0]?.message?.content ?? '',
      model: data.model,
      tokens: {
        input: data.usage?.prompt_tokens ?? 0,
        output: data.usage?.completion_tokens ?? 0,
      },
      finishReason: data.choices[0]?.finish_reason === 'stop' ? 'stop' : 'length',
    };
  }

  async *streamMessage(content: string, context: AIContext): AsyncIterator<AIResponse> {
    const apiKey = this.getApiKey();
    
    const messages = [
      ...this.formatMessages(context),
      { role: 'user', content },
    ];

    const response = await fetch(this.config.baseUrl!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.defaultModel,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        messages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let accumulated = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices[0]?.delta?.content;
            
            if (delta) {
              accumulated += delta;
              yield {
                content: accumulated,
                model: this.config.defaultModel!,
                tokens: { input: 0, output: 0 }, // OpenAI doesn't provide tokens in stream
                finishReason: 'length',
              };
            }
          } catch {
            // Ignore parsing errors
          }
        }
      }
    }

    yield {
      content: accumulated,
      model: this.config.defaultModel!,
      tokens: { input: 0, output: 0 },
      finishReason: 'stop',
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      const key = apiKeyManager.getKey('openai');
      return key !== null;
    } catch {
      return false;
    }
  }

  async getModels(): Promise<ModelInfo[]> {
    return [
      {
        id: 'gpt-5-mini',
        name: 'GPT-5 Mini',
        maxTokens: 128000,
        supportsStreaming: true,
      },
      {
        id: 'gpt-5.2',
        name: 'GPT-5.2',
        maxTokens: 128000,
        supportsStreaming: true,
      },
    ];
  }
}

// =============================================================================
// PROVIDER REGISTRY
// =============================================================================

export type ProviderType = 'mock' | 'claude' | 'openai';

const providers: Record<ProviderType, AIProvider> = {
  mock: new MockProvider(),
  claude: new ClaudeProvider(),
  openai: new OpenAIProvider(),
};

/**
 * Get a provider by type
 */
export function getProvider(type: ProviderType): AIProvider {
  return providers[type];
}

/**
 * Get all available providers
 */
export async function getAvailableProviders(): Promise<AIProvider[]> {
  const available: AIProvider[] = [];
  
  for (const provider of Object.values(providers)) {
    if (await provider.isAvailable()) {
      available.push(provider);
    }
  }
  
  return available;
}

/**
 * Get the best available provider (preference: Claude > OpenAI > Mock)
 */
export async function getBestProvider(): Promise<AIProvider> {
  if (await providers.claude.isAvailable()) return providers.claude;
  if (await providers.openai.isAvailable()) return providers.openai;
  return providers.mock;
}

// =============================================================================
// HELPER: Create message from AI response
// =============================================================================

export function createMessageFromResponse(response: AIResponse): Message {
  return {
    id: nanoid(),
    role: 'assistant',
    content: response.content,
    timestamp: new Date(),
    metadata: {
      model: response.model,
      tokens: response.tokens.output,
    },
  };
}

export function createUserMessage(content: string): Message {
  return {
    id: nanoid(),
    role: 'user',
    content,
    timestamp: new Date(),
  };
}
