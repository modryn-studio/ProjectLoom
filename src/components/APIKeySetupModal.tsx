'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Key, AlertCircle, CheckCircle, Loader, ExternalLink } from 'lucide-react';

import { colors, typography, spacing, effects, animation } from '@/lib/design-tokens';
import { apiKeyManager, type ProviderType, type StorageType } from '@/lib/api-key-manager';

// =============================================================================
// API KEY SETUP MODAL
// =============================================================================

interface APIKeySetupModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Called when modal is closed */
  onClose: () => void;
  /** Called when keys are successfully saved */
  onSuccess?: () => void;
}

interface KeyState {
  value: string;
  isValid: boolean | null;
  isValidating: boolean;
  error: string | null;
}

const INITIAL_KEY_STATE: KeyState = {
  value: '',
  isValid: null,
  isValidating: false,
  error: null,
};

export function APIKeySetupModal({ isOpen, onClose, onSuccess }: APIKeySetupModalProps) {
  const [perplexityKey, setPerplexityKey] = useState<KeyState>(INITIAL_KEY_STATE);
  const [isSaving, setIsSaving] = useState(false);
  const [storagePreference, setStoragePreference] = useState<StorageType>('localStorage');
  const overlayMouseDownRef = useRef(false);

  // Load existing key and storage preference on mount
  useEffect(() => {
    if (isOpen) {
      const existingPerplexity = apiKeyManager.getKey('perplexity');
      const currentStoragePreference = apiKeyManager.getStoragePreference();

      if (existingPerplexity) {
        setPerplexityKey(prev => ({ ...prev, value: existingPerplexity, isValid: true }));
      }
      setStoragePreference(currentStoragePreference);
    }
  }, [isOpen]);

  // Validate API key format
  const validateKeyFormat = (key: string, provider: ProviderType): string | null => {
    if (!key.trim()) return null; // Empty is allowed
    
    if (provider === 'anthropic') {
      if (!key.startsWith('sk-ant-')) {
        return 'Anthropic keys start with "sk-ant-"';
      }
    } else if (provider === 'openai') {
      if (!key.startsWith('sk-')) {
        return 'OpenAI keys start with "sk-"';
      }
    } else if (provider === 'google') {
      if (!key.startsWith('AIza')) {
        return 'Google keys start with "AIza"';
      }
    } else if (provider === 'perplexity') {
      if (!key.startsWith('pplx-')) {
        return 'Perplexity keys start with "pplx-"';
      }
    }
    
    if (key.length < 20) {
      return 'API key appears too short';
    }
    
    return null;
  };

  // Handle key input change
  const handleKeyChange = useCallback((
    provider: ProviderType,
    value: string,
    setState: React.Dispatch<React.SetStateAction<KeyState>>
  ) => {
    const formatError = validateKeyFormat(value, provider);
    
    setState({
      value,
      isValid: value.trim() ? (formatError ? false : null) : null,
      isValidating: false,
      error: formatError,
    });
  }, []);

  // Test API key (light validation - just format check for now)
  const validateKey = useCallback(async (
    provider: ProviderType,
    key: string,
    setState: React.Dispatch<React.SetStateAction<KeyState>>
  ): Promise<boolean> => {
    if (!key.trim()) return true; // Empty is valid (optional)
    
    const formatError = validateKeyFormat(key, provider);
    if (formatError) {
      setState(prev => ({ ...prev, isValid: false, error: formatError }));
      return false;
    }
    
    // For now, just validate format - real validation would hit the API
    setState(prev => ({ ...prev, isValid: true, error: null }));
    return true;
  }, []);

  // Handle save
  const handleSave = useCallback(async () => {
    setIsSaving(true);

    try {
      // Validate key
      const perplexityValid = await validateKey('perplexity', perplexityKey.value, setPerplexityKey);

      if (!perplexityValid) {
        setIsSaving(false);
        return;
      }

      // Perplexity key is required — it's the single gateway for all models
      if (!perplexityKey.value.trim()) {
        setPerplexityKey(prev => ({ ...prev, error: 'Perplexity API key is required for all models' }));
        setIsSaving(false);
        return;
      }

      // Set storage preference first
      apiKeyManager.setStoragePreference(storagePreference);

      // Save key
      apiKeyManager.saveKey('perplexity', perplexityKey.value.trim());

      // Mark setup as complete
      if (typeof window !== 'undefined') {
        localStorage.setItem('projectloom:keys-configured', 'true');
      }

      onSuccess?.();
      onClose();
    } finally {
      setIsSaving(false);
    }
  }, [perplexityKey.value, storagePreference, validateKey, onSuccess, onClose]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key === 'Enter') {
        const target = e.target as HTMLElement | null;
        const tagName = target?.tagName?.toLowerCase();
        if (tagName === 'textarea' || tagName === 'select' || tagName === 'button') return;
        if (isSaving) return;
        handleSave();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, handleSave, isSaving]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={styles.overlay}
        onMouseDown={(e) => {
          overlayMouseDownRef.current = e.target === e.currentTarget;
        }}
        onMouseUp={(e) => {
          if (overlayMouseDownRef.current && e.target === e.currentTarget) {
            onClose();
          }
          overlayMouseDownRef.current = false;
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={animation.spring.snappy}
          style={styles.modal}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div style={styles.header}>
            <div style={styles.headerIcon}>
              <Key size={24} />
            </div>
            <div>
              <h2 style={styles.title}>Configure API Keys</h2>
              <p style={styles.subtitle}>
                Add your API keys to enable AI responses
              </p>
            </div>
            <button onClick={onClose} style={styles.closeButton}>
              <X size={18} />
            </button>
          </div>

          {/* Content */}
          <div style={styles.content}>
            {/* Info banner */}
            <div style={styles.infoBanner}>
              <p style={styles.infoText}>
                Get your API key from Perplexity — one key unlocks Claude, GPT, Gemini, and Sonar models:
              </p>
              <p style={{ ...styles.infoText, fontSize: typography.sizes.xs, marginTop: spacing[1], color: colors.fg.tertiary }}>
                (Optional: Add OpenAI key later in Settings for embeddings/knowledge base features)
              </p>
              <div style={styles.links}>
                <a
                  href="https://www.perplexity.ai/settings/api"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ ...styles.link, gridColumn: '1 / -1' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--accent-muted)';
                    e.currentTarget.style.borderColor = colors.accent.primary;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = colors.bg.inset;
                    e.currentTarget.style.borderColor = 'var(--border-primary)';
                  }}
                >
                  <span style={styles.linkText}>Perplexity API Settings</span>
                  <ExternalLink size={18} style={{ flexShrink: 0 }} />
                </a>
              </div>
            </div>

            {/* Storage Preference */}
            <div style={styles.storagePreference}>
              <label style={styles.label}>Storage Type</label>
              <div style={styles.storageOptions}>
                <button
                  type="button"
                  onClick={() => setStoragePreference('localStorage')}
                  style={{
                    ...styles.storageOption,
                    ...(storagePreference === 'localStorage' ? styles.storageOptionActive : {}),
                  }}
                >
                  <div style={styles.storageOptionTitle}>Persistent</div>
                  <div style={styles.storageOptionDesc}>Stays across sessions</div>
                </button>
                <button
                  type="button"
                  onClick={() => setStoragePreference('sessionStorage')}
                  style={{
                    ...styles.storageOption,
                    ...(storagePreference === 'sessionStorage' ? styles.storageOptionActive : {}),
                  }}
                >
                  <div style={styles.storageOptionTitle}>Session Only</div>
                  <div style={styles.storageOptionDesc}>Cleared when tab closes</div>
                </button>
              </div>
            </div>

            {/* Perplexity API Key (single gateway for all models) */}
            <KeyInput
              label="Perplexity API Key"
              placeholder="pplx-..."
              value={perplexityKey.value}
              onChange={(v) => handleKeyChange('perplexity', v, setPerplexityKey)}
              isValid={perplexityKey.isValid}
              isValidating={perplexityKey.isValidating}
              error={perplexityKey.error}
            />
          </div>

          {/* Footer */}
          <div style={styles.footer}>
            <button onClick={onClose} style={styles.cancelButton}>
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              style={{
                ...styles.saveButton,
                opacity: isSaving ? 0.7 : 1,
              }}
            >
              {isSaving ? (
                <>
                  <Loader size={16} className="animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Keys'
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// =============================================================================
// KEY INPUT COMPONENT
// =============================================================================

interface KeyInputProps {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  isValid: boolean | null;
  isValidating: boolean;
  error: string | null;
}

function KeyInput({
  label,
  placeholder,
  value,
  onChange,
  isValid,
  isValidating,
  error,
}: KeyInputProps) {
  const [showKey, setShowKey] = useState(false);

  return (
    <div style={styles.inputGroup}>
      <label style={styles.label}>{label}</label>
      <div style={styles.inputWrapper}>
        <input
          type={showKey ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{
            ...styles.input,
            border: error
              ? '1px solid var(--error-border)'
              : isValid
              ? '1px solid var(--success-border)'
              : '1px solid var(--border-default)',
          }}
        />
        <div style={styles.inputIcons}>
          {isValidating && <Loader size={14} className="animate-spin" />}
          {isValid === true && <CheckCircle size={14} color="var(--success-solid)" />}
          {isValid === false && <AlertCircle size={14} color="var(--error-solid)" />}
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            style={styles.showButton}
          >
            {showKey ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>
      {error && <span style={styles.error}>{error}</span>}
    </div>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'var(--bg-overlay)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },

  modal: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '90vh',
    backgroundColor: colors.bg.secondary,
    borderRadius: effects.border.radius.lg,
    border: '1px solid var(--border-primary)',
    boxShadow: '0 24px 48px rgba(0, 0, 0, 0.3)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  } as React.CSSProperties,

  header: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: spacing[3],
    padding: spacing[4],
    borderBottom: '1px solid var(--border-primary)',
  },

  headerIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 48,
    borderRadius: '50%',
    backgroundColor: 'var(--accent-muted)',
    color: colors.accent.primary,
    flexShrink: 0,
  },

  title: {
    margin: 0,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.fg.primary,
    fontFamily: typography.fonts.heading,
  },

  subtitle: {
    margin: `${spacing[1]} 0 0`,
    fontSize: typography.sizes.sm,
    color: colors.fg.secondary,
    fontFamily: typography.fonts.body,
  },

  closeButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    marginLeft: 'auto',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: effects.border.radius.default,
    color: colors.fg.tertiary,
    cursor: 'pointer',
  },

  content: {
    padding: spacing[4],
    paddingRight: spacing[3],
    display: 'flex',
    flexDirection: 'column',
    gap: spacing[4],
    overflowY: 'auto',
    flex: 1,
  } as React.CSSProperties,

  infoBanner: {
    padding: spacing[3],
    backgroundColor: 'var(--accent-muted)',
    borderRadius: effects.border.radius.default,
    border: '1px solid var(--border-primary)',
  },

  infoText: {
    margin: 0,
    fontSize: typography.sizes.sm,
    color: colors.fg.secondary,
    fontFamily: typography.fonts.body,
    lineHeight: typography.lineHeights.relaxed,
  },

  links: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: spacing[2],
    marginTop: spacing[2],
  },

  link: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
    padding: `${spacing[2]} ${spacing[3]}`,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.fg.primary,
    backgroundColor: colors.bg.inset,
    border: '1px solid var(--border-primary)',
    borderRadius: effects.border.radius.default,
    textDecoration: 'none',
    transition: 'all 0.15s ease',
    cursor: 'pointer',
  } as React.CSSProperties,

  linkText: {
    flex: 1,
    color: colors.accent.secondary,
  },

  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing[1],
  } as React.CSSProperties,

  label: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.fg.primary,
    fontFamily: typography.fonts.body,
  },

  inputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  } as React.CSSProperties,

  input: {
    width: '100%',
    padding: `${spacing[2]} ${spacing[3]}`,
    paddingRight: '80px',
    backgroundColor: colors.bg.inset,
    border: '1px solid var(--border-primary)',
    borderRadius: effects.border.radius.default,
    color: colors.fg.primary,
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.code,
    outline: 'none',
    transition: 'border-color 0.15s ease',
  },

  inputIcons: {
    position: 'absolute',
    right: spacing[2],
    display: 'flex',
    alignItems: 'center',
    gap: spacing[2],
  } as React.CSSProperties,

  showButton: {
    padding: `2px ${spacing[1]}`,
    backgroundColor: 'var(--accent-muted)',
    border: 'none',
    borderRadius: '4px',
    color: colors.accent.secondary,
    fontSize: typography.sizes.xs,
    cursor: 'pointer',
  },

  error: {
    fontSize: typography.sizes.xs,
    color: 'var(--error-fg)',
    fontFamily: typography.fonts.body,
  },

  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: spacing[2],
    padding: spacing[4],
    borderTop: '1px solid var(--border-primary)',
    backgroundColor: colors.bg.inset,
    flexShrink: 0,
  },

  cancelButton: {
    padding: `${spacing[2]} ${spacing[4]}`,
    backgroundColor: 'transparent',
    border: '1px solid var(--border-primary)',
    borderRadius: effects.border.radius.default,
    color: colors.fg.secondary,
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.body,
    cursor: 'pointer',
  },

  saveButton: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[2],
    padding: `${spacing[2]} ${spacing[4]}`,
    backgroundColor: colors.accent.primary,
    border: 'none',
    borderRadius: effects.border.radius.default,
    color: colors.fg.primary,
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.body,
    fontWeight: typography.weights.medium,
    cursor: 'pointer',
  },

  storagePreference: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing[2],
  } as React.CSSProperties,

  storageOptions: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: spacing[2],
  },

  storageOption: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    padding: spacing[3],
    backgroundColor: 'var(--accent-muted)',
    border: '1px solid var(--border-primary)',
    borderRadius: effects.border.radius.default,
    color: colors.fg.secondary,
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.15s ease',
  } as React.CSSProperties,

  storageOptionActive: {
    backgroundColor: 'var(--accent-muted)',
    border: `1px solid ${colors.accent.primary}`,
  },

  storageOptionTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.fg.primary,
    fontFamily: typography.fonts.body,
    marginBottom: spacing[1],
  },

  storageOptionDesc: {
    fontSize: typography.sizes.xs,
    color: colors.fg.secondary,
    fontFamily: typography.fonts.body,
    lineHeight: typography.lineHeights.relaxed,
  },
};

export default APIKeySetupModal;
