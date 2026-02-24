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
 * Updated for Feb 2026 model lineup (Sonnet 4.6 — Feb 17, 2026)
 */
export const AVAILABLE_MODELS: ModelDefinition[] = [
  // ── Anthropic Claude (direct API via @ai-sdk/anthropic) ───────────────────
  {
    id: 'anthropic/claude-haiku-4-5',
    name: 'Claude Haiku 4.5',
    provider: 'anthropic',
    maxTokens: 200000,
    supportsStreaming: true,
    supportsVision: true,
    costTier: 'low',
    description: '200K context. Fastest and most affordable Claude.',
  },
  {
    id: 'anthropic/claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6',
    provider: 'anthropic',
    maxTokens: 200000,
    supportsStreaming: true,
    supportsVision: true,
    costTier: 'medium',
    description: '200K context. Best balance of speed, intelligence, and cost.',
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

  // ── OpenAI (direct API via @ai-sdk/openai) ───────────────────────────────
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
    costTier: 'high',
    description: '128K context. Latest OpenAI flagship model.',
  },
  {
    id: 'openai/gpt-5.1',
    name: 'GPT-5.1',
    provider: 'openai',
    maxTokens: 128000,
    supportsStreaming: true,
    supportsVision: true,
    costTier: 'medium',
    description: '128K context. Balanced OpenAI model between mini and flagship.',
  },
];

/**
 * Get models available based on configured API keys.
 * Each provider requires its own key.
 */
export function getAvailableModels(
  keys: { anthropic?: boolean; openai?: boolean }
): ModelDefinition[] {
  return AVAILABLE_MODELS.filter((m) => {
    if (m.provider === 'anthropic') return keys.anthropic;
    if (m.provider === 'openai') return keys.openai;
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
 * Detect the underlying provider from a model ID.
 * Model IDs use the 'provider/model-name' format.
 */
export function detectProvider(modelId: string): 'anthropic' | 'openai' {
  if (modelId.startsWith('anthropic/')) return 'anthropic';
  if (modelId.startsWith('openai/')) return 'openai';
  // Legacy bare model IDs
  if (modelId.startsWith('claude')) return 'anthropic';
  if (modelId.startsWith('gpt') || modelId.startsWith('o1') || modelId.startsWith('o3') || modelId.startsWith('o4')) return 'openai';
  // Default to anthropic for unknown
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
 * Cost per 1M tokens (input/output) by model ID.
 * Direct provider pricing via @ai-sdk/anthropic and @ai-sdk/openai.
 */
export const MODEL_PRICING = {
  // Anthropic Claude (direct API)
  'anthropic/claude-haiku-4-5': { input: 1, output: 5 },
  'anthropic/claude-sonnet-4-6': { input: 3, output: 15 },
  'anthropic/claude-opus-4-6': { input: 5, output: 25 },

  // OpenAI (direct API)
  'openai/gpt-5-mini': { input: 0.25, output: 2 },
  'openai/gpt-5.2': { input: 1.75, output: 14 },
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
