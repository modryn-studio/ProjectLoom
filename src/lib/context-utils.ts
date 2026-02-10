/**
 * Context Utilities for Phase 2 Branching
 * 
 * Handles context inheritance with full message history.
 * 
 * @version 2.0.0
 */

import type { 
  Message, 
  InheritanceMode, 
  ContextSnapshot,
  ContextMetadata,
  BranchMetadata,
} from '@/types';

// =============================================================================
// TOKEN ESTIMATION
// =============================================================================

/**
 * Rough token estimation: 1 token ≈ 4 characters
 */
const CHARS_PER_TOKEN = 4;

/**
 * Estimate token count for a message
 */
export function estimateMessageTokens(message: Message): number {
  return Math.ceil(message.content.length / CHARS_PER_TOKEN);
}

/**
 * Estimate total token count for messages
 */
export function estimateTokens(messages: Message[]): number {
  return messages.reduce((sum, m) => sum + estimateMessageTokens(m), 0);
}

// =============================================================================
// MAIN API
// =============================================================================

/**
 * Select context messages based on inheritance mode
 */
export function selectContextMessages(
  messages: Message[],
  mode: InheritanceMode,
  _selectedIds?: string[]
): Message[] {
  void _selectedIds;
  // Always return full context
  return [...messages];
}

// =============================================================================
// CONTEXT SNAPSHOT CREATION
// =============================================================================

/**
 * Create a context snapshot from a conversation for branching
 */
export function createContextSnapshot(
  messages: Message[],
  mode: InheritanceMode,
  branchReason: string,
  sourceConversationId: string,
  parentCanvasId: string,
  selectedIds?: string[]
): ContextSnapshot {
  const selectedMessages = selectContextMessages(messages, mode, selectedIds);
  
  const metadata: ContextMetadata = {
    decisions: [],
    assumptions: [],
    branchReason,
    messageCount: selectedMessages.length,
    tokenCount: estimateTokens(selectedMessages),
  };
  
  return {
    messages: selectedMessages,
    metadata,
    timestamp: new Date(),
    parentCanvasId,
    sourceConversationId,
  };
}

/**
 * Create branch metadata (v4 - card level)
 */
export function createBranchMetadata(
  parentCardId: string,
  messageIndex: number,
  inheritedMessageCount: number,
  inheritanceMode: InheritanceMode
): BranchMetadata {
  return {
    parentCardId,
    messageIndex,
    inheritedMessageCount,
    inheritanceMode,
    createdAt: new Date(),
  };
}

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Validate branch data before creation
 */
export function validateBranchData(
  _mode: InheritanceMode,
  _customMessageIds?: string[],
  _messages?: Message[]
): { valid: boolean; error?: string; warning?: string } {
  void _mode;
  void _customMessageIds;
  void _messages;
  // Always valid with full context
  return { valid: true };
}

// =============================================================================
// MAIN API
// =============================================================================
