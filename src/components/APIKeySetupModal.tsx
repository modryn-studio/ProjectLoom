'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Key, AlertCircle, CheckCircle, Loader, ExternalLink } from 'lucide-react';

import { colors, typography, spacing, effects, animation } from '@/lib/design-tokens';
import { apiKeyManager, type ProviderType } from '@/lib/api-key-manager';
import { detectProvider } from '@/lib/vercel-ai-integration';

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
  const [anthropicKey, setAnthropicKey] = useState<KeyState>(INITIAL_KEY_STATE);
  const [openaiKey, setOpenaiKey] = useState<KeyState>(INITIAL_KEY_STATE);
  const [isSaving, setIsSaving] = useState(false);

  // Load existing keys on mount
  useEffect(() => {
    if (isOpen) {
      const existingAnthropic = apiKeyManager.getKey('anthropic');
      const existingOpenai = apiKeyManager.getKey('openai');
      
      if (existingAnthropic) {
        setAnthropicKey(prev => ({ ...prev, value: existingAnthropic, isValid: true }));
      }
      if (existingOpenai) {
        setOpenaiKey(prev => ({ ...prev, value: existingOpenai, isValid: true }));
      }
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
      // Validate both keys
      const anthropicValid = await validateKey('anthropic', anthropicKey.value, setAnthropicKey);
      const openaiValid = await validateKey('openai', openaiKey.value, setOpenaiKey);
      
      if (!anthropicValid || !openaiValid) {
        setIsSaving(false);
        return;
      }
      
      // Check at least one key is provided
      if (!anthropicKey.value.trim() && !openaiKey.value.trim()) {
        setAnthropicKey(prev => ({ ...prev, error: 'At least one API key is required' }));
        setIsSaving(false);
        return;
      }
      
      // Save keys
      if (anthropicKey.value.trim()) {
        apiKeyManager.saveKey('anthropic', anthropicKey.value.trim());
      }
      if (openaiKey.value.trim()) {
        apiKeyManager.saveKey('openai', openaiKey.value.trim());
      }
      
      // Mark setup as complete
      if (typeof window !== 'undefined') {
        localStorage.setItem('projectloom:keys-configured', 'true');
      }
      
      onSuccess?.();
      onClose();
    } finally {
      setIsSaving(false);
    }
  }, [anthropicKey.value, openaiKey.value, validateKey, onSuccess, onClose]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={styles.overlay}
        onClick={onClose}
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
                Your API keys are stored locally in your browser and never sent to our servers.
                You can get API keys from:
              </p>
              <div style={styles.links}>
                <a
                  href="https://console.anthropic.com/settings/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={styles.link}
                >
                  Anthropic Console <ExternalLink size={12} />
                </a>
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={styles.link}
                >
                  OpenAI Platform <ExternalLink size={12} />
                </a>
              </div>
            </div>

            {/* Anthropic Key */}
            <KeyInput
              label="Anthropic API Key"
              placeholder="sk-ant-..."
              value={anthropicKey.value}
              onChange={(v) => handleKeyChange('anthropic', v, setAnthropicKey)}
              isValid={anthropicKey.isValid}
              isValidating={anthropicKey.isValidating}
              error={anthropicKey.error}
            />

            {/* OpenAI Key */}
            <KeyInput
              label="OpenAI API Key"
              placeholder="sk-..."
              value={openaiKey.value}
              onChange={(v) => handleKeyChange('openai', v, setOpenaiKey)}
              isValid={openaiKey.isValid}
              isValidating={openaiKey.isValidating}
              error={openaiKey.error}
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
            borderColor: error
              ? 'rgba(239, 68, 68, 0.5)'
              : isValid
              ? 'rgba(16, 185, 129, 0.5)'
              : 'rgba(99, 102, 241, 0.3)',
          }}
        />
        <div style={styles.inputIcons}>
          {isValidating && <Loader size={14} className="animate-spin" />}
          {isValid === true && <CheckCircle size={14} color="#10b981" />}
          {isValid === false && <AlertCircle size={14} color="#ef4444" />}
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
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },

  modal: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: colors.navy.light,
    borderRadius: effects.border.radius.lg,
    border: '1px solid rgba(99, 102, 241, 0.3)',
    boxShadow: '0 24px 48px rgba(0, 0, 0, 0.4)',
    overflow: 'hidden',
  },

  header: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: spacing[3],
    padding: spacing[4],
    borderBottom: '1px solid rgba(99, 102, 241, 0.2)',
  },

  headerIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 48,
    borderRadius: '50%',
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    color: colors.violet.primary,
    flexShrink: 0,
  },

  title: {
    margin: 0,
    fontSize: typography.sizes.lg,
    fontWeight: 600,
    color: colors.contrast.white,
    fontFamily: typography.fonts.heading,
  },

  subtitle: {
    margin: `${spacing[1]} 0 0`,
    fontSize: typography.sizes.sm,
    color: colors.contrast.gray,
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
    color: colors.contrast.grayDark,
    cursor: 'pointer',
  },

  content: {
    padding: spacing[4],
    display: 'flex',
    flexDirection: 'column',
    gap: spacing[4],
  } as React.CSSProperties,

  infoBanner: {
    padding: spacing[3],
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderRadius: effects.border.radius.default,
    border: '1px solid rgba(99, 102, 241, 0.2)',
  },

  infoText: {
    margin: 0,
    fontSize: typography.sizes.sm,
    color: colors.contrast.gray,
    fontFamily: typography.fonts.body,
    lineHeight: typography.lineHeights.relaxed,
  },

  links: {
    display: 'flex',
    gap: spacing[3],
    marginTop: spacing[2],
  },

  link: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: spacing[1],
    fontSize: typography.sizes.sm,
    color: colors.violet.light,
    textDecoration: 'none',
  },

  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing[1],
  } as React.CSSProperties,

  label: {
    fontSize: typography.sizes.sm,
    fontWeight: 500,
    color: colors.contrast.white,
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
    backgroundColor: colors.navy.dark,
    border: '1px solid rgba(99, 102, 241, 0.3)',
    borderRadius: effects.border.radius.default,
    color: colors.contrast.white,
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
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    border: 'none',
    borderRadius: '4px',
    color: colors.violet.light,
    fontSize: typography.sizes.xs,
    cursor: 'pointer',
  },

  error: {
    fontSize: typography.sizes.xs,
    color: '#ef4444',
    fontFamily: typography.fonts.body,
  },

  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: spacing[2],
    padding: spacing[4],
    borderTop: '1px solid rgba(99, 102, 241, 0.2)',
    backgroundColor: colors.navy.dark,
  },

  cancelButton: {
    padding: `${spacing[2]} ${spacing[4]}`,
    backgroundColor: 'transparent',
    border: '1px solid rgba(99, 102, 241, 0.3)',
    borderRadius: effects.border.radius.default,
    color: colors.contrast.gray,
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.body,
    cursor: 'pointer',
  },

  saveButton: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[2],
    padding: `${spacing[2]} ${spacing[4]}`,
    backgroundColor: colors.violet.primary,
    border: 'none',
    borderRadius: effects.border.radius.default,
    color: colors.contrast.white,
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.body,
    fontWeight: 500,
    cursor: 'pointer',
  },
};

export default APIKeySetupModal;
