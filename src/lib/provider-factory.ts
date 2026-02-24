/**
 * Provider Factory
 * 
 * Creates Vercel AI SDK model instances for Anthropic and OpenAI providers.
 * Replaces the old Perplexity Agent API gateway with direct provider connections.
 * 
 * Model IDs use the 'provider/model' format: 'anthropic/claude-sonnet-4-6', 'openai/gpt-5.2'
 * The factory strips the prefix and routes to the correct provider SDK.
 * 
 * @version 1.0.0
 */

import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel, ToolSet } from 'ai';

// =============================================================================
// TYPES
// =============================================================================

export interface ProviderKeys {
  anthropic?: string;
  openai?: string;
}

export interface CreateModelOptions {
  /** Enable web search tool for this model. Default: false */
  webSearch?: boolean;
}

// =============================================================================
// PROVIDER DETECTION
// =============================================================================

export type ProviderType = 'anthropic' | 'openai';

/**
 * Detect provider from model ID prefix.
 * Only anthropic and openai are supported.
 */
export function detectProvider(modelId: string): ProviderType {
  if (modelId.startsWith('anthropic/')) return 'anthropic';
  if (modelId.startsWith('openai/')) return 'openai';
  // Legacy bare model IDs
  if (modelId.startsWith('claude')) return 'anthropic';
  if (modelId.startsWith('gpt') || modelId.startsWith('o1') || modelId.startsWith('o3') || modelId.startsWith('o4')) return 'openai';
  throw new Error(`Unknown provider for model: ${modelId}. Use 'anthropic/...' or 'openai/...' format.`);
}

/**
 * Strip the provider prefix from a model ID.
 * 'anthropic/claude-sonnet-4-6' → 'claude-sonnet-4-6'
 * 'openai/gpt-5.2' → 'gpt-5.2'
 */
function stripPrefix(modelId: string): string {
  const slashIndex = modelId.indexOf('/');
  return slashIndex >= 0 ? modelId.slice(slashIndex + 1) : modelId;
}

// =============================================================================
// MODEL FACTORY
// =============================================================================

/**
 * Create a Vercel AI SDK LanguageModel for the given model ID.
 * 
 * @param modelId - Full model ID (e.g. 'anthropic/claude-sonnet-4-6', 'openai/gpt-5.2')
 * @param keys - API keys for each provider (only the relevant one is used)
 * @returns LanguageModel instance ready for streamText/generateText
 * @throws If the provider key is missing or the model prefix is unknown
 */
export function createModel(
  modelId: string,
  keys: ProviderKeys,
): LanguageModel {
  const provider = detectProvider(modelId);
  const bareModelId = stripPrefix(modelId);

  switch (provider) {
    case 'anthropic': {
      if (!keys.anthropic) {
        throw new Error('Anthropic API key is required for Claude models. Add it in Settings.');
      }
      const anthropic = createAnthropic({ apiKey: keys.anthropic });
      return anthropic(bareModelId);
    }

    case 'openai': {
      if (!keys.openai) {
        throw new Error('OpenAI API key is required for GPT models. Add it in Settings.');
      }
      // Default openai() uses the Responses API (AI SDK 5+)
      // which supports native web search via openai.tools.webSearch()
      const openai = createOpenAI({ apiKey: keys.openai });
      return openai(bareModelId);
    }
  }
}

// =============================================================================
// WEB SEARCH TOOLS
// =============================================================================

/**
 * Get provider-specific web search tools for a model.
 * Returns an object of tools to spread into the streamText/generateText `tools` param.
 * Returns empty object if web search is not requested.
 */
export function getWebSearchTools(
  modelId: string,
  keys: ProviderKeys,
  options?: CreateModelOptions,
): ToolSet {
  if (!options?.webSearch) return {};

  const provider = detectProvider(modelId);

  switch (provider) {
    case 'anthropic': {
      if (!keys.anthropic) return {};
      const anthropic = createAnthropic({ apiKey: keys.anthropic });
      return {
        web_search: anthropic.tools.webSearch_20250305({ maxUses: 5 }),
      } as ToolSet;
    }

    case 'openai': {
      if (!keys.openai) return {};
      const openai = createOpenAI({ apiKey: keys.openai });
      return {
        web_search: openai.tools.webSearch({
          searchContextSize: 'medium',
        }),
      } as ToolSet;
    }
  }
}

/**
 * Get the API key for a specific model from the keys object.
 */
export function getKeyForModel(modelId: string, keys: ProviderKeys): string | null {
  try {
    const provider = detectProvider(modelId);
    return keys[provider] ?? null;
  } catch {
    return null;
  }
}
