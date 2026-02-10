/**
 * Context Utilities for Phase 2 Branching
 * 
 * Handles context inheritance with full message history.
 * 
 * @version 2.0.0
 */

import type { 
  Message, 
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
 * Select context messages (always full context)
 */
export function selectContextMessages(
  messages: Message[]
): Message[] {
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
  branchReason: string,
  sourceConversationId: string,
  parentCanvasId: string
): ContextSnapshot {
  const selectedMessages = selectContextMessages(messages);
  
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
  inheritedMessageCount: number
): BranchMetadata {
  return {
    parentCardId,
    messageIndex,
    inheritedMessageCount,
    inheritanceMode: 'full',
    createdAt: new Date(),
  };
}

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Validate branch data before creation
 */
export function validateBranchData(): { valid: boolean; error?: string; warning?: string } {
  // Always valid with full context
  return { valid: true };
}

// =============================================================================
// MAIN API
// =============================================================================
