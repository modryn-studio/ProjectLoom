'use client';

import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Bug, Send, Loader } from 'lucide-react';
import { colors, typography, spacing, effects } from '@/lib/design-tokens';
import { useToast } from '@/stores/toast-store';

// =============================================================================
// TYPES
// =============================================================================

type Severity = 'low' | 'medium' | 'high' | 'critical';

interface BugReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const SEVERITY_OPTIONS: { value: Severity; label: string; color: string }[] = [
  { value: 'low', label: 'Low — minor annoyance', color: '#4caf50' },
  { value: 'medium', label: 'Medium — blocks workflow', color: '#ff9800' },
  { value: 'high', label: 'High — major breakage', color: '#f44336' },
  { value: 'critical', label: 'Critical — data loss / crashes', color: '#9c27b0' },
];

// =============================================================================
// STYLES (shared with FeedbackModal)
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
  minHeight: 110,
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
// BUG REPORT MODAL
// =============================================================================

export function BugReportModal({ isOpen, onClose }: BugReportModalProps) {
  const { success, error: toastError } = useToast();
  const [severity, setSeverity] = useState<Severity>('medium');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const overlayMouseDownRef = useRef(false);

  const reset = useCallback(() => {
    setSeverity('medium');
    setMessage('');
    setEmail('');
    setSubmitting(false);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const handleSubmit = useCallback(async () => {
    if (!message.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'bug', severity, message, email: email || undefined }),
      });
      if (!res.ok) throw new Error('Failed to send');
      success('Bug report sent! Thanks for helping improve ProjectLoom.');
      handleClose();
    } catch {
      toastError('Failed to send report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [severity, message, email, success, toastError, handleClose]);

  const canSubmit = message.trim().length > 0 && !submitting;

  const activeSeverity = SEVERITY_OPTIONS.find((o) => o.value === severity);

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
              <h2 style={{ margin: 0, fontSize: typography.sizes.lg, fontWeight: typography.weights.semibold, fontFamily: typography.fonts.heading, color: colors.fg.primary, display: 'flex', alignItems: 'center', gap: spacing[2] }}>
                <Bug size={18} style={{ color: '#f44336' }} />
                Report a bug
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
              {/* Severity */}
              <div>
                <span style={labelStyles}>Severity</span>
                <div style={{ display: 'flex', gap: spacing[2], flexWrap: 'wrap' }}>
                  {SEVERITY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSeverity(opt.value)}
                      style={{
                        padding: `${spacing[1]} ${spacing[2]}`,
                        borderRadius: effects.border.radius.default,
                        border: `1px solid ${severity === opt.value ? opt.color : colors.border.default}`,
                        backgroundColor: severity === opt.value ? `${opt.color}22` : colors.bg.tertiary,
                        color: severity === opt.value ? opt.color : colors.fg.secondary,
                        fontSize: typography.sizes.xs,
                        fontFamily: typography.fonts.body,
                        fontWeight: severity === opt.value ? typography.weights.semibold : typography.weights.normal,
                        cursor: 'pointer',
                        transition: 'all 120ms ease',
                      }}
                    >
                      {opt.label.split(' — ')[0]}
                    </button>
                  ))}
                </div>
                {activeSeverity && (
                  <p style={{ margin: `${spacing[1]} 0 0`, fontSize: typography.sizes.xs, color: activeSeverity.color, fontFamily: typography.fonts.body }}>
                    {activeSeverity.label}
                  </p>
                )}
              </div>

              {/* Message */}
              <div>
                <span style={labelStyles}>Describe the bug</span>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={"What happened? What were you doing? What did you expect?\n\n Steps to reproduce are super helpful."}
                  style={textareaStyles}
                />
              </div>

              {/* Email */}
              <div>
                <span style={labelStyles}>Your email <span style={{ color: colors.fg.quaternary }}>(optional — for follow-up)</span></span>
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
                  backgroundColor: canSubmit ? '#f44336' : colors.bg.tertiary,
                  border: 'none',
                  borderRadius: effects.border.radius.default,
                  color: canSubmit ? '#fff' : colors.fg.quaternary,
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
                {submitting ? 'Sending…' : 'Send report'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
