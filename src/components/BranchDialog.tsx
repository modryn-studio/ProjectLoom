'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import { useCanvasStore, selectBranchDialogOpen, selectBranchSourceId } from '@/stores/canvas-store';
import { usePreferencesStore, selectDefaultInheritanceMode } from '@/stores/preferences-store';
import { colors, spacing, effects, typography } from '@/lib/design-tokens';
import { 
  estimateTokens, 
} from '@/lib/context-utils';
import { detectProvider, estimateCost, formatCost } from '@/lib/vercel-ai-integration';
import { useUsageStore } from '@/stores/usage-store';
import { apiKeyManager } from '@/lib/api-key-manager';
import type { InheritanceMode, Message } from '@/types';

// =============================================================================
// ICONS (inline SVG to avoid lucide-react dependency issues)
// =============================================================================

const XIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const GitBranchIcon = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="6" y1="3" x2="6" y2="15" /><circle cx="18" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M18 9a9 9 0 0 1-9 9" />
  </svg>
);

const FileTextIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
  </svg>
);

const ScissorsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><line x1="20" y1="4" x2="8.12" y2="15.88" /><line x1="14.47" y1="14.48" x2="20" y2="20" /><line x1="8.12" y1="8.12" x2="12" y2="12" />
  </svg>
);

const AlertCircleIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

// =============================================================================
// STYLES
// =============================================================================

const overlayStyles: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.6)',
  backdropFilter: 'blur(4px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999,
};

const dialogStyles: React.CSSProperties = {
  backgroundColor: colors.bg.secondary,
  borderRadius: effects.border.radius.md,
  border: '1px solid var(--border-primary)',
  boxShadow: effects.shadow.lg,
  width: '90%',
  maxWidth: '600px',
  maxHeight: '80vh',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
};

const headerStyles: React.CSSProperties = {
  padding: spacing[4],
  borderBottom: '1px solid var(--border-primary)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

const contentStyles: React.CSSProperties = {
  padding: spacing[4],
  overflowY: 'auto',
  flex: 1,
};

const footerStyles: React.CSSProperties = {
  padding: spacing[4],
  borderTop: '1px solid var(--border-primary)',
  display: 'flex',
  justifyContent: 'flex-end',
  gap: spacing[2],
};

const EMPTY_MESSAGES: Message[] = [];

// =============================================================================
// INHERITANCE MODE OPTIONS
// =============================================================================

interface ModeOption {
  id: InheritanceMode;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const modeOptions: ModeOption[] = [
  {
    id: 'full',
    label: 'Full Context',
    description: 'Include all messages up to branch point (like ChatGPT/Claude)',
    icon: <FileTextIcon />,
  },
  {
    id: 'summary',
    label: 'AI Summary',
    description: 'Generate a concise AI summary of the conversation',
    icon: <ScissorsIcon />,
  },
];

// =============================================================================
// BRANCH DIALOG COMPONENT
// =============================================================================

export function BranchDialog() {
  // Store state
  const branchDialogOpen = useCanvasStore(selectBranchDialogOpen);
  const branchSourceId = useCanvasStore(selectBranchSourceId);
  const branchMessageIndex = useCanvasStore((s) => s.branchMessageIndex);
  const closeBranchDialog = useCanvasStore((s) => s.closeBranchDialog);
  const branchFromMessage = useCanvasStore((s) => s.branchFromMessage);
  const conversations = useCanvasStore((s) => s.conversations);
  const addUsage = useUsageStore((s) => s.addUsage);

  // Preferences
  const defaultInheritanceMode = usePreferencesStore(selectDefaultInheritanceMode);
  const setBranchingPreferences = usePreferencesStore((s) => s.setBranchingPreferences);

  // Local state
  const [branchReason, setBranchReason] = useState('');
  const [inheritanceMode, setInheritanceMode] = useState<InheritanceMode>(
    defaultInheritanceMode
  );
  const overlayMouseDownRef = useRef(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validationWarning, setValidationWarning] = useState<string | null>(null);
  const [rememberChoice, setRememberChoice] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  // Reset form when dialog opens
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (branchDialogOpen) {
      setInheritanceMode(defaultInheritanceMode);
      setBranchReason('');
      setRememberChoice(false);
      setValidationError(null);
      setValidationWarning(null);
      setIsGeneratingSummary(false);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [branchDialogOpen, defaultInheritanceMode]);

  // Get source conversation
  const sourceConversation = useMemo(() => 
    branchSourceId ? conversations.get(branchSourceId) : undefined,
    [conversations, branchSourceId]
  );

  const messages = sourceConversation?.content ?? EMPTY_MESSAGES;

  // Calculate stats for preview
  const stats = useMemo(() => {
    if (!messages.length) return null;

    const totalMessages = messages.length;
    const totalTokens = estimateTokens(messages);
    
    let selectedMessages: number;
    let selectedTokens: number;

    if (inheritanceMode === 'full') {
      selectedMessages = totalMessages;
      selectedTokens = totalTokens;
    } else {
      // AI Summary mode: estimate cost of summarization call
      selectedMessages = totalMessages; // AI sees all messages to create summary
      selectedTokens = totalTokens;
    }

    return {
      totalMessages,
      totalTokens,
      selectedMessages,
      selectedTokens,
      saved: totalMessages - selectedMessages,
    };
  }, [messages, inheritanceMode]);

  // Validate on change
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setValidationError(null);
    if (inheritanceMode === 'summary') {
      const hasKey = !!apiKeyManager.getKey('anthropic') || !!apiKeyManager.getKey('openai');
      if (!hasKey) {
         
        setValidationError('API key required for AI summary generation. Configure in Settings.');
      } else {
        const costEstimate = estimateCost(stats?.totalTokens ?? 0, 500, 'claude-sonnet-4-5');
         
        setValidationWarning(`AI will summarize ${messages.length} messages. Estimated cost: ${formatCost(costEstimate)}`);
      }
    } else {
       
      setValidationWarning(null);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [inheritanceMode, messages, stats]);

  // Constants for validation
  const MAX_REASON_LENGTH = 200;

  // Handle close
  const handleClose = useCallback(() => {
    setBranchReason('');
    setInheritanceMode(defaultInheritanceMode);
    setValidationError(null);
    setValidationWarning(null);
    setRememberChoice(false);
    setIsGeneratingSummary(false);
    closeBranchDialog();
  }, [defaultInheritanceMode, closeBranchDialog]);

  // Handle submit
  const handleSubmit = useCallback(async () => {
    if (!branchReason.trim()) {
      setValidationError('Please provide a reason for this branch');
      return;
    }

    if (branchReason.length > MAX_REASON_LENGTH) {
      setValidationError(`Reason must be less than ${MAX_REASON_LENGTH} characters`);
      return;
    }

    if (validationError) return;

    // Save preference if user checked "Remember this choice"
    if (rememberChoice) {
      setBranchingPreferences({ defaultInheritanceMode: inheritanceMode });
    }

    // For summary mode, generate AI summary first
    if (inheritanceMode === 'summary') {
      setIsGeneratingSummary(true);
      setValidationError(null);
      setValidationWarning('Generating AI summary...');

      try {
        // Determine which API key and model to use
        const anthropicKey = apiKeyManager.getKey('anthropic');
        const openaiKey = apiKeyManager.getKey('openai');
        const apiKey = anthropicKey || openaiKey;
        const model = anthropicKey ? 'claude-sonnet-4-5' : 'gpt-5.2';

        if (!apiKey) {
          setValidationError('No API key configured. Add one in Settings.');
          setIsGeneratingSummary(false);
          return;
        }

        // Get messages up to branch point
        const messageIndex = branchMessageIndex ?? messages.length - 1;
        const messagesForSummary = messages.slice(0, messageIndex + 1).map(m => ({
          role: m.role,
          content: m.content,
        }));

        const response = await fetch('/api/summarize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: messagesForSummary,
            model,
            apiKey,
            parentTitle: sourceConversation?.metadata.title,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          setValidationError(errorData.error || 'Failed to generate summary.');
          setIsGeneratingSummary(false);
          return;
        }

        const data = await response.json() as { summary: string; usage?: { promptTokens: number; completionTokens: number; totalTokens: number } };

        if (data.usage?.totalTokens) {
          addUsage({
            provider: detectProvider(model),
            model,
            inputTokens: data.usage.promptTokens,
            outputTokens: data.usage.completionTokens,
            conversationId: branchSourceId || undefined,
            source: 'summarize',
          });
        }

        // Create branch with the generated summary
        const newConversation = branchFromMessage({
          sourceCardId: branchSourceId!,
          messageIndex,
          inheritanceMode: 'summary',
          branchReason: branchReason.trim(),
          summaryText: data.summary,
        });

        if (!newConversation) {
          setValidationError('Failed to create branch. Please try again.');
          setIsGeneratingSummary(false);
          return;
        }

        setIsGeneratingSummary(false);
        handleClose();
      } catch (error) {
        console.error('[BranchDialog] Summary generation failed:', error);
        setValidationError('Failed to generate summary. Check your connection and try again.');
        setIsGeneratingSummary(false);
      }
      return;
    }

    // Full context mode - just create the branch
    const newConversation = branchFromMessage({
      sourceCardId: branchSourceId!,
      messageIndex: branchMessageIndex ?? messages.length - 1,
      inheritanceMode,
      branchReason: branchReason.trim(),
    });

    if (!newConversation) {
      setValidationError('Failed to create branch. Please try again.');
      return;
    }

    handleClose();
  }, [
    branchReason,
    branchMessageIndex,
    branchSourceId,
    branchFromMessage,
    handleClose,
    inheritanceMode,
    messages,
    rememberChoice,
    setBranchingPreferences,
    sourceConversation,
    validationError,
    addUsage,
  ]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!branchDialogOpen) return;

      if (e.key === 'Escape') {
        handleClose();
        return;
      }

      if (e.key === 'Enter') {
        const target = e.target as HTMLElement | null;
        const tagName = target?.tagName?.toLowerCase();
        if (tagName === 'textarea' || tagName === 'button') return;
        if (isGeneratingSummary) return;
        handleSubmit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [branchDialogOpen, handleClose, handleSubmit, isGeneratingSummary]);

  if (!branchDialogOpen || !sourceConversation) return null;

  return (
    <AnimatePresence>
      <motion.div
        style={overlayStyles}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onMouseDown={(e) => {
          overlayMouseDownRef.current = e.target === e.currentTarget;
        }}
        onMouseUp={(e) => {
          if (overlayMouseDownRef.current && e.target === e.currentTarget) {
            handleClose();
          }
          overlayMouseDownRef.current = false;
        }}
      >
        <motion.div
          style={dialogStyles}
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div style={headerStyles}>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2] }}>
              <span style={{ color: colors.accent.primary }}>
                <GitBranchIcon size={24} />
              </span>
              <h2 style={{ 
                margin: 0, 
                fontSize: '1.25rem', 
                fontWeight: 600,
                color: colors.fg.primary,
                fontFamily: typography.fonts.heading,
              }}>
                {`Branch from "${sourceConversation.metadata.title}"`}
              </h2>
            </div>
            <button
              onClick={handleClose}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: spacing[1],
                borderRadius: effects.border.radius.default,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: colors.fg.quaternary,
              }}
            >
              <XIcon />
            </button>
          </div>

          {/* Content */}
          <div style={contentStyles}>
            {/* Branch Reason */}
            <div style={{ marginBottom: spacing[4] }}>
              <label
                htmlFor="branch-reason"
                style={{
                  display: 'block',
                  marginBottom: spacing[1],
                  fontSize: typography.sizes.sm,
                  fontWeight: 500,
                  color: colors.fg.secondary,
                  fontFamily: typography.fonts.body,
                }}
              >
                Why are you branching? <span style={{ color: colors.semantic.error }}>*</span>
              </label>
              <textarea
                id="branch-reason"
                value={branchReason}
                onChange={(e) => setBranchReason(e.target.value)}
                placeholder="e.g., Explore alternative implementation..."
                rows={1}
                maxLength={60}
                style={{
                  width: '100%',
                  padding: spacing[2],
                  backgroundColor: colors.bg.inset,
                  border: '1px solid var(--border-primary)',
                  borderRadius: effects.border.radius.default,
                  color: colors.fg.primary,
                  fontSize: typography.sizes.sm,
                  fontFamily: typography.fonts.body,
                  resize: 'none',
                  outline: 'none',
                }}
              />
              {/* Character counter and preview */}
              <div style={{ 
                marginTop: spacing[1], 
                fontSize: typography.sizes.xs, 
                color: colors.fg.quaternary,
                fontFamily: typography.fonts.body,
              }}>
                {branchReason.length}/60 characters
              </div>
            </div>

            {/* Inheritance Mode Selection */}
            <div style={{ marginBottom: spacing[4] }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: spacing[2],
                  fontSize: typography.sizes.sm,
                  fontWeight: 500,
                  color: colors.fg.secondary,
                  fontFamily: typography.fonts.body,
                }}
              >
                Context Inheritance
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[2] }}>
                {modeOptions.map((option) => (
                  <label
                    key={option.id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: spacing[2],
                      padding: spacing[2],
                      backgroundColor: inheritanceMode === option.id 
                        ? `${colors.accent.primary}15` 
                        : colors.bg.inset,
                      border: `1px solid ${inheritanceMode === option.id 
                        ? colors.accent.primary 
                        : 'var(--border-primary)'}`,
                      borderRadius: effects.border.radius.default,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <input
                      type="radio"
                      name="inheritance-mode"
                      value={option.id}
                      checked={inheritanceMode === option.id}
                      onChange={() => setInheritanceMode(option.id)}
                      style={{ marginTop: '2px' }}
                    />
                    <div style={{ 
                      color: inheritanceMode === option.id ? colors.accent.primary : colors.fg.quaternary,
                      marginTop: '2px',
                    }}>
                      {option.icon}
                    </div>
                    <div>
                      <div style={{ 
                        fontWeight: 500, 
                        color: colors.fg.primary,
                        marginBottom: '2px',
                        fontFamily: typography.fonts.body,
                      }}>
                        {option.label}
                      </div>
                      <div style={{ 
                        fontSize: typography.sizes.xs, 
                        color: colors.fg.quaternary,
                        fontFamily: typography.fonts.body,
                      }}>
                        {option.description}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Stats Preview */}
            {stats && (
              <div style={{
                padding: spacing[2],
                backgroundColor: colors.bg.inset,
                borderRadius: effects.border.radius.default,
                fontSize: typography.sizes.xs,
                color: colors.fg.quaternary,
                fontFamily: typography.fonts.body,
              }}>
                <strong style={{ color: colors.fg.secondary }}>Context preview:</strong>{' '}
                {inheritanceMode === 'full' 
                  ? `${stats.totalMessages} messages (${stats.totalTokens.toLocaleString()} tokens) — full context passed to AI`
                  : `${stats.totalMessages} messages → AI will generate a concise summary`
                }
              </div>
            )}

            {/* Validation Messages */}
            {validationError && (
              <div style={{
                marginTop: spacing[2],
                padding: spacing[2],
                backgroundColor: `${colors.semantic.error}15`,
                border: `1px solid ${colors.semantic.error}`,
                borderRadius: effects.border.radius.default,
                display: 'flex',
                alignItems: 'center',
                gap: spacing[1],
                fontSize: typography.sizes.xs,
                color: colors.semantic.error,
                fontFamily: typography.fonts.body,
              }}>
                <AlertCircleIcon />
                {validationError}
              </div>
            )}

            {validationWarning && !validationError && (
              <div style={{
                marginTop: spacing[2],
                padding: spacing[2],
                backgroundColor: `${colors.accent.primary}15`,
                border: `1px solid ${colors.accent.primary}`,
                borderRadius: effects.border.radius.default,
                display: 'flex',
                alignItems: 'center',
                gap: spacing[1],
                fontSize: typography.sizes.xs,
                color: colors.accent.primary,
                fontFamily: typography.fonts.body,
              }}>
                <AlertCircleIcon />
                {validationWarning}
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={footerStyles}>
            {/* Remember choice checkbox */}
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing[2],
                cursor: 'pointer',
                marginRight: 'auto',
              }}
            >
              <input
                type="checkbox"
                checked={rememberChoice}
                onChange={(e) => setRememberChoice(e.target.checked)}
                style={{
                  width: 16,
                  height: 16,
                  accentColor: colors.accent.primary,
                  cursor: 'pointer',
                }}
              />
              <span style={{
                fontSize: typography.sizes.xs,
                color: colors.fg.quaternary,
                fontFamily: typography.fonts.body,
              }}>
                Remember this choice as default
              </span>
            </label>

            <button
              onClick={handleClose}
              style={{
                padding: `${spacing[2]} ${spacing[3]}`,
                backgroundColor: 'transparent',
                border: '1px solid var(--border-primary)',
                borderRadius: effects.border.radius.default,
                color: colors.fg.secondary,
                fontSize: typography.sizes.sm,
                fontFamily: typography.fonts.body,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!branchReason.trim() || !!validationError || isGeneratingSummary}
              style={{
                padding: `${spacing[2]} ${spacing[3]}`,
                backgroundColor: !branchReason.trim() || validationError || isGeneratingSummary
                  ? colors.bg.inset 
                  : colors.accent.primary,
                border: 'none',
                borderRadius: effects.border.radius.default,
                color: !branchReason.trim() || validationError || isGeneratingSummary
                  ? colors.fg.quaternary 
                  : colors.bg.inset,
                fontSize: typography.sizes.sm,
                fontFamily: typography.fonts.body,
                fontWeight: 500,
                cursor: !branchReason.trim() || validationError || isGeneratingSummary ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: spacing[1],
              }}
            >
              <GitBranchIcon size={16} />
              {isGeneratingSummary ? 'Generating Summary...' : 'Create Branch'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default BranchDialog;
