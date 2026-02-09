'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check, Key } from 'lucide-react';

import { colors, typography, spacing, effects } from '@/lib/design-tokens';
import { apiKeyManager } from '@/lib/api-key-manager';
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
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Determine which models are available based on API keys
  const { hasAnthropicKey, hasOpenAIKey } = useMemo(() => {
    const anthropicKey = !!apiKeyManager.getKey('anthropic');
    const openaiKey = !!apiKeyManager.getKey('openai');
    
    return {
      hasAnthropicKey: anthropicKey,
      hasOpenAIKey: openaiKey,
    };
  }, []);

  // Get current model info
  const currentModelInfo = useMemo(() => {
    if (!currentModel) return null;
    return getModelById(currentModel);
  }, [currentModel]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handle model selection
  const handleSelect = useCallback((modelId: string) => {
    onModelChange(modelId);
    setIsOpen(false);
  }, [onModelChange]);

  // Format display name
  const displayName = currentModelInfo?.name || 'Select Model';
  const costInfo = currentModelInfo ? getCostTierInfo(currentModelInfo.costTier) : null;

  return (
    <div ref={dropdownRef} style={styles.container}>
      {/* Trigger Button */}
      <button
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
            {/* Anthropic Models */}
            {hasAnthropicKey && (
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
            {hasAnthropicKey && hasOpenAIKey && (
              <div style={styles.divider} />
            )}

            {/* OpenAI Models */}
            {hasOpenAIKey && (
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

            {/* No keys configured */}
            {!hasAnthropicKey && !hasOpenAIKey && (
              <div style={styles.noKeys}>
                <Key size={16} />
                <span>Configure API keys in Settings</span>
              </div>
            )}
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
}

function ModelOption({ model, isSelected, onSelect }: ModelOptionProps) {
  const costInfo = getCostTierInfo(model.costTier);

  return (
    <button
      onClick={() => onSelect(model.id)}
      title={model.description}
      style={{
        ...styles.option,
        backgroundColor: isSelected ? 'var(--accent-muted)' : 'transparent',
      }}
      role="option"
      aria-selected={isSelected}
    >
      <div style={styles.optionContent}>
        <div style={styles.optionHeader}>
          <span style={styles.optionName}>{model.name}</span>
          <span style={{ ...styles.costBadge, color: costInfo.color }}>
            {costInfo.label}
          </span>
        </div>
      </div>
      {isSelected && (
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
    fontWeight: 500,
  },

  costBadge: {
    fontSize: '10px',
    fontFamily: typography.fonts.code,
    fontWeight: 600,
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
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
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
    fontWeight: 500,
  },

  noKeys: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    padding: spacing[4],
    color: colors.fg.quaternary,
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.body,
  },
};

export default ModelSelector;
