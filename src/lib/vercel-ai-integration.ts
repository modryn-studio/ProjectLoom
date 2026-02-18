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
  /** Provider (anthropic/openai/google/perplexity) */
  provider: 'anthropic' | 'openai' | 'google' | 'perplexity';
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
  /** Whether the model has built-in web search */
  hasWebSearch?: boolean;
}

/**
 * Available AI models
 * Updated for Feb 2026 model lineup
 */
export const AVAILABLE_MODELS: ModelDefinition[] = [
  // Anthropic Claude Models (routed via Perplexity Agent API)
  {
    id: 'anthropic/claude-haiku-4-5',
    name: 'Claude Haiku 4.5',
    provider: 'anthropic',
    maxTokens: 200000,
    supportsStreaming: true,
    supportsVision: true,
    costTier: 'low',
    description: '200K context. Fastest and most affordable Claude. Great for quick tasks.',
  },
  {
    id: 'anthropic/claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6',
    provider: 'anthropic',
    maxTokens: 200000,
    supportsStreaming: true,
    supportsVision: true,
    costTier: 'medium',
    description: '200K context. Latest Sonnet. Ideal balance of speed and intelligence.',
  },
  {
    id: 'anthropic/claude-sonnet-4-5',
    name: 'Claude Sonnet 4.5',
    provider: 'anthropic',
    maxTokens: 200000,
    supportsStreaming: true,
    supportsVision: true,
    costTier: 'medium',
    description: '200K context. Previous Sonnet generation.',
  },
  {
    id: 'anthropic/claude-opus-4-5',
    name: 'Claude Opus 4.5',
    provider: 'anthropic',
    maxTokens: 200000,
    supportsStreaming: true,
    supportsVision: true,
    costTier: 'high',
    description: '200K context. Previous Opus generation. High-quality reasoning.',
  },
  {
    id: 'anthropic/claude-opus-4-6',
    name: 'Claude Opus 4.6',
    provider: 'anthropic',
    maxTokens: 200000,
    supportsStreaming: true,
    supportsVision: true,
    costTier: 'high',
    description: '200K context. Most capable Claude for complex reasoning.',
  },

  // OpenAI Models (routed via Perplexity Agent API)
  {
    id: 'openai/gpt-5-mini',
    name: 'GPT-5 Mini',
    provider: 'openai',
    maxTokens: 128000,
    supportsStreaming: true,
    supportsVision: true,
    costTier: 'low',
    description: '128K context. Most cost-efficient OpenAI model.',
  },
  {
    id: 'openai/gpt-5.2',
    name: 'GPT-5.2',
    provider: 'openai',
    maxTokens: 128000,
    supportsStreaming: true,
    supportsVision: true,
    costTier: 'medium',
    description: '128K context. Latest OpenAI flagship model.',
  },

  // Google Gemini Models (routed via Perplexity Agent API)
  {
    id: 'google/gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'google',
    maxTokens: 1000000,
    supportsStreaming: true,
    supportsVision: true,
    costTier: 'low',
    description: '1M context. Excellent speed and value.',
  },
  {
    id: 'google/gemini-3-flash-preview',
    name: 'Gemini 3 Flash',
    provider: 'google',
    maxTokens: 2000000,
    supportsStreaming: true,
    supportsVision: true,
    costTier: 'medium',
    description: '2M context. Largest context window available.',
  },

  // Perplexity Sonar Model (native, built-in web search)
  {
    id: 'perplexity/sonar',
    name: 'Sonar',
    provider: 'perplexity',
    maxTokens: 128000,
    supportsStreaming: true,
    supportsVision: false,
    costTier: 'low',
    hasWebSearch: true,
    description: 'Real-time web search with AI synthesis.',
  },
];

/**
 * Get models available based on configured API keys.
 * All models route through the Perplexity Agent API — a single key unlocks everything.
 */
export function getAvailableModels(
  hasPerplexityKey: boolean
): ModelDefinition[] {
  return hasPerplexityKey ? [...AVAILABLE_MODELS] : [];
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
export function getDefaultModel(provider: 'anthropic' | 'openai' | 'google' | 'perplexity'): ModelDefinition {
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
 * Detect the underlying provider from a model ID.
 * Model IDs use the Perplexity Agent API prefix format: 'provider/model-name'.
 * Sonar models are native Perplexity and use bare names.
 */
export function detectProvider(modelId: string): 'anthropic' | 'openai' | 'google' | 'perplexity' {
  // Prefixed format: 'anthropic/claude-...', 'openai/gpt-...', 'google/gemini-...', 'perplexity/sonar'
  if (modelId.startsWith('anthropic/')) return 'anthropic';
  if (modelId.startsWith('openai/')) return 'openai';
  if (modelId.startsWith('google/')) return 'google';
  if (modelId.startsWith('perplexity/')) return 'perplexity';
  // Sonar models are native Perplexity (bare name - legacy)
  if (modelId.startsWith('sonar')) return 'perplexity';
  // Legacy bare model IDs (backwards compat)
  if (modelId.startsWith('claude')) return 'anthropic';
  if (modelId.startsWith('gpt') || modelId.startsWith('o1') || modelId.startsWith('o3')) return 'openai';
  if (modelId.startsWith('gemini')) return 'google';
  return 'perplexity';
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
 * Cost per 1M tokens (input/output) by model ID.
 * Pricing via Perplexity Agent API — pass-through at direct provider rates, no markup.
 * Source: https://docs.perplexity.ai/docs/agent-api/models
 *
 * NOTE: These are estimates based on actual token consumption.
 * Gemini models offer 90% cache read discounts (not reflected here).
 * Sonar models also incur per-request search fees ($0.005/search).
 * Check your Perplexity dashboard for exact billing.
 */
export const MODEL_PRICING = {
  // Anthropic Claude (via Perplexity Agent API)
  'anthropic/claude-haiku-4-5': { input: 1, output: 5 },
  'anthropic/claude-sonnet-4-5': { input: 3, output: 15 },
  'anthropic/claude-sonnet-4-6': { input: 3, output: 15 },
  'anthropic/claude-opus-4-6': { input: 5, output: 25 },

  // OpenAI (via Perplexity Agent API)
  'openai/gpt-5-mini': { input: 0.25, output: 2 },
  'openai/gpt-5.2': { input: 1.75, output: 14 },

  // Google Gemini (via Perplexity Agent API) — 90% cache discount available
  'google/gemini-2.5-flash': { input: 0.30, output: 2.50 },
  'google/gemini-3-flash-preview': { input: 0.50, output: 3.00 },

  // Perplexity Sonar (native — built-in web search)
  'perplexity/sonar': { input: 0.25, output: 2.50 },
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
