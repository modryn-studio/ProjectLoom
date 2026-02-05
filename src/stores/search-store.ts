'use client';

/**
 * Search Store - Canvas search state management
 * 
 * Manages search query, results, and active selection for canvas-wide search.
 * 
 * @version 4.0.0
 */

import { create } from 'zustand';
import type { Conversation, Message } from '@/types';

// =============================================================================
// TYPES
// =============================================================================

export interface SearchResult {
  cardId: string;
  title: string;
  snippet: string;
  matchType: 'title' | 'message';
  matchCount: number;
}

interface SearchStore {
  // State
  isOpen: boolean;
  query: string;
  results: SearchResult[];
  activeIndex: number;
  
  // Actions
  openSearch: () => void;
  closeSearch: () => void;
  setQuery: (query: string) => void;
  setResults: (results: SearchResult[]) => void;
  nextResult: () => void;
  prevResult: () => void;
  setActiveIndex: (index: number) => void;
  reset: () => void;
}

// =============================================================================
// STORE
// =============================================================================

export const useSearchStore = create<SearchStore>((set, get) => ({
  isOpen: false,
  query: '',
  results: [],
  activeIndex: 0,
  
  openSearch: () => set({ isOpen: true }),
  
  closeSearch: () => set({ 
    isOpen: false,
    query: '', 
    results: [], 
    activeIndex: 0 
  }),
  
  setQuery: (query) => set({ query, activeIndex: 0 }),
  
  setResults: (results) => set({ results }),
  
  nextResult: () => {
    const { results, activeIndex } = get();
    if (results.length === 0) return;
    set({ activeIndex: (activeIndex + 1) % results.length });
  },
  
  prevResult: () => {
    const { results, activeIndex } = get();
    if (results.length === 0) return;
    set({ activeIndex: (activeIndex - 1 + results.length) % results.length });
  },
  
  setActiveIndex: (index) => set({ activeIndex: index }),
  
  reset: () => set({ query: '', results: [], activeIndex: 0 }),
}));

// =============================================================================
// SEARCH LOGIC
// =============================================================================

/**
 * Search conversations for matching content
 */
export function searchConversations(
  conversations: Map<string, Conversation>,
  query: string
): SearchResult[] {
  if (!query.trim()) return [];
  
  const normalizedQuery = query.toLowerCase().trim();
  const results: SearchResult[] = [];
  
  conversations.forEach((conv) => {
    let matchCount = 0;
    let matchType: SearchResult['matchType'] = 'title';
    let snippet = '';
    
    // Search in title
    const title = conv.metadata.title || '';
    if (title.toLowerCase().includes(normalizedQuery)) {
      matchCount++;
      matchType = 'title';
      snippet = highlightMatch(title, normalizedQuery);
    }
    
    // Search in messages
    const messages = Array.isArray(conv.content) ? conv.content : [];
    for (const msg of messages) {
      if (typeof msg.content === 'string' && 
          msg.content.toLowerCase().includes(normalizedQuery)) {
        matchCount++;
        if (matchType === 'title' && matchCount === 1) {
          // First match was title, this is also a match
        } else if (snippet === '') {
          matchType = 'message';
          snippet = highlightMatch(
            truncateAround(msg.content, normalizedQuery, 60),
            normalizedQuery
          );
        }
      }
    }
    
    // Note: branchReason is embedded in title during branch creation,
    // so searching title already covers branch reasons.
    // Original implementation tried to access non-existent property.
    
    if (matchCount > 0) {
      results.push({
        cardId: conv.id,
        title: conv.metadata.title || 'Untitled',
        snippet: snippet || conv.metadata.title || '',
        matchType,
        matchCount,
      });
    }
  });
  
  // Sort by match count (more matches first)
  results.sort((a, b) => b.matchCount - a.matchCount);
  
  return results;
}

/**
 * Highlight matching text with markers
 */
function highlightMatch(text: string, query: string): string {
  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (index === -1) return text;
  
  return (
    text.slice(0, index) +
    '【' + text.slice(index, index + query.length) + '】' +
    text.slice(index + query.length)
  );
}

/**
 * Truncate text around the match for snippet display
 */
function truncateAround(text: string, query: string, maxLength: number): string {
  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (index === -1) return text.slice(0, maxLength);
  
  const start = Math.max(0, index - 20);
  const end = Math.min(text.length, index + query.length + 40);
  
  let result = text.slice(start, end);
  if (start > 0) result = '...' + result;
  if (end < text.length) result = result + '...';
  
  return result;
}

export default useSearchStore;
