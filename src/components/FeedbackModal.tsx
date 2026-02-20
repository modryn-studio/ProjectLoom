'use client';

import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Star, Send, Loader, Bug } from 'lucide-react';
import { colors, typography, spacing, effects } from '@/lib/design-tokens';
import { useToast } from '@/stores/toast-store';

// =============================================================================
// TYPES
// =============================================================================

type Tab = 'feedback' | 'bug';
type Severity = 'low' | 'medium' | 'high' | 'critical';

export interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Which tab to open on — defaults to 'feedback' */
  defaultTab?: Tab;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const SEVERITY_OPTIONS: { value: Severity; label: string; description: string; color: string }[] = [
  { value: 'low',      label: 'Low',      description: 'Minor annoyance',     color: '#4caf50' },
  { value: 'medium',   label: 'Medium',   description: 'Blocks my workflow',  color: '#ff9800' },
  { value: 'high',     label: 'High',     description: 'Major breakage',      color: '#f44336' },
  { value: 'critical', label: 'Critical', description: 'Data loss / crashes', color: '#9c27b0' },
];

// =============================================================================
// SHARED STYLES
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

const fieldLabelStyles: React.CSSProperties = {
  fontSize: typography.sizes.xs,
  fontFamily: typography.fonts.body,
  color: colors.fg.tertiary,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: spacing[1],
  display: 'block',
};

// =============================================================================
// STAR RATING
// =============================================================================

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
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
          style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', color: n <= effective ? '#f59e0b' : colors.fg.quaternary, transition: 'color 100ms ease' }}
          aria-label={`${n} star${n !== 1 ? 's' : ''}`}
        >
          <Star size={24} fill={n <= effective ? '#f59e0b' : 'none'} strokeWidth={1.5} />
        </button>
      ))}
    </div>
  );
}

// =============================================================================
// FEEDBACK MODAL (tabbed: Feedback + Bug report)
// =============================================================================

export function FeedbackModal({ isOpen, onClose, defaultTab = 'feedback' }: FeedbackModalProps) {
  const { success, error: toastError } = useToast();
  const overlayMouseDownRef = useRef(false);

  const [activeTab, setActiveTab] = useState<Tab>(defaultTab);

  // Feedback tab state
  const [fbRating, setFbRating] = useState(0);
  const [fbMessage, setFbMessage] = useState('');
  const [fbEmail, setFbEmail] = useState('');
  const [fbSubmitting, setFbSubmitting] = useState(false);

  // Bug tab state
  const [bugSeverity, setBugSeverity] = useState<Severity>('medium');
  const [bugMessage, setBugMessage] = useState('');
  const [bugEmail, setBugEmail] = useState('');
  const [bugSubmitting, setBugSubmitting] = useState(false);

  const reset = useCallback(() => {
    setFbRating(0); setFbMessage(''); setFbEmail(''); setFbSubmitting(false);
    setBugSeverity('medium'); setBugMessage(''); setBugEmail(''); setBugSubmitting(false);
  }, []);

  const handleClose = useCallback(() => { reset(); onClose(); }, [reset, onClose]);

  // Sync tab when modal opens with a specific defaultTab
  React.useEffect(() => { if (isOpen) setActiveTab(defaultTab); }, [isOpen, defaultTab]);

  const handleFeedbackSubmit = useCallback(async () => {
    if (fbRating === 0 && !fbMessage.trim() && !fbEmail.trim()) return;
    setFbSubmitting(true);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'feedback', rating: fbRating || undefined, message: fbMessage, email: fbEmail || undefined }),
      });
      if (!res.ok) throw new Error();
      success('Thanks for your feedback! 🙏');
      handleClose();
    } catch {
      toastError('Failed to send. Please try again.');
      setFbSubmitting(false);
    }
  }, [fbRating, fbMessage, fbEmail, success, toastError, handleClose]);

  const handleBugSubmit = useCallback(async () => {
    if (!bugMessage.trim()) return;
    setBugSubmitting(true);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'bug', severity: bugSeverity, message: bugMessage, email: bugEmail || undefined }),
      });
      if (!res.ok) throw new Error();
      success('Bug report sent! Thanks for helping improve ProjectLoom.');
      handleClose();
    } catch {
      toastError('Failed to send. Please try again.');
      setBugSubmitting(false);
    }
  }, [bugSeverity, bugMessage, bugEmail, success, toastError, handleClose]);

  const fbCanSubmit = (fbRating > 0 || fbMessage.trim().length > 0 || fbEmail.trim().length > 0) && !fbSubmitting;
  const bugCanSubmit = bugMessage.trim().length > 0 && !bugSubmitting;
  const activeSeverity = SEVERITY_OPTIONS.find((o) => o.value === bugSeverity);

  const submitAccent = activeTab === 'bug' ? '#f44336' : colors.accent.primary;
  const canSubmit = activeTab === 'feedback' ? fbCanSubmit : bugCanSubmit;
  const isSubmitting = activeTab === 'feedback' ? fbSubmitting : bugSubmitting;
  const handleSubmit = activeTab === 'feedback' ? handleFeedbackSubmit : handleBugSubmit;
  const submitLabel = activeTab === 'feedback' ? 'Send feedback' : 'Send report';

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
            <div style={{ padding: `${spacing[4]} ${spacing[4]} 0`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ margin: 0, fontSize: typography.sizes.lg, fontWeight: typography.weights.semibold, fontFamily: typography.fonts.heading, color: colors.fg.primary }}>
                Share feedback
              </h2>
              <button onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.fg.tertiary, padding: 4, display: 'flex', borderRadius: 4 }}>
                <X size={18} />
              </button>
            </div>

            {/* Tabs */}
            <div style={{ padding: `${spacing[3]} ${spacing[4]} 0`, display: 'flex', gap: spacing[1] }}>
              {(['feedback', 'bug'] as Tab[]).map((tab) => {
                const isActive = activeTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    style={{
                      padding: `${spacing[2]} ${spacing[3]}`,
                      border: 'none',
                      borderRadius: effects.border.radius.default,
                      backgroundColor: isActive ? colors.bg.tertiary : 'transparent',
                      color: isActive ? colors.fg.primary : colors.fg.tertiary,
                      fontSize: typography.sizes.sm,
                      fontFamily: typography.fonts.body,
                      fontWeight: isActive ? typography.weights.medium : typography.weights.normal,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: spacing[1],
                      transition: 'all 120ms ease',
                    }}
                  >
                    {tab === 'bug' && <Bug size={13} style={{ color: isActive ? '#f44336' : 'inherit' }} />}
                    {tab === 'feedback' ? 'Feedback' : 'Bug report'}
                  </button>
                );
              })}
            </div>

            {/* Divider */}
            <div style={{ height: 1, backgroundColor: colors.border.default, margin: `${spacing[3]} 0 0` }} />

            {/* Tab content */}
            <AnimatePresence mode="wait">
              {activeTab === 'feedback' ? (
                <motion.div
                  key="feedback"
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 6 }}
                  transition={{ duration: 0.13 }}
                  style={{ padding: spacing[4], display: 'flex', flexDirection: 'column', gap: spacing[4] }}
                >
                  <div>
                    <span style={fieldLabelStyles}>How would you rate ProjectLoom?</span>
                    <StarRating value={fbRating} onChange={setFbRating} />
                  </div>
                  <div>
                    <span style={fieldLabelStyles}>
                      Message <span style={{ color: colors.fg.quaternary }}>(optional if email provided)</span>
                    </span>
                    <textarea
                      value={fbMessage}
                      onChange={(e) => setFbMessage(e.target.value)}
                      placeholder="Tell us what you love, what's missing, or anything else…"
                      style={textareaStyles}
                    />
                  </div>
                  <div>
                    <span style={fieldLabelStyles}>Your email <span style={{ color: colors.fg.quaternary }}>(optional €” for a reply)</span></span>
                    <input type="email" value={fbEmail} onChange={(e) => setFbEmail(e.target.value)} placeholder="you@example.com" style={inputStyles} />
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="bug"
                  initial={{ opacity: 0, x: 6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -6 }}
                  transition={{ duration: 0.13 }}
                  style={{ padding: spacing[4], display: 'flex', flexDirection: 'column', gap: spacing[4] }}
                >
                  <div>
                    <span style={fieldLabelStyles}>Severity</span>
                    <div style={{ display: 'flex', gap: spacing[2], flexWrap: 'wrap' }}>
                      {SEVERITY_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setBugSeverity(opt.value)}
                          style={{
                            padding: `${spacing[1]} ${spacing[2]}`,
                            borderRadius: effects.border.radius.default,
                            border: `1px solid ${bugSeverity === opt.value ? opt.color : colors.border.default}`,
                            backgroundColor: bugSeverity === opt.value ? `${opt.color}22` : colors.bg.tertiary,
                            color: bugSeverity === opt.value ? opt.color : colors.fg.secondary,
                            fontSize: typography.sizes.xs,
                            fontFamily: typography.fonts.body,
                            fontWeight: bugSeverity === opt.value ? typography.weights.semibold : typography.weights.normal,
                            cursor: 'pointer',
                            transition: 'all 120ms ease',
                          }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    {activeSeverity && (
                      <p style={{ margin: `${spacing[1]} 0 0`, fontSize: typography.sizes.xs, color: activeSeverity.color, fontFamily: typography.fonts.body }}>
                        {activeSeverity.description}
                      </p>
                    )}
                  </div>
                  <div>
                    <span style={fieldLabelStyles}>Describe the bug</span>
                    <textarea
                      value={bugMessage}
                      onChange={(e) => setBugMessage(e.target.value)}
                      placeholder="What happened? Steps to reproduce are super helpful."
                      style={{ ...textareaStyles, minHeight: 110 }}
                    />
                  </div>
                  <div>
                    <span style={fieldLabelStyles}>Your email <span style={{ color: colors.fg.quaternary }}>(optional)</span></span>
                    <input type="email" value={bugEmail} onChange={(e) => setBugEmail(e.target.value)} placeholder="you@example.com" style={inputStyles} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Footer */}
            <div style={{ padding: `${spacing[3]} ${spacing[4]}`, borderTop: `1px solid ${colors.border.default}`, display: 'flex', justifyContent: 'flex-end', gap: spacing[2] }}>
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
                  backgroundColor: canSubmit ? submitAccent : colors.bg.tertiary,
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
                {isSubmitting ? <Loader size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Send size={14} />}
                {isSubmitting ? 'Sending€¦' : submitLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
