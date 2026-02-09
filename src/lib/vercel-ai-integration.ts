/**
 * Vercel AI SDK Integration
 * 
 * Wrapper utilities for Vercel AI SDK integration, including
 * model definitions, provider detection, and helper functions.
 * 
 * @version 1.0.0
 */

// =============================================================================
// MODEL DEFINITIONS
// =============================================================================

export interface ModelDefinition {
  /** Model ID used in API calls */
  id: string;
  /** Human-readable display name */
  name: string;
  /** Provider (anthropic/openai) */
  provider: 'anthropic' | 'openai';
  /** Maximum context tokens */
  maxTokens: number;
  /** Whether streaming is supported */
  supportsStreaming: boolean;
  /** Whether vision (image) is supported */
  supportsVision: boolean;
  /** Relative cost tier for UI indication */
  costTier: 'low' | 'medium' | 'high';
  /** Brief description for UI */
  description: string;
}

/**
 * Available AI models
 * Updated for Feb 2026 model lineup
 */
export const AVAILABLE_MODELS: ModelDefinition[] = [
  // Anthropic Claude Models
  {
    id: 'claude-opus-4-6',
    name: 'Claude Opus 4.6',
    provider: 'anthropic',
    maxTokens: 200000,
    supportsStreaming: true,
    supportsVision: true,
    costTier: 'high',
    description: 'Most intelligent for agents and coding (200K context; 1M beta)',
  },
  {
    id: 'claude-sonnet-4-5',
    name: 'Claude Sonnet 4.5',
    provider: 'anthropic',
    maxTokens: 200000,
    supportsStreaming: true,
    supportsVision: true,
    costTier: 'medium',
    description: 'Best balance of speed and intelligence (200K context; 1M beta)',
  },
  {
    id: 'claude-haiku-4-5',
    name: 'Claude Haiku 4.5',
    provider: 'anthropic',
    maxTokens: 200000,
    supportsStreaming: true,
    supportsVision: true,
    costTier: 'low',
    description: 'Fastest model with near-frontier intelligence',
  },

  // OpenAI Models
  {
    id: 'gpt-5.2',
    name: 'GPT-5.2',
    provider: 'openai',
    maxTokens: 400000,
    supportsStreaming: true,
    supportsVision: true,
    costTier: 'medium',
    description: 'Flagship for coding and agentic tasks across industries',
  },
  {
    id: 'gpt-5.2-pro',
    name: 'GPT-5.2 Pro',
    provider: 'openai',
    maxTokens: 400000,
    supportsStreaming: true,
    supportsVision: true,
    costTier: 'high',
    description: 'Harder-thinking variant for the most demanding problems',
  },
  {
    id: 'gpt-5-mini',
    name: 'GPT-5 Mini',
    provider: 'openai',
    maxTokens: 400000,
    supportsStreaming: true,
    supportsVision: true,
    costTier: 'low',
    description: 'Cost-optimized reasoning and chat for well-defined tasks',
  },
  {
    id: 'gpt-5-nano',
    name: 'GPT-5 Nano',
    provider: 'openai',
    maxTokens: 400000,
    supportsStreaming: true,
    supportsVision: true,
    costTier: 'low',
    description: 'High-throughput model for simple tasks and classification',
  },
  {
    id: 'gpt-4.1',
    name: 'GPT-4.1',
    provider: 'openai',
    maxTokens: 1047576,
    supportsStreaming: true,
    supportsVision: true,
    costTier: 'medium',
    description: 'Smartest non-reasoning model with 1M token context',
  },
];

/**
 * Get models available based on configured API keys
 */
export function getAvailableModels(
  hasAnthropicKey: boolean,
  hasOpenAIKey: boolean
): ModelDefinition[] {
  return AVAILABLE_MODELS.filter((model) => {
    if (model.provider === 'anthropic') return hasAnthropicKey;
    if (model.provider === 'openai') return hasOpenAIKey;
    return false;
  });
}

/**
 * Get a specific model by ID
 */
export function getModelById(id: string): ModelDefinition | undefined {
  return AVAILABLE_MODELS.find((model) => model.id === id);
}

/**
 * Get the default model for a provider
 */
export function getDefaultModel(provider: 'anthropic' | 'openai'): ModelDefinition {
  const models = AVAILABLE_MODELS.filter((m) => m.provider === provider);
  if (models.length === 0) {
    if (AVAILABLE_MODELS.length === 0) {
      throw new Error('No models are available. Check AVAILABLE_MODELS configuration.');
    }
    return AVAILABLE_MODELS[0];
  }
  // Prefer the medium cost tier as default (balanced)
  const medium = models.find((m) => m.costTier === 'medium');
  return medium || models[0];
}

/**
 * Detect provider from model ID
 */
export function detectProvider(modelId: string): 'anthropic' | 'openai' {
  if (modelId.startsWith('claude') || modelId.startsWith('anthropic')) {
    return 'anthropic';
  }
  if (modelId.startsWith('gpt') || modelId.startsWith('o1') || modelId.startsWith('o3')) {
    return 'openai';
  }
  // Default to anthropic
  return 'anthropic';
}

// =============================================================================
// TOKEN ESTIMATION
// =============================================================================

/**
 * Rough token estimation (4 chars per token average)
 * This is a simple heuristic, not exact
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Estimate tokens for a message array
 */
export function estimateMessagesTokens(
  messages: Array<{ content: string }>
): number {
  return messages.reduce((sum, msg) => sum + estimateTokens(msg.content), 0);
}

/**
 * Get cost tier display info
 */
export function getCostTierInfo(tier: 'low' | 'medium' | 'high'): {
  label: string;
  color: string;
} {
  switch (tier) {
    case 'low':
      return { label: '$', color: '#10b981' }; // emerald
    case 'medium':
      return { label: '$$', color: '#f59e0b' }; // amber
    case 'high':
      return { label: '$$$', color: '#ef4444' }; // red
  }
}

// =============================================================================
// ERROR TYPES
// =============================================================================

export interface AIErrorResponse {
  error: string;
  code: string;
  recoverable: boolean;
  retryAfter?: number;
  suggestion?: 'check_api_key' | 'use_summary' | 'add_api_key';
}

/**
 * Check if a response is an error
 */
export function isAIError(response: unknown): response is AIErrorResponse {
  return (
    typeof response === 'object' &&
    response !== null &&
    'error' in response &&
    'code' in response
  );
}

/**
 * Get user-friendly action for an error suggestion
 */
export function getErrorAction(suggestion: AIErrorResponse['suggestion']): {
  label: string;
  action: 'openSettings' | 'useSummary' | 'retry';
} | null {
  switch (suggestion) {
    case 'check_api_key':
    case 'add_api_key':
      return { label: 'Open Settings', action: 'openSettings' };
    case 'use_summary':
      return { label: 'Use AI Summary', action: 'useSummary' };
    default:
      return null;
  }
}

// =============================================================================
// COST ESTIMATION
// =============================================================================

/**
 * Approximate cost per 1M tokens (input/output) by model ID.
 * Used for both previews and usage tracking.
 */
export const MODEL_PRICING = {
  'claude-opus-4-6': { input: 5, output: 25 },
  'claude-sonnet-4-5': { input: 3, output: 15 },
  'claude-haiku-4-5': { input: 1, output: 5 },
  'gpt-5.2': { input: 1.75, output: 14 },
  'gpt-5.2-pro': { input: 21, output: 168 },
  'gpt-5-mini': { input: 0.25, output: 2 },
  'gpt-5-nano': { input: 0.05, output: 0.4 },
  'gpt-4.1': { input: 2, output: 8 },
  'text-embedding-3-small': { input: 0.02, output: 0 },
} as const;

const DEFAULT_PRICING = { input: 3, output: 15 };

/**
 * Calculate cost in USD based on per-1M token pricing.
 */
export function calculateCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = MODEL_PRICING[modelId as keyof typeof MODEL_PRICING] ?? DEFAULT_PRICING;
  return (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;
}

/**
 * Estimate cost for a given number of input tokens.
 * Returns cost in USD. Useful for showing cost previews before API calls.
 */
export function estimateCost(
  inputTokens: number,
  outputTokens: number,
  modelId: string
): number {
  return calculateCost(modelId, inputTokens, outputTokens);
}

/**
 * Format cost as human-readable string (e.g., "~$0.03")
 */
export function formatCost(cost: number): string {
  if (cost < 0.001) return '<$0.01';
  return `~$${cost.toFixed(2)}`;
}
