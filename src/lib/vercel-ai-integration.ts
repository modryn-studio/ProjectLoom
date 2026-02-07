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
 * Updated for 2025/2026 model lineup
 */
export const AVAILABLE_MODELS: ModelDefinition[] = [
  // Anthropic Claude Models
  {
    id: 'claude-opus-4-20250514',
    name: 'Claude Opus 4',
    provider: 'anthropic',
    maxTokens: 200000,
    supportsStreaming: true,
    supportsVision: true,
    costTier: 'high',
    description: 'Most capable, best for complex reasoning',
  },
  {
    id: 'claude-sonnet-4-20250514',
    name: 'Claude Sonnet 4',
    provider: 'anthropic',
    maxTokens: 200000,
    supportsStreaming: true,
    supportsVision: true,
    costTier: 'medium',
    description: 'Balanced performance and cost',
  },
  {
    id: 'claude-haiku-4-20250514',
    name: 'Claude Haiku 4',
    provider: 'anthropic',
    maxTokens: 200000,
    supportsStreaming: true,
    supportsVision: true,
    costTier: 'low',
    description: 'Fast and economical',
  },
  
  // OpenAI Models
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    maxTokens: 128000,
    supportsStreaming: true,
    supportsVision: true,
    costTier: 'medium',
    description: 'OpenAI\'s flagship multimodal model',
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    maxTokens: 128000,
    supportsStreaming: true,
    supportsVision: true,
    costTier: 'low',
    description: 'Fast and affordable',
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
 * Approximate cost per 1K tokens (input) by model ID.
 * These are rough estimates for user-facing cost previews.
 */
const COST_PER_1K_INPUT: Record<string, number> = {
  'claude-opus-4-20250514': 0.015,
  'claude-sonnet-4-20250514': 0.003,
  'claude-haiku-4-20250514': 0.0008,
  'gpt-4o': 0.0025,
  'gpt-4o-mini': 0.00015,
};

const COST_PER_1K_OUTPUT: Record<string, number> = {
  'claude-opus-4-20250514': 0.075,
  'claude-sonnet-4-20250514': 0.015,
  'claude-haiku-4-20250514': 0.004,
  'gpt-4o': 0.01,
  'gpt-4o-mini': 0.0006,
};

/**
 * Estimate cost for a given number of input tokens.
 * Returns cost in USD. Useful for showing cost previews before API calls.
 */
export function estimateCost(
  inputTokens: number,
  outputTokens: number,
  modelId: string
): number {
  const inputRate = COST_PER_1K_INPUT[modelId] ?? 0.003; // default to Sonnet
  const outputRate = COST_PER_1K_OUTPUT[modelId] ?? 0.015;
  return (inputTokens / 1000) * inputRate + (outputTokens / 1000) * outputRate;
}

/**
 * Format cost as human-readable string (e.g., "~$0.03")
 */
export function formatCost(cost: number): string {
  if (cost < 0.001) return '<$0.01';
  return `~$${cost.toFixed(2)}`;
}
