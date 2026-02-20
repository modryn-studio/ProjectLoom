'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, CheckCircle, Loader } from 'lucide-react';
import { colors, typography, spacing, effects } from '@/lib/design-tokens';
import { useToast } from '@/stores/toast-store';

// =============================================================================
// NEWSLETTER SIGNUP
//
// Compact inline form — intended for landing page footer, settings footer, etc.
// POST /api/feedback  { type: 'newsletter', email }
// =============================================================================

interface NewsletterSignupProps {
  /** Short description shown above the input */
  label?: string;
}

export function NewsletterSignup({ label = "Stay in the loop — get notified about new features." }: NewsletterSignupProps) {
  const { error: toastError } = useToast();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || submitting) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'newsletter', email: trimmed }),
      });
      if (!res.ok) throw new Error('Failed');
      setDone(true);
    } catch {
      toastError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [email, submitting, toastError]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: spacing[3] }}>
      <p style={{
        margin: 0,
        fontSize: typography.sizes.sm,
        color: colors.fg.tertiary,
        fontFamily: typography.fonts.body,
        textAlign: 'center',
        maxWidth: 360,
      }}>
        {label}
      </p>

      <AnimatePresence mode="wait">
        {done ? (
          <motion.div
            key="done"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{ display: 'flex', alignItems: 'center', gap: spacing[2], color: '#4caf50', fontSize: typography.sizes.sm, fontFamily: typography.fonts.body }}
          >
            <CheckCircle size={16} />
            You&apos;re on the list!
          </motion.div>
        ) : (
          <motion.form
            key="form"
            onSubmit={handleSubmit}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ display: 'flex', gap: spacing[2], width: '100%', maxWidth: 360 }}
          >
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              style={{
                flex: 1,
                padding: `${spacing[2]} ${spacing[3]}`,
                backgroundColor: colors.bg.tertiary,
                border: `1px solid ${colors.border.default}`,
                borderRadius: effects.border.radius.default,
                color: colors.fg.primary,
                fontFamily: typography.fonts.body,
                fontSize: typography.sizes.sm,
                outline: 'none',
                minWidth: 0,
              }}
            />
            <button
              type="submit"
              disabled={!email.trim() || submitting}
              style={{
                padding: `${spacing[2]} ${spacing[3]}`,
                backgroundColor: (email.trim() && !submitting) ? colors.accent.primary : colors.bg.tertiary,
                border: 'none',
                borderRadius: effects.border.radius.default,
                color: (email.trim() && !submitting) ? colors.accent.contrast : colors.fg.quaternary,
                fontSize: typography.sizes.sm,
                fontFamily: typography.fonts.body,
                fontWeight: typography.weights.medium,
                cursor: (email.trim() && !submitting) ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: spacing[1],
                transition: 'background-color 150ms ease',
                whiteSpace: 'nowrap',
              }}
            >
              {submitting ? <Loader size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Send size={14} />}
              {submitting ? '…' : 'Notify me'}
            </button>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
