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
  /** Provider (anthropic/openai/google) */
  provider: 'anthropic' | 'openai' | 'google';
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
    id: 'claude-haiku-4-5',
    name: 'Claude Haiku 4.5',
    provider: 'anthropic',
    maxTokens: 200000,
    supportsStreaming: true,
    supportsVision: true,
    costTier: 'low',
    description: '200K context. Fastest and most affordable Claude. Great for quick tasks and early branches before context grows.',
  },
  {
    id: 'claude-sonnet-4-5',
    name: 'Claude Sonnet 4.5',
    provider: 'anthropic',
    maxTokens: 200000,
    supportsStreaming: true,
    supportsVision: true,
    costTier: 'medium',
    description: '200K-1M context. Ideal balance of speed and intelligence. Handles 3-4 parent merges with moderate message history.',
  },
  {
    id: 'claude-opus-4-6',
    name: 'Claude Opus 4.6',
    provider: 'anthropic',
    maxTokens: 200000,
    supportsStreaming: true,
    supportsVision: true,
    costTier: 'high',
    description: '200K-1M context. Most capable for complex reasoning and deep branch synthesis. Best for 5-parent merges with rich context.',
  },

  // OpenAI Models
  {
    id: 'gpt-5-mini',
    name: 'GPT-5 Mini',
    provider: 'openai',
    maxTokens: 128000,
    supportsStreaming: true,
    supportsVision: true,
    costTier: 'low',
    description: '128K context. Fast and affordable for straightforward tasks. Good for shallow branches with focused conversations.',
  },
  {
    id: 'gpt-5.2',
    name: 'GPT-5.2',
    provider: 'openai',
    maxTokens: 128000,
    supportsStreaming: true,
    supportsVision: true,
    costTier: 'medium',
    description: '128K context. OpenAI flagship model. Balanced for 2-3 parent merges with 20-30 messages per branch.',
  },

  // Google Gemini Models
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'google',
    maxTokens: 1000000,
    supportsStreaming: true,
    supportsVision: true,
    costTier: 'low',
    description: '1M context. Excellent price-performance for deep branching. Handles 4-5 parent merges with 30+ messages each at low cost.',
  },
  {
    id: 'gemini-3-flash',
    name: 'Gemini 3 Flash',
    provider: 'google',
    maxTokens: 2000000,
    supportsStreaming: true,
    supportsVision: true,
    costTier: 'medium',
    description: '2M context. Largest context window available. Ideal for maximum branching depth—5 parents with 50+ messages each. FREE tier available.',
  },
];

/**
 * Get models available based on configured API keys
 */
export function getAvailableModels(
  hasAnthropicKey: boolean,
  hasOpenAIKey: boolean,
  hasGoogleKey: boolean = false
): ModelDefinition[] {
  return AVAILABLE_MODELS.filter((model) => {
    if (model.provider === 'anthropic') return hasAnthropicKey;
    if (model.provider === 'openai') return hasOpenAIKey;
    if (model.provider === 'google') return hasGoogleKey;
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
export function getDefaultModel(provider: 'anthropic' | 'openai' | 'google'): ModelDefinition {
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
export function detectProvider(modelId: string): 'anthropic' | 'openai' | 'google' {
  if (modelId.startsWith('claude') || modelId.startsWith('anthropic')) {
    return 'anthropic';
  }
  if (modelId.startsWith('gpt') || modelId.startsWith('o1') || modelId.startsWith('o3')) {
    return 'openai';
  }
  if (modelId.startsWith('gemini')) {
    return 'google';
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
  suggestion?: 'check_api_key' | 'add_api_key';
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
  action: 'openSettings' | 'retry';
} | null {
  switch (suggestion) {
    case 'check_api_key':
    case 'add_api_key':
      return { label: 'Open Settings', action: 'openSettings' };
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
  'claude-haiku-4-5': { input: 1, output: 5 },
  'claude-sonnet-4-5': { input: 3, output: 15 },
  'claude-opus-4-6': { input: 5, output: 25 },
  'gpt-5-mini': { input: 0.25, output: 2 },
  'gpt-5.2': { input: 1.75, output: 14 },
  'gemini-2.5-flash': { input: 0.30, output: 2.50 },
  'gemini-3-flash': { input: 0.50, output: 3.00 },
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
