'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, GitBranch, MessageSquare, FileText, RefreshCw } from 'lucide-react';

import { useCanvasStore } from '@/stores/canvas-store';
import { colors, spacing, effects, typography } from '@/lib/design-tokens';
import { detectProvider, estimateMessagesTokens, estimateCost, formatCost } from '@/lib/vercel-ai-integration';
import { useUsageStore } from '@/stores/usage-store';
import { apiKeyManager } from '@/lib/api-key-manager';
import type { InheritanceMode, Message, Conversation } from '@/types';

// =============================================================================
// STYLES
// =============================================================================

const containerStyles: React.CSSProperties = {
  backgroundColor: colors.bg.secondary,
  borderBottom: '1px solid var(--border-primary)',
  borderRadius: effects.border.radius.default,
  overflow: 'hidden',
};

const headerStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: `${spacing[2]} ${spacing[3]}`,
  cursor: 'pointer',
};

const contentStyles: React.CSSProperties = {
  padding: `0 ${spacing[3]} ${spacing[3]}`,
};

const parentSectionStyles: React.CSSProperties = {
  padding: `${spacing[2]} 0`,
  borderTop: '1px solid var(--border-primary)',
};

const parentHeaderStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: spacing[2],
  marginBottom: spacing[2],
};

const badgeStyles: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: `2px ${spacing[1]}`,
  borderRadius: effects.border.radius.default,
  fontSize: typography.sizes.xs,
  fontFamily: typography.fonts.body,
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getModeLabel(mode: InheritanceMode): string {
  switch (mode) {
    case 'full': return 'Full Context';
    case 'summary': return 'Summary';
    default: return mode;
  }
}

function getModeColor(mode: InheritanceMode): string {
  switch (mode) {
    case 'full': return colors.semantic.success;
    case 'summary': return colors.accent.primary;
    default: return colors.fg.quaternary;
  }
}

interface ParentContextEntry {
  parentId: string;
  parentTitle: string;
  context: {
    mode: InheritanceMode;
    messages?: Message[];
    timestamp: string | Date;
  };
  parentConversation: Conversation | null;
  isSummaryMode: boolean;
  regenerateCostEstimate: string | null;
}

// =============================================================================
// INHERITED CONTEXT PANEL COMPONENT (v4 - Card-Level Branching)
// =============================================================================

/**
 * InheritedContextPanel - v4 Version
 * 
 * In v4, branching happens at the card level, not canvas level.
 * This panel shows inherited context for cards that have parent cards.
 */
export function InheritedContextPanel() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [regeneratingParentId, setRegeneratingParentId] = useState<string | null>(null);
  const [regenerateErrors, setRegenerateErrors] = useState<Record<string, string>>({});

  // Get current workspace and selected node to find inherited context
  const selectedNodeIds = useCanvasStore((s) => s.selectedNodeIds);
  const conversations = useCanvasStore((s) => s.conversations);
  const updateInheritedSummary = useCanvasStore((s) => s.updateInheritedSummary);
  const addUsage = useUsageStore((s) => s.addUsage);
  
  // Get the first selected conversation that has inherited context
  const selectedConversation = useMemo<Conversation | null>(() => {
    const selectedIds = Array.from(selectedNodeIds);
    if (selectedIds.length === 0) return null;
    
    const conv = conversations.get(selectedIds[0]);
    if (!conv) return null;
    
    // Check if this conversation has any inherited context
    if (conv.parentCardIds.length === 0) return null;
    
    return conv;
  }, [selectedNodeIds, conversations]);

  const parentEntries = useMemo(() => {
    if (!selectedConversation) return [];

    const entries: ParentContextEntry[] = [];
    
    for (const parentId of selectedConversation.parentCardIds) {
      const context = selectedConversation.inheritedContext[parentId];
      if (!context) continue;

      const parentConversation = conversations.get(parentId) || null;
      const parentTitle = parentConversation?.metadata.title || 'Parent Card';
      const isSummaryMode = context.mode === 'summary';
      const regenerateCostEstimate = isSummaryMode && parentConversation
        ? formatCost(
            estimateCost(
              estimateMessagesTokens(parentConversation.content),
              500,
              'claude-sonnet-4-5'
            )
          )
        : null;

      entries.push({
        parentId,
        parentTitle,
        context,
        parentConversation,
        isSummaryMode,
        regenerateCostEstimate,
      });
    }
    
    return entries;
  }, [selectedConversation, conversations]);

  // Handle regenerate summary
  const handleRegenerateSummary = useCallback(async (parentId: string) => {
    if (!selectedConversation) return;

    const parentConversation = conversations.get(parentId);
    const inheritedEntry = selectedConversation.inheritedContext[parentId];

    if (!parentConversation || !inheritedEntry || inheritedEntry.mode !== 'summary') {
      setRegenerateErrors((prev) => ({
        ...prev,
        [parentId]: 'Parent card not found or summary mode unavailable.',
      }));
      return;
    }

    setRegeneratingParentId(parentId);
    setRegenerateErrors((prev) => ({
      ...prev,
      [parentId]: '',
    }));

    try {
      const anthropicKey = apiKeyManager.getKey('anthropic');
      const openaiKey = apiKeyManager.getKey('openai');
      const apiKey = anthropicKey || openaiKey;
      const model = anthropicKey ? 'claude-sonnet-4-5' : 'gpt-5.2';

      if (!apiKey) {
        setRegenerateErrors((prev) => ({
          ...prev,
          [parentId]: 'No API key configured. Add one in Settings.',
        }));
        setRegeneratingParentId(null);
        return;
      }

      // Use full parent conversation for regeneration (prevents summary drift)
      const messagesForSummary = parentConversation.content.map((m: Message) => ({
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
          parentTitle: parentConversation.metadata.title,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setRegenerateErrors((prev) => ({
          ...prev,
          [parentId]: errorData.error || 'Failed to regenerate summary.',
        }));
        setRegeneratingParentId(null);
        return;
      }

      const data = await response.json() as { summary: string; usage?: { promptTokens: number; completionTokens: number; totalTokens: number } };

      if (data.usage?.totalTokens) {
        addUsage({
          provider: detectProvider(model),
          model,
          inputTokens: data.usage.promptTokens,
          outputTokens: data.usage.completionTokens,
          conversationId: parentId,
          source: 'summarize',
        });
      }

      // Update the inherited context with new summary
      updateInheritedSummary(selectedConversation.id, parentId, data.summary);
      setRegeneratingParentId(null);
    } catch (error) {
      console.error('[InheritedContextPanel] Summary regeneration failed:', error);
      setRegenerateErrors((prev) => ({
        ...prev,
        [parentId]: 'Failed to regenerate summary. Check your connection.',
      }));
      setRegeneratingParentId(null);
    }
  }, [selectedConversation, conversations, updateInheritedSummary, addUsage]);

  // Don't render if no inherited context
  if (!selectedConversation || parentEntries.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      style={containerStyles}
    >
      {/* Header - always visible */}
      <div 
        style={headerStyles}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2] }}>
          <GitBranch size={16} color={colors.accent.primary} />
          <span style={{ 
            fontSize: typography.sizes.sm, 
            fontWeight: 500,
            color: colors.fg.primary,
            fontFamily: typography.fonts.body,
          }}>
            Inherited context
          </span>

          <span style={{
            ...badgeStyles,
            backgroundColor: colors.bg.inset,
            color: colors.fg.quaternary,
          }}>
            {parentEntries.length} {parentEntries.length === 1 ? 'parent' : 'parents'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2] }}>
          {/* Expand/collapse toggle */}
          <button
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 24,
              height: 24,
              background: 'transparent',
              border: 'none',
              color: colors.fg.quaternary,
              cursor: 'pointer',
            }}
          >
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Expandable content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={contentStyles}>
              {parentEntries.map((entry) => {
                const inheritedMessages: Message[] = entry.context.messages || [];
                const inheritanceMode: InheritanceMode = entry.context.mode;
                const isRegenerating = regeneratingParentId === entry.parentId;
                const regenerateError = regenerateErrors[entry.parentId];

                return (
                  <div key={entry.parentId} style={parentSectionStyles}>
                    <div style={parentHeaderStyles}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2] }}>
                        <span style={{
                          fontSize: typography.sizes.sm,
                          fontWeight: 500,
                          color: colors.fg.primary,
                          fontFamily: typography.fonts.body,
                        }}>
                          {`Inherited from "${entry.parentTitle}"`}
                        </span>

                        <span style={{
                          ...badgeStyles,
                          backgroundColor: `${getModeColor(inheritanceMode)}20`,
                          color: getModeColor(inheritanceMode),
                        }}>
                          {getModeLabel(inheritanceMode)}
                        </span>

                        <span style={{
                          ...badgeStyles,
                          backgroundColor: colors.bg.inset,
                          color: colors.fg.quaternary,
                        }}>
                          <MessageSquare size={12} />
                          {inheritedMessages.length}
                        </span>
                      </div>
                    </div>

                    <div>
                      <div style={{ 
                        fontSize: typography.sizes.xs, 
                        color: colors.fg.quaternary,
                        marginBottom: spacing[1],
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        fontFamily: typography.fonts.body,
                      }}>
                        <FileText size={12} />
                        Inherited messages ({inheritedMessages.length})
                      </div>
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: spacing[1],
                        maxHeight: 200,
                        overflowY: 'auto',
                        padding: spacing[2],
                        backgroundColor: colors.bg.inset,
                        borderRadius: effects.border.radius.default,
                      }}>
                        {inheritedMessages.slice(0, 5).map((msg: Message) => (
                          <div
                            key={msg.id}
                            style={{
                              display: 'flex',
                              gap: spacing[2],
                              padding: spacing[1],
                              backgroundColor: msg.role === 'user' 
                                ? 'var(--accent-muted)' 
                                : msg.role === 'system'
                                ? 'var(--warning-muted)'
                                : 'transparent',
                              borderRadius: effects.border.radius.default,
                            }}
                          >
                            <span style={{ 
                              flexShrink: 0,
                              width: 60,
                              fontSize: typography.sizes.xs,
                              color: msg.role === 'user' 
                                ? colors.accent.primary 
                                : msg.role === 'system'
                                ? colors.accent.primary
                                : colors.accent.primary,
                              fontWeight: 500,
                              fontFamily: typography.fonts.body,
                            }}>
                              {msg.role === 'user' ? 'You' : msg.role === 'system' ? 'Summary' : 'Assistant'}
                            </span>
                            <span style={{
                              fontSize: typography.sizes.xs,
                              color: colors.fg.secondary,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: msg.role === 'system' && entry.isSummaryMode ? 'pre-wrap' : 'nowrap',
                              fontFamily: typography.fonts.body,
                              ...(msg.role === 'system' && entry.isSummaryMode ? { maxHeight: 150, overflowY: 'auto' as const } : {}),
                            }}>
                              {msg.role === 'system' && entry.isSummaryMode
                                ? msg.content
                                : msg.content.substring(0, 100) + (msg.content.length > 100 ? '...' : '')
                              }
                            </span>
                          </div>
                        ))}
                        {inheritedMessages.length > 5 && (
                          <div style={{
                            fontSize: typography.sizes.xs,
                            color: colors.fg.quaternary,
                            textAlign: 'center',
                            padding: spacing[1],
                            fontFamily: typography.fonts.body,
                          }}>
                            +{inheritedMessages.length - 5} more messages
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{
                      marginTop: spacing[2],
                      fontSize: typography.sizes.xs,
                      color: colors.fg.quaternary,
                      fontFamily: typography.fonts.body,
                    }}>
                      Inherited: {new Date(entry.context.timestamp).toLocaleString()}
                    </div>

                    {entry.isSummaryMode && (
                      <div style={{ marginTop: spacing[2] }}>
                        <button
                          onClick={() => handleRegenerateSummary(entry.parentId)}
                          disabled={isRegenerating || !entry.parentConversation}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: spacing[1],
                            padding: `${spacing[1]} ${spacing[2]}`,
                            backgroundColor: isRegenerating ? colors.bg.inset : `${colors.accent.primary}15`,
                            border: `1px solid ${colors.accent.primary}`,
                            borderRadius: effects.border.radius.default,
                            color: isRegenerating ? colors.fg.quaternary : colors.accent.primary,
                            fontSize: typography.sizes.xs,
                            fontFamily: typography.fonts.body,
                            cursor: isRegenerating ? 'not-allowed' : 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <RefreshCw 
                            size={12} 
                            style={isRegenerating ? { animation: 'spin 1s linear infinite' } : undefined} 
                          />
                          {isRegenerating ? 'Regenerating...' : 'Regenerate Summary'}
                          {entry.regenerateCostEstimate && !isRegenerating && (
                            <span style={{ 
                              color: colors.fg.quaternary,
                              marginLeft: 4,
                            }}>
                              ({entry.regenerateCostEstimate})
                            </span>
                          )}
                        </button>

                        {regenerateError && (
                          <div style={{
                            marginTop: spacing[1],
                            padding: spacing[1],
                            backgroundColor: `${colors.semantic.error}15`,
                            border: `1px solid ${colors.semantic.error}`,
                            borderRadius: effects.border.radius.default,
                            fontSize: typography.sizes.xs,
                            color: colors.semantic.error,
                            fontFamily: typography.fonts.body,
                          }}>
                            {regenerateError}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default InheritedContextPanel;
