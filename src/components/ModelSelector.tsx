'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check, Key, Lock } from 'lucide-react';

import { colors, typography, spacing, effects } from '@/lib/design-tokens';
import { apiKeyManager } from '@/lib/api-key-manager';
import { useTrialStore, selectIsTrialActive } from '@/stores/trial-store';
import { 
  AVAILABLE_MODELS, 
  getModelById,
  getCostTierInfo,
  type ModelDefinition,
} from '@/lib/vercel-ai-integration';

// =============================================================================
// MODEL SELECTOR COMPONENT
// =============================================================================

interface ModelSelectorProps {
  /** Currently selected model ID */
  currentModel: string | null;
  /** Callback when model is changed */
  onModelChange: (modelId: string) => void;
  /** Whether any API key is configured */
  hasApiKey?: boolean;
  /** Compact mode for smaller spaces */
  compact?: boolean;
}

export function ModelSelector({
  currentModel,
  onModelChange,
  hasApiKey = true,
  compact = false,
}: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [trialPopoverModel, setTrialPopoverModel] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isTrialActive = useTrialStore(selectIsTrialActive);
  const TRIAL_MODEL_ID = 'openai/gpt-5-mini';

  // Check which providers have API keys configured
  const hasAnthropicKey = useMemo(() => {
    return !!apiKeyManager.getKey('anthropic');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const hasOpenaiKey = useMemo(() => {
    return !!apiKeyManager.getKey('openai');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const hasAnyKey = hasAnthropicKey || hasOpenaiKey;

  // Get current model info
  const currentModelInfo = useMemo(() => {
    if (!currentModel) return null;
    return getModelById(currentModel);
  }, [currentModel]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside as EventListener);
      document.addEventListener('touchstart', handleClickOutside as EventListener);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside as EventListener);
      document.removeEventListener('touchstart', handleClickOutside as EventListener);
    };
  }, [isOpen]);

  // Handle model selection
  const handleSelect = useCallback((modelId: string) => {
    // In trial mode, only allow the trial model
    if (isTrialActive && modelId !== TRIAL_MODEL_ID) {
      const modelInfo = getModelById(modelId);
      setTrialPopoverModel(modelInfo?.name ?? modelId);
      // Auto-dismiss after 3 seconds
      setTimeout(() => setTrialPopoverModel(null), 3000);
      return;
    }
    setTrialPopoverModel(null);
    onModelChange(modelId);
    setIsOpen(false);
  }, [onModelChange, isTrialActive]);

  // Format display name
  const displayName = currentModelInfo?.name || 'Select Model';
  const costInfo = currentModelInfo ? getCostTierInfo(currentModelInfo.costTier) : null;

  return (
    <div ref={dropdownRef} style={styles.container}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={!hasApiKey}
        style={{
          ...styles.trigger,
          ...(compact ? styles.triggerCompact : {}),
          opacity: hasApiKey ? 1 : 0.5,
          cursor: hasApiKey ? 'pointer' : 'not-allowed',
        }}
        title={hasApiKey ? 'Select AI model' : 'Configure API key first'}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span style={styles.modelName}>{displayName}</span>
        {costInfo && (
          <span style={{ ...styles.costBadge, color: costInfo.color }}>
            {costInfo.label}
          </span>
        )}
        <ChevronDown 
          size={14} 
          style={{ 
            ...styles.chevron,
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          }} 
        />
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            style={styles.dropdown}
            role="listbox"
          >
            {isTrialActive ? (
              /* Trial mode: show all models, lock icon on non-trial ones */
              <>
                {AVAILABLE_MODELS.map((model, idx) => (
                  <React.Fragment key={model.id}>
                    {idx > 0 && AVAILABLE_MODELS[idx - 1].provider !== model.provider && (
                      <div style={styles.divider} />
                    )}
                    <ModelOption
                      model={model}
                      isSelected={model.id === currentModel}
                      onSelect={handleSelect}
                      locked={model.id !== TRIAL_MODEL_ID}
                    />
                  </React.Fragment>
                ))}
              </>
            ) : (
              /* BYOK mode: existing behavior — show models for configured providers */
              <>
                {/* Anthropic Models */}
                {(hasAnthropicKey || (!hasAnyKey && hasApiKey)) && (
                  <>
                    {AVAILABLE_MODELS
                      .filter(m => m.provider === 'anthropic')
                      .map(model => (
                        <ModelOption
                          key={model.id}
                          model={model}
                          isSelected={model.id === currentModel}
                          onSelect={handleSelect}
                        />
                      ))}
                  </>
                )}

                {/* Divider between providers */}
                {(hasAnthropicKey || (!hasAnyKey && hasApiKey)) && (hasOpenaiKey || (!hasAnyKey && hasApiKey)) && (
                  <div style={styles.divider} />
                )}

                {/* OpenAI Models */}
                {(hasOpenaiKey || (!hasAnyKey && hasApiKey)) && (
                  <>
                    {AVAILABLE_MODELS
                      .filter(m => m.provider === 'openai')
                      .map(model => (
                        <ModelOption
                          key={model.id}
                          model={model}
                          isSelected={model.id === currentModel}
                          onSelect={handleSelect}
                        />
                      ))}
                  </>
                )}

                {/* No key configured */}
                {!hasAnyKey && !hasApiKey && (
                  <div style={styles.noKeys}>
                    <Key size={16} />
                    <span>Configure API keys in Settings</span>
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Trial mode popover — shown when user taps a locked model */}
      <AnimatePresence>
        {trialPopoverModel && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            style={styles.trialPopover}
          >
            <Lock size={12} />
            <span style={styles.trialPopoverText}>Add your API key to use {trialPopoverModel}</span>
            <button
              type="button"
              onClick={() => {
                setTrialPopoverModel(null);
                window.dispatchEvent(new Event('projectloom:requestAPIKeySetup'));
              }}
              style={styles.trialPopoverLink}
            >
              Add key →
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// =============================================================================
// MODEL OPTION COMPONENT
// =============================================================================

interface ModelOptionProps {
  model: ModelDefinition;
  isSelected: boolean;
  onSelect: (modelId: string) => void;
  locked?: boolean;
}

function ModelOption({ model, isSelected, onSelect, locked = false }: ModelOptionProps) {
  const costInfo = getCostTierInfo(model.costTier);

  return (
    <button
      type="button"
      onClick={() => onSelect(model.id)}
      title={locked ? `Add your API key to use ${model.name}` : model.description}
      style={{
        ...styles.option,
        backgroundColor: isSelected ? 'var(--accent-muted)' : 'transparent',
        opacity: locked ? 0.6 : 1,
      }}
      role="option"
      aria-selected={isSelected}
    >
      <div style={styles.optionContent}>
        <div style={styles.optionHeader}>
          <span style={styles.optionName}>{model.name}</span>
          {locked ? (
            <Lock size={12} style={{ color: colors.fg.tertiary, flexShrink: 0 }} />
          ) : (
            <span style={{ ...styles.costBadge, color: costInfo.color }}>
              {costInfo.label}
            </span>
          )}
        </div>
      </div>
      {isSelected && !locked && (
        <Check size={14} style={{ color: colors.accent.primary, flexShrink: 0 }} />
      )}
    </button>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'relative',
  },

  trigger: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[2],
    padding: `${spacing[1]} ${spacing[2]}`,
    backgroundColor: 'var(--accent-muted)',
    border: '1px solid var(--border-primary)',
    borderRadius: effects.border.radius.default,
    color: colors.fg.primary,
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.body,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },

  triggerCompact: {
    padding: `2px ${spacing[1]}`,
    fontSize: typography.sizes.xs,
  },

  modelName: {
    fontWeight: typography.weights.medium,
  },

  costBadge: {
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.code,
    fontWeight: typography.weights.semibold,
  },

  chevron: {
    transition: 'transform 0.15s ease',
    color: colors.fg.secondary,
  },

  dropdown: {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    right: 0,
    minWidth: 280,
    marginBottom: spacing[1],
    backgroundColor: colors.bg.inset,
    border: '1px solid var(--border-primary)',
    borderRadius: effects.border.radius.default,
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
    zIndex: 50,
    overflow: 'hidden',
  } as React.CSSProperties,

  divider: {
    height: '1px',
    backgroundColor: 'var(--border-secondary)',
    margin: `${spacing[1]} 0`,
  } as React.CSSProperties,

  option: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[2],
    width: '100%',
    padding: `${spacing[2]} ${spacing[3]}`,
    border: 'none',
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'background-color 0.1s ease',
  } as React.CSSProperties,

  optionContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  } as React.CSSProperties,

  optionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[2],
  },

  optionName: {
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.body,
    color: colors.fg.primary,
    fontWeight: typography.weights.medium,
  },

  noKeys: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    padding: spacing[4],
    color: colors.fg.secondary,
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.body,
  },

  trialPopover: {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    right: 'auto',
    width: 'min(340px, calc(100vw - 24px))',
    minWidth: 260,
    marginBottom: spacing[1],
    padding: `${spacing[2]} ${spacing[3]}`,
    backgroundColor: colors.bg.inset,
    border: '1px solid var(--border-primary)',
    borderRadius: effects.border.radius.default,
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
    zIndex: 51,
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing[2],
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.body,
    color: colors.fg.secondary,
  } as React.CSSProperties,

  trialPopoverText: {
    flex: 1,
    minWidth: 0,
    lineHeight: 1.35,
    whiteSpace: 'normal',
  } as React.CSSProperties,

  trialPopoverLink: {
    color: colors.accent.primary,
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.body,
    fontWeight: typography.weights.medium,
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    padding: 0,
    whiteSpace: 'nowrap',
    textDecoration: 'underline',
    textUnderlineOffset: '2px',
  } as React.CSSProperties,
};

export default ModelSelector;
