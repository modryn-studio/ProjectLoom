'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, ExternalLink, Shield } from 'lucide-react';

import { colors, spacing, effects, animation, typography } from '@/lib/design-tokens';
import { apiKeyManager, useAPIKeyStatus } from '@/lib/api-key-manager';

// =============================================================================
// API KEY WARNING BANNER
// =============================================================================

interface APIKeyWarningBannerProps {
  /** Whether to allow dismissing the banner */
  dismissible?: boolean;
  /** Position of the banner */
  position?: 'top' | 'bottom';
}

/**
 * Warning banner shown when API keys are stored in localStorage (dev mode).
 * Encourages users to use environment variables for production.
 */
export function APIKeyWarningBanner({
  dismissible = true,
  position = 'top',
}: APIKeyWarningBannerProps) {
  const [isDismissed, setIsDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem('api-key-warning-dismissed') === 'true';
  });
  const [showDetails, setShowDetails] = useState(false);
  const { status: keyStatus, hasDevModeKeys: hookHasDevModeKeys } = useAPIKeyStatus();

  // Check if we should show the warning (only if dev mode keys exist)
  const hasDevModeKeys = hookHasDevModeKeys || apiKeyManager.hasDevModeKeys();

  // Don't render if no dev mode keys or dismissed
  if (!hasDevModeKeys || isDismissed) {
    return null;
  }

  const handleDismiss = () => {
    setIsDismissed(true);
    // Optionally persist dismissal in sessionStorage (not localStorage to remind again)
    sessionStorage.setItem('api-key-warning-dismissed', 'true');
  };

  return (
    <AnimatePresence>
      {!isDismissed && (
        <motion.div
          initial={{ opacity: 0, y: position === 'top' ? -20 : 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: position === 'top' ? -20 : 20 }}
          transition={animation.spring.gentle}
          style={{
            ...styles.container,
            [position]: 0,
          }}
        >
          <div style={styles.content}>
            {/* Warning icon */}
            <div style={styles.iconContainer}>
              <AlertTriangle size={18} style={{ color: colors.accent.primary }} />
            </div>

            {/* Message */}
            <div style={styles.messageContainer}>
              <p style={styles.title}>
                <Shield size={14} style={{ marginRight: 6, opacity: 0.8 }} />
                Development Mode API Keys Detected
              </p>
              <p style={styles.message}>
                API keys are stored in browser storage. For production, use environment variables.
              </p>

              {/* Details toggle */}
              <button
                onClick={() => setShowDetails(!showDetails)}
                style={styles.detailsToggle}
              >
                {showDetails ? 'Hide details' : 'Learn more'}
              </button>

              {/* Expandable details */}
              <AnimatePresence>
                {showDetails && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    style={styles.details}
                  >
                    <p style={styles.detailText}>
                      <strong>Current status:</strong>
                    </p>
                    <ul style={styles.detailList}>
                      {keyStatus.providers.anthropic.key && (
                        <li>
                          Anthropic: {keyStatus.providers.anthropic.source === 'env' ? '✓ Environment variable' : '⚠ Browser storage'}
                        </li>
                      )}
                      {keyStatus.providers.openai.key && (
                        <li>
                          OpenAI: {keyStatus.providers.openai.source === 'env' ? '✓ Environment variable' : '⚠ Browser storage'}
                        </li>
                      )}
                    </ul>
                    <p style={styles.detailText}>
                      <strong>To secure your keys:</strong>
                    </p>
                    <ol style={styles.detailList}>
                      <li>Create a <code style={styles.code}>.env.local</code> file in your project root</li>
                      <li>Add: <code style={styles.code}>ANTHROPIC_API_KEY=sk-ant-...</code></li>
                      <li>Add: <code style={styles.code}>OPENAI_API_KEY=sk-...</code></li>
                      <li>Restart your development server</li>
                    </ol>
                    <a
                      href="https://nextjs.org/docs/app/building-your-application/configuring/environment-variables"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={styles.learnMoreLink}
                    >
                      Learn about Next.js environment variables
                      <ExternalLink size={12} style={{ marginLeft: 4 }} />
                    </a>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Dismiss button */}
            {dismissible && (
              <button
                onClick={handleDismiss}
                style={styles.dismissButton}
                aria-label="Dismiss warning"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    left: 0,
    right: 0,
    zIndex: 9999,
    padding: spacing[3],
    display: 'flex',
    justifyContent: 'center',
    pointerEvents: 'none',
  },

  content: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: spacing[3],
    backgroundColor: 'var(--warning-muted)',
    border: `1px solid ${colors.accent.primary}40`,
    borderRadius: effects.border.radius.default,
    padding: spacing[3],
    maxWidth: 600,
    pointerEvents: 'auto',
    backdropFilter: 'blur(8px)',
  },

  iconContainer: {
    flexShrink: 0,
    paddingTop: 2,
  },

  messageContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: spacing[1],
  },

  title: {
    margin: 0,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.accent.primary,
    fontFamily: typography.fonts.body,
    display: 'flex',
    alignItems: 'center',
  },

  message: {
    margin: 0,
    fontSize: typography.sizes.xs,
    color: colors.fg.secondary,
    fontFamily: typography.fonts.body,
    lineHeight: 1.4,
  },

  detailsToggle: {
    background: 'none',
    border: 'none',
    padding: 0,
    marginTop: spacing[1],
    fontSize: typography.sizes.xs,
    color: colors.accent.primary,
    cursor: 'pointer',
    textDecoration: 'underline',
    fontFamily: typography.fonts.body,
  },

  details: {
    marginTop: spacing[2],
    paddingTop: spacing[2],
    borderTop: '1px solid var(--warning-solid)',
    overflow: 'hidden',
  },

  detailText: {
    margin: 0,
    marginBottom: spacing[1],
    fontSize: typography.sizes.xs,
    color: colors.fg.secondary,
    fontFamily: typography.fonts.body,
  },

  detailList: {
    margin: 0,
    marginBottom: spacing[2],
    paddingLeft: spacing[4],
    fontSize: typography.sizes.xs,
    color: colors.fg.tertiary,
    fontFamily: typography.fonts.body,
    lineHeight: 1.6,
  },

  code: {
    backgroundColor: 'var(--bg-tertiary)',
    padding: '2px 4px',
    borderRadius: 3,
    fontFamily: typography.fonts.code,
    fontSize: typography.sizes.xs,
  },

  learnMoreLink: {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: typography.sizes.xs,
    color: colors.accent.primary,
    textDecoration: 'none',
    fontFamily: typography.fonts.body,
  },

  dismissButton: {
    background: 'none',
    border: 'none',
    padding: spacing[1],
    cursor: 'pointer',
    color: colors.fg.tertiary,
    borderRadius: effects.border.radius.default,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'color 0.15s, background-color 0.15s',
  },
};

export default APIKeyWarningBanner;
