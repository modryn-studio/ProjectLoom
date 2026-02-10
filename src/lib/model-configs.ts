/**
 * Per-Model Configuration
 * 
 * Tuned settings for each supported model to match their official
 * app behavior as closely as possible. Temperature, maxTokens, and
 * optional system prompts are configured per model ID.
 * 
 * Philosophy:
 * - By default: pure model behavior (no injected system prompts)
 * - Canvas context (instructions / knowledge base) is layered on top
 *   only when the user configures it
 * - User controls personality, not us
 * 
 * @version 1.0.0
 */

// =============================================================================
// TYPES
// =============================================================================

export interface ModelConfig {
  /** Sampling temperature. Anthropic defaults to 1.0, OpenAI to ~0.7 */
  temperature: number;
  /** Max output tokens for the response */
  maxTokens: number;
  /** Optional baseline system prompt — undefined = let the model be itself */
  systemPrompt: string | undefined;
}

// =============================================================================
// PER-MODEL CONFIGS
// =============================================================================

export const MODEL_CONFIGS: Record<string, ModelConfig> = {
  // ── Anthropic Models ──────────────────────────────────────────────────────
  'claude-opus-4-6': {
    temperature: 1.0,         // Anthropic's default
    maxTokens: 8192,
    systemPrompt: undefined,  // Let Claude be Claude
  },
  'claude-sonnet-4-5': {
    temperature: 1.0,
    maxTokens: 8192,
    systemPrompt: undefined,
  },
  'claude-haiku-4-5': {
    temperature: 1.0,
    maxTokens: 8192,
    systemPrompt: undefined,
  },

  // ── OpenAI Models ─────────────────────────────────────────────────────────
  'gpt-5.2': {
    temperature: 0.7,         // OpenAI's balanced default
    maxTokens: 16384,
    systemPrompt: undefined,
  },
  'gpt-5-mini': {
    temperature: 1.0,         // Only temperature: 1 supported for this model
    maxTokens: 8192,
    systemPrompt: undefined,
  },
  'gpt-5-nano': {
    temperature: 1.0,         // Only temperature: 1 supported for this model
    maxTokens: 4096,
    systemPrompt: undefined,
  },
  'gpt-4.1': {
    temperature: 0.7,
    maxTokens: 8192,
    systemPrompt: undefined,
  },
  'gpt-4.1-mini': {
    temperature: 0.7,
    maxTokens: 8192,
    systemPrompt: undefined,
  },
  'gpt-4.1-nano': {
    temperature: 0.7,
    maxTokens: 8192,
    systemPrompt: undefined,
  },
};

// =============================================================================
// FALLBACK
// =============================================================================

/** Used when a model ID isn't in the config map */
export const DEFAULT_MODEL_CONFIG: ModelConfig = {
  temperature: 0.8,
  maxTokens: 8192,
  systemPrompt: undefined,
};

// =============================================================================
// ACCESSOR
// =============================================================================

/**
 * Get the tuned config for a model, falling back to sensible defaults.
 */
export function getModelConfig(modelId: string): ModelConfig {
  return MODEL_CONFIGS[modelId] ?? DEFAULT_MODEL_CONFIG;
}
