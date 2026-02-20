'use client';

import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Star, Send, Loader } from 'lucide-react';
import { colors, typography, spacing, effects } from '@/lib/design-tokens';
import { useToast } from '@/stores/toast-store';

// =============================================================================
// TYPES
// =============================================================================

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// =============================================================================
// STYLES
// =============================================================================

const overlayStyles: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'var(--bg-overlay)',
  backdropFilter: 'blur(4px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999,
};

const panelStyles: React.CSSProperties = {
  backgroundColor: colors.bg.secondary,
  borderRadius: effects.border.radius.md,
  border: `1px solid ${colors.border.default}`,
  boxShadow: effects.shadow.lg,
  width: '90%',
  maxWidth: '440px',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
};

const headerStyles: React.CSSProperties = {
  padding: `${spacing[4]} ${spacing[4]} ${spacing[3]}`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  borderBottom: `1px solid ${colors.border.default}`,
};

const bodyStyles: React.CSSProperties = {
  padding: spacing[4],
  display: 'flex',
  flexDirection: 'column',
  gap: spacing[4],
};

const labelStyles: React.CSSProperties = {
  fontSize: typography.sizes.xs,
  fontFamily: typography.fonts.body,
  color: colors.fg.tertiary,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: spacing[1],
  display: 'block',
};

const textareaStyles: React.CSSProperties = {
  width: '100%',
  minHeight: 100,
  resize: 'vertical',
  padding: `${spacing[2]} ${spacing[3]}`,
  backgroundColor: colors.bg.tertiary,
  border: `1px solid ${colors.border.default}`,
  borderRadius: effects.border.radius.default,
  color: colors.fg.primary,
  fontFamily: typography.fonts.body,
  fontSize: typography.sizes.sm,
  outline: 'none',
  boxSizing: 'border-box',
};

const inputStyles: React.CSSProperties = {
  width: '100%',
  padding: `${spacing[2]} ${spacing[3]}`,
  backgroundColor: colors.bg.tertiary,
  border: `1px solid ${colors.border.default}`,
  borderRadius: effects.border.radius.default,
  color: colors.fg.primary,
  fontFamily: typography.fonts.body,
  fontSize: typography.sizes.sm,
  outline: 'none',
  boxSizing: 'border-box',
};

const footerStyles: React.CSSProperties = {
  padding: `${spacing[3]} ${spacing[4]}`,
  borderTop: `1px solid ${colors.border.default}`,
  display: 'flex',
  justifyContent: 'flex-end',
  gap: spacing[2],
};

// =============================================================================
// STAR RATING SUB-COMPONENT
// =============================================================================

function StarRating({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [hovered, setHovered] = useState(0);
  const effective = hovered || value;

  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
          style={{
            background: 'none',
            border: 'none',
            padding: '2px',
            cursor: 'pointer',
            color: n <= effective ? '#f59e0b' : colors.fg.quaternary,
            transition: 'color 100ms ease',
          }}
          aria-label={`${n} star${n !== 1 ? 's' : ''}`}
        >
          <Star size={24} fill={n <= effective ? '#f59e0b' : 'none'} strokeWidth={1.5} />
        </button>
      ))}
    </div>
  );
}

// =============================================================================
// FEEDBACK MODAL
// =============================================================================

export function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
  const { success, error: toastError } = useToast();
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const overlayMouseDownRef = useRef(false);

  const reset = useCallback(() => {
    setRating(0);
    setMessage('');
    setEmail('');
    setSubmitting(false);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const handleSubmit = useCallback(async () => {
    if (!message.trim() && !email.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'feedback', rating: rating || undefined, message, email }),
      });
      if (!res.ok) throw new Error('Failed to send');
      success('Thanks for your feedback! 🙏');
      handleClose();
    } catch {
      toastError('Failed to send feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [rating, message, email, success, toastError, handleClose]);

  const canSubmit = (message.trim().length > 0 || email.trim().length > 0) && !submitting;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          style={overlayStyles}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onMouseDown={(e) => { overlayMouseDownRef.current = e.target === e.currentTarget; }}
          onMouseUp={(e) => { if (overlayMouseDownRef.current && e.target === e.currentTarget) handleClose(); overlayMouseDownRef.current = false; }}
        >
          <motion.div
            style={panelStyles}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18 }}
          >
            {/* Header */}
            <div style={headerStyles}>
              <h2 style={{ margin: 0, fontSize: typography.sizes.lg, fontWeight: typography.weights.semibold, fontFamily: typography.fonts.heading, color: colors.fg.primary }}>
                Share feedback
              </h2>
              <button
                onClick={handleClose}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.fg.tertiary, padding: 4, display: 'flex', borderRadius: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div style={bodyStyles}>
              {/* Star rating */}
              <div>
                <span style={labelStyles}>How would you rate ProjectLoom?</span>
                <StarRating value={rating} onChange={setRating} />
              </div>

              {/* Message */}
              <div>
                <span style={labelStyles}>What&apos;s on your mind? <span style={{ color: colors.fg.quaternary }}>(optional if email provided)</span></span>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tell us what you love, what's missing, or anything else…"
                  style={textareaStyles}
                />
              </div>

              {/* Email */}
              <div>
                <span style={labelStyles}>Your email <span style={{ color: colors.fg.quaternary }}>(optional — for a reply)</span></span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  style={inputStyles}
                />
              </div>
            </div>

            {/* Footer */}
            <div style={footerStyles}>
              <button
                onClick={handleClose}
                style={{ padding: `${spacing[2]} ${spacing[3]}`, background: 'none', border: `1px solid ${colors.border.default}`, borderRadius: effects.border.radius.default, color: colors.fg.secondary, fontSize: typography.sizes.sm, fontFamily: typography.fonts.body, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                style={{
                  padding: `${spacing[2]} ${spacing[3]}`,
                  backgroundColor: canSubmit ? colors.accent.primary : colors.bg.tertiary,
                  border: 'none',
                  borderRadius: effects.border.radius.default,
                  color: canSubmit ? colors.accent.contrast : colors.fg.quaternary,
                  fontSize: typography.sizes.sm,
                  fontFamily: typography.fonts.body,
                  fontWeight: typography.weights.medium,
                  cursor: canSubmit ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  gap: spacing[1],
                  transition: 'background-color 150ms ease',
                }}
              >
                {submitting ? <Loader size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Send size={14} />}
                {submitting ? 'Sending…' : 'Send feedback'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
