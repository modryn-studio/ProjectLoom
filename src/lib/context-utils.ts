/**
 * Context Utilities for Phase 2 Branching
 * 
 * Smart truncation strategies for context inheritance.
 * Supports full, summary (smart truncation), and custom (manual selection) modes.
 * 
 * @version 2.0.0
 */

import type { 
  Message, 
  InheritanceMode, 
  TruncationStrategy, 
  TruncationPreview,
  ContextSnapshot,
  ContextMetadata,
  BranchMetadata,
} from '@/types';

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Default truncation configuration
 */
export const TRUNCATION_CONFIG = {
  summary: {
    strategy: 'boundary' as const,
    maxMessages: 10,
    showPreview: true,
  },
  strategies: {
    recent: { maxMessages: 10 },
    important: { maxMessages: 10 },
    boundary: { maxMessages: 10 },
  },
} as const;

/**
 * Rough token estimation: 1 token ≈ 4 characters
 */
const CHARS_PER_TOKEN = 4;

// =============================================================================
// TOKEN ESTIMATION
// =============================================================================

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
// TRUNCATION STRATEGIES
// =============================================================================

/**
 * Simple: Take last N messages
 */
function truncateRecent(messages: Message[], maxMessages: number): Message[] {
  if (messages.length <= maxMessages) return messages;
  return messages.slice(-maxMessages);
}

/**
 * Smart: Detect conversation boundaries and truncate at natural breaks
 * A boundary is where a user message follows an assistant message (new topic)
 */
function truncateBoundary(messages: Message[], maxMessages: number): Message[] {
  if (messages.length <= maxMessages) return messages;
  
  // Find conversation boundaries (user messages followed by assistant responses)
  const boundaries: number[] = [0];
  
  for (let i = 1; i < messages.length; i++) {
    const prev = messages[i - 1];
    const curr = messages[i];
    
    // New conversation boundary: assistant → user transition
    if (prev.role === 'assistant' && curr.role === 'user') {
      boundaries.push(i);
    }
  }
  
  // Find closest boundary to our target
  const targetIndex = messages.length - maxMessages;
  const closestBoundary = boundaries.reduce((prev, curr) => 
    Math.abs(curr - targetIndex) < Math.abs(prev - targetIndex) ? curr : prev
  );
  
  // Return from boundary onwards (ensures we start with user message)
  return messages.slice(closestBoundary);
}

/**
 * Important: Preserve first message (context) + recent messages + code blocks
 */
function truncateImportant(messages: Message[], maxMessages: number): Message[] {
  if (messages.length <= maxMessages) return messages;
  
  const result: Message[] = [];
  const usedIds = new Set<string>();
  
  // 1. Always keep system messages
  const systemMessages = messages.filter(m => m.role === 'system');
  systemMessages.forEach(m => {
    result.push(m);
    usedIds.add(m.id);
  });
  
  // 2. Always keep first user message (often contains important context)
  const firstUserMessage = messages.find(m => m.role === 'user');
  if (firstUserMessage && !usedIds.has(firstUserMessage.id)) {
    result.push(firstUserMessage);
    usedIds.add(firstUserMessage.id);
  }
  
  // 3. Keep messages with code blocks (high value)
  const codeMessages = messages.filter(m => 
    m.content.includes('```') && !usedIds.has(m.id)
  );
  const remainingSlots = maxMessages - result.length;
  const codeSlotsToUse = Math.min(Math.floor(remainingSlots / 2), codeMessages.length);
  codeMessages.slice(-codeSlotsToUse).forEach(m => {
    result.push(m);
    usedIds.add(m.id);
  });
  
  // 4. Fill remaining with most recent messages
  const recentCount = maxMessages - result.length;
  const recentMessages = messages
    .filter(m => !usedIds.has(m.id))
    .slice(-recentCount);
  result.push(...recentMessages);
  
  // Sort by original order
  const orderMap = new Map(messages.map((m, i) => [m.id, i]));
  result.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));
  
  return result;
}

// =============================================================================
// MAIN API
// =============================================================================

/**
 * Apply truncation strategy to messages
 */
export function truncateContext(
  messages: Message[],
  strategy: TruncationStrategy
): Message[] {
  switch (strategy.type) {
    case 'recent':
      return truncateRecent(messages, strategy.maxMessages);
    case 'boundary':
      return truncateBoundary(messages, strategy.maxMessages);
    case 'important':
      return truncateImportant(messages, strategy.maxMessages);
    default:
      return truncateRecent(messages, strategy.maxMessages);
  }
}

/**
 * Select context messages based on inheritance mode
 */
export function selectContextMessages(
  messages: Message[],
  mode: InheritanceMode,
  selectedIds?: string[]
): Message[] {
  switch (mode) {
    case 'full':
      return [...messages];
    
    case 'summary':
      return truncateContext(messages, {
        type: TRUNCATION_CONFIG.summary.strategy,
        maxMessages: TRUNCATION_CONFIG.summary.maxMessages,
      });
    
    case 'custom':
      if (!selectedIds || selectedIds.length === 0) {
        console.warn('Custom mode requires selectedIds, falling back to empty');
        return [];
      }
      const idSet = new Set(selectedIds);
      return messages.filter(m => idSet.has(m.id));
    
    default:
      return [...messages];
  }
}

/**
 * Get truncation preview for UI
 */
export function getTruncationPreview(
  messages: Message[],
  strategy: TruncationStrategy
): TruncationPreview {
  const truncated = truncateContext(messages, strategy);
  const removed = messages.length - truncated.length;
  
  const originalTokens = estimateTokens(messages);
  const truncatedTokens = estimateTokens(truncated);
  const tokensSaved = originalTokens - truncatedTokens;
  
  return { truncated, removed, tokensSaved };
}

/**
 * Get smart initial selection for custom mode
 * Pre-selects first message + last N messages
 */
export function getSmartInitialSelection(messages: Message[], recentCount = 10): Set<string> {
  const selected = new Set<string>();
  
  if (messages.length === 0) return selected;
  
  // Always include first message (often contains important context)
  selected.add(messages[0].id);
  
  // Include last N messages
  const startIdx = Math.max(1, messages.length - recentCount);
  messages.slice(startIdx).forEach(m => selected.add(m.id));
  
  return selected;
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
 * Create branch metadata
 */
export function createBranchMetadata(
  branchReason: string,
  sourceConversationId: string,
  inheritedMessageCount: number,
  inheritanceMode: InheritanceMode
): BranchMetadata {
  return {
    reason: branchReason,
    createdFromConversationId: sourceConversationId,
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
  mode: InheritanceMode,
  customMessageIds?: string[],
  messages?: Message[]
): { valid: boolean; error?: string; warning?: string } {
  if (mode === 'custom') {
    if (!customMessageIds || customMessageIds.length === 0) {
      return {
        valid: false,
        error: 'Custom mode requires at least one message to be selected.',
      };
    }
    
    if (customMessageIds.length === 1) {
      return {
        valid: true,
        warning: 'Only one message selected. Consider selecting more for better context.',
      };
    }
  }
  
  if (mode === 'summary' && messages) {
    const preview = getTruncationPreview(messages, {
      type: TRUNCATION_CONFIG.summary.strategy,
      maxMessages: TRUNCATION_CONFIG.summary.maxMessages,
    });
    
    if (preview.removed > 0) {
      return {
        valid: true,
        warning: `Summary mode will exclude ${preview.removed} messages (~${preview.tokensSaved} tokens).`,
      };
    }
  }
  
  return { valid: true };
}
