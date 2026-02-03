'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import { useCanvasStore, selectBranchDialogOpen, selectBranchSourceId } from '@/stores/canvas-store';
import { usePreferencesStore, selectDefaultInheritanceMode } from '@/stores/preferences-store';
import { colors, spacing, effects, animation, typography } from '@/lib/design-tokens';
import { 
  getTruncationPreview, 
  estimateTokens, 
  getSmartInitialSelection,
  validateBranchData,
  TRUNCATION_CONFIG,
} from '@/lib/context-utils';
import { MessageSelector } from './MessageSelector';
import type { InheritanceMode, Message, TruncationPreview } from '@/types';

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

const CheckSquareIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
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
  backgroundColor: colors.navy.light,
  borderRadius: effects.border.radius.md,
  border: `1px solid rgba(99, 102, 241, 0.3)`,
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
  borderBottom: `1px solid rgba(99, 102, 241, 0.2)`,
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
  borderTop: `1px solid rgba(99, 102, 241, 0.2)`,
  display: 'flex',
  justifyContent: 'flex-end',
  gap: spacing[2],
};

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
    description: 'Include all messages from the conversation',
    icon: <FileTextIcon />,
  },
  {
    id: 'summary',
    label: 'Summary',
    description: 'Smart selection of important messages',
    icon: <ScissorsIcon />,
  },
  {
    id: 'custom',
    label: 'Custom Selection',
    description: 'Choose which messages to include',
    icon: <CheckSquareIcon />,
  },
];

// =============================================================================
// BRANCH DIALOG COMPONENT
// =============================================================================

export function BranchDialog() {
  // Store state
  const branchDialogOpen = useCanvasStore(selectBranchDialogOpen);
  const branchSourceId = useCanvasStore(selectBranchSourceId);
  const closeBranchDialog = useCanvasStore((s) => s.closeBranchDialog);
  const createBranch = useCanvasStore((s) => s.createBranch);
  const conversations = useCanvasStore((s) => s.conversations);

  // Preferences
  const defaultInheritanceMode = usePreferencesStore(selectDefaultInheritanceMode);
  const setBranchingPreferences = usePreferencesStore((s) => s.setBranchingPreferences);

  // Local state
  const [branchReason, setBranchReason] = useState('');
  const [inheritanceMode, setInheritanceMode] = useState<InheritanceMode>(defaultInheritanceMode);
  const [customSelection, setCustomSelection] = useState<Set<string>>(new Set());
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validationWarning, setValidationWarning] = useState<string | null>(null);
  const [rememberChoice, setRememberChoice] = useState(false);

  // Sync with default inheritance mode when dialog opens
  useEffect(() => {
    if (branchDialogOpen) {
      setInheritanceMode(defaultInheritanceMode);
    }
  }, [branchDialogOpen, defaultInheritanceMode]);

  // Get source conversation
  const sourceConversation = useMemo(() => 
    branchSourceId ? conversations.get(branchSourceId) : undefined,
    [conversations, branchSourceId]
  );

  const messages: Message[] = sourceConversation?.content || [];

  // Initialize custom selection with smart defaults
  useEffect(() => {
    if (branchDialogOpen && messages.length > 0) {
      const smartSelection = getSmartInitialSelection(messages);
      setCustomSelection(new Set(smartSelection));
    }
  }, [branchDialogOpen, messages]);

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
    } else if (inheritanceMode === 'summary') {
      const preview = getTruncationPreview(messages, {
        type: TRUNCATION_CONFIG.summary.strategy,
        maxMessages: TRUNCATION_CONFIG.summary.maxMessages,
      });
      selectedMessages = preview.truncated.length;
      selectedTokens = totalTokens - preview.tokensSaved;
    } else {
      const selectedMsgs = messages.filter((m: Message) => customSelection.has(m.id));
      selectedMessages = selectedMsgs.length;
      selectedTokens = estimateTokens(selectedMsgs);
    }

    return {
      totalMessages,
      totalTokens,
      selectedMessages,
      selectedTokens,
      saved: totalMessages - selectedMessages,
    };
  }, [messages, inheritanceMode, customSelection]);

  // Validate on change
  useEffect(() => {
    const validation = validateBranchData(
      inheritanceMode,
      Array.from(customSelection),
      messages
    );
    setValidationError(validation.valid ? null : validation.error || null);
    setValidationWarning(validation.warning || null);
  }, [inheritanceMode, customSelection, messages]);

  // Handle submit
  const handleSubmit = () => {
    if (!branchReason.trim()) {
      setValidationError('Please provide a reason for this branch');
      return;
    }

    if (validationError) return;

    // Save preference if user checked "Remember this choice"
    if (rememberChoice) {
      setBranchingPreferences({ defaultInheritanceMode: inheritanceMode });
    }

    createBranch({
      sourceConversationId: branchSourceId!,
      branchReason: branchReason.trim(),
      inheritanceMode,
      customMessageIds: inheritanceMode === 'custom' ? Array.from(customSelection) : undefined,
    });
  };

  // Handle close
  const handleClose = () => {
    setBranchReason('');
    setInheritanceMode(defaultInheritanceMode);
    setCustomSelection(new Set());
    setValidationError(null);
    setValidationWarning(null);
    setRememberChoice(false);
    closeBranchDialog();
  };

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && branchDialogOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [branchDialogOpen]);

  if (!branchDialogOpen || !sourceConversation) return null;

  return (
    <AnimatePresence>
      <motion.div
        style={overlayStyles}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={handleClose}
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
              <span style={{ color: colors.amber.primary }}>
                <GitBranchIcon size={24} />
              </span>
              <h2 style={{ 
                margin: 0, 
                fontSize: '1.25rem', 
                fontWeight: 600,
                color: colors.contrast.white,
                fontFamily: typography.fonts.heading,
              }}>
                Branch from "{sourceConversation.title}"
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
                color: colors.contrast.grayDark,
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
                  color: colors.contrast.gray,
                  fontFamily: typography.fonts.body,
                }}
              >
                Why are you branching? <span style={{ color: colors.semantic.error }}>*</span>
              </label>
              <textarea
                id="branch-reason"
                value={branchReason}
                onChange={(e) => setBranchReason(e.target.value)}
                placeholder="e.g., Explore alternative implementation, Try different approach..."
                rows={3}
                style={{
                  width: '100%',
                  padding: spacing[2],
                  backgroundColor: colors.navy.dark,
                  border: `1px solid rgba(99, 102, 241, 0.3)`,
                  borderRadius: effects.border.radius.default,
                  color: colors.contrast.white,
                  fontSize: typography.sizes.sm,
                  fontFamily: typography.fonts.body,
                  resize: 'vertical',
                  outline: 'none',
                }}
              />
            </div>

            {/* Inheritance Mode Selection */}
            <div style={{ marginBottom: spacing[4] }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: spacing[2],
                  fontSize: typography.sizes.sm,
                  fontWeight: 500,
                  color: colors.contrast.gray,
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
                        ? `${colors.amber.primary}15` 
                        : colors.navy.dark,
                      border: `1px solid ${inheritanceMode === option.id 
                        ? colors.amber.primary 
                        : 'rgba(99, 102, 241, 0.3)'}`,
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
                      color: inheritanceMode === option.id ? colors.amber.primary : colors.contrast.grayDark,
                      marginTop: '2px',
                    }}>
                      {option.icon}
                    </div>
                    <div>
                      <div style={{ 
                        fontWeight: 500, 
                        color: colors.contrast.white,
                        marginBottom: '2px',
                        fontFamily: typography.fonts.body,
                      }}>
                        {option.label}
                      </div>
                      <div style={{ 
                        fontSize: typography.sizes.xs, 
                        color: colors.contrast.grayDark,
                        fontFamily: typography.fonts.body,
                      }}>
                        {option.description}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Custom Message Selector */}
            {inheritanceMode === 'custom' && (
              <div style={{ marginBottom: spacing[4] }}>
                <MessageSelector
                  messages={messages}
                  selectedIds={customSelection}
                  onSelectionChange={setCustomSelection}
                />
              </div>
            )}

            {/* Stats Preview */}
            {stats && (
              <div style={{
                padding: spacing[2],
                backgroundColor: colors.navy.dark,
                borderRadius: effects.border.radius.default,
                fontSize: typography.sizes.xs,
                color: colors.contrast.grayDark,
                fontFamily: typography.fonts.body,
              }}>
                <strong style={{ color: colors.contrast.gray }}>Context preview:</strong>{' '}
                {stats.selectedMessages} of {stats.totalMessages} messages ({stats.selectedTokens.toLocaleString()} tokens)
                {stats.saved > 0 && (
                  <span style={{ color: colors.semantic.success }}>
                    {' '}• {stats.saved} messages excluded
                  </span>
                )}
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
                backgroundColor: `${colors.amber.primary}15`,
                border: `1px solid ${colors.amber.primary}`,
                borderRadius: effects.border.radius.default,
                display: 'flex',
                alignItems: 'center',
                gap: spacing[1],
                fontSize: typography.sizes.xs,
                color: colors.amber.primary,
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
                  accentColor: colors.amber.primary,
                  cursor: 'pointer',
                }}
              />
              <span style={{
                fontSize: typography.sizes.xs,
                color: colors.contrast.grayDark,
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
                border: `1px solid rgba(99, 102, 241, 0.3)`,
                borderRadius: effects.border.radius.default,
                color: colors.contrast.gray,
                fontSize: typography.sizes.sm,
                fontFamily: typography.fonts.body,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!branchReason.trim() || !!validationError}
              style={{
                padding: `${spacing[2]} ${spacing[3]}`,
                backgroundColor: !branchReason.trim() || validationError 
                  ? colors.navy.dark 
                  : colors.amber.primary,
                border: 'none',
                borderRadius: effects.border.radius.default,
                color: !branchReason.trim() || validationError 
                  ? colors.contrast.grayDark 
                  : colors.navy.dark,
                fontSize: typography.sizes.sm,
                fontFamily: typography.fonts.body,
                fontWeight: 500,
                cursor: !branchReason.trim() || validationError ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: spacing[1],
              }}
            >
              <GitBranchIcon size={16} />
              Create Branch
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default BranchDialog;
