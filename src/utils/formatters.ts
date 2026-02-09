/**
 * Text and Date Formatting Utilities
 * 
 * Provides formatting functions for display in cards and UI.
 * 
 * @version 1.0.0
 */

// =============================================================================
// DATE FORMATTERS
// =============================================================================

/**
 * Format timestamp to relative time (e.g., "Just now", "2h ago", "3d ago")
 * Falls back to absolute date for older timestamps
 */
export function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const target = typeof date === 'string' ? new Date(date) : date;
  const diffMs = now.getTime() - target.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return target.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Smart truncate text at word boundary
 * Avoids cutting words in half by truncating at the last space
 */
export function smartTruncate(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text;
  
  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  
  // If there's a space within reasonable distance (70% of max), truncate there
  if (lastSpace > maxLength * 0.7) {
    return truncated.slice(0, lastSpace) + '...';
  }
  
  // Otherwise just truncate at max length
  return truncated + '...';
}

/**
 * Format timestamp for display with optional time
 */
export function formatTimestamp(date: Date | string, includeTime = false): string {
  const target = typeof date === 'string' ? new Date(date) : date;
  
  const dateOptions: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  };
  
  if (includeTime) {
    return target.toLocaleString('en-US', {
      ...dateOptions,
      hour: 'numeric',
      minute: '2-digit',
    });
  }
  
  return target.toLocaleDateString('en-US', dateOptions);
}

// =============================================================================
// TEXT FORMATTERS
// =============================================================================

/**
 * Truncate text to max characters with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
}

/**
 * Truncate text to max words
 */
export function truncateWords(text: string, maxWords: number): string {
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(' ') + '...';
}

/**
 * Strip markdown formatting for plain text display
 */
export function stripMarkdown(text: string): string {
  return text
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, '[code]')
    // Remove inline code
    .replace(/`[^`]+`/g, '[code]')
    // Remove images
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '[image]')
    // Remove links but keep text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    // Remove emphasis
    .replace(/[*_]{1,2}([^*_]+)[*_]{1,2}/g, '$1')
    // Remove headers
    .replace(/^#+\s+/gm, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Get preview text from content - strips markdown and truncates
 */
export function getPreviewText(content: string, maxChars = 100): string {
  const stripped = stripMarkdown(content);
  return truncate(stripped, maxChars);
}

/**
 * Enforce maximum word limit on a title
 */
export function enforceTitleWordLimit(title: string, maxWords: number = 2): string {
  return title.trim().split(/\s+/).slice(0, maxWords).join(' ');
}

/**
 * Generate a short, readable conversation title from user/assistant text
 */
export function generateConversationTitle(options: {
  userText: string;
  assistantText?: string;
  maxWords?: number;
  maxChars?: number;
}): string {
  const {
    userText,
    assistantText,
    maxWords = 2,
    maxChars = 60,
  } = options;

  const combined = assistantText ? `${userText} ${assistantText}` : userText;
  const cleaned = stripMarkdown(combined)
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return 'Untitled';

  const words = cleaned.split(' ');
  const clipped = words.slice(0, maxWords).join(' ');
  let title = clipped.replace(/[.,:;!?]+$/g, '').trim();

  if (title.length > maxChars) {
    title = title.slice(0, maxChars).trim();
  }

  if (!title) return 'Untitled';

  return title.charAt(0).toUpperCase() + title.slice(1);
}

// =============================================================================
// NUMBER FORMATTERS
// =============================================================================

/**
 * Format count with compact notation (e.g., 1.2K, 3.4M)
 */
export function formatCompactNumber(num: number): string {
  if (num < 1000) return num.toString();
  if (num < 1000000) return `${(num / 1000).toFixed(1)}K`;
  return `${(num / 1000000).toFixed(1)}M`;
}

/**
 * Format message count with label
 */
export function formatMessageCount(count: number): string {
  if (count === 1) return '1 msg';
  return `${count} msgs`;
}
