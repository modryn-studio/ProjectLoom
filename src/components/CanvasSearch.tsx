'use client';

/**
 * Canvas Search - Floating search overlay for finding content across cards
 * 
 * Features:
 * - Ctrl+F to open, Escape to close
 * - Real-time search across titles and messages
 * - Up/Down arrow navigation
 * - Enter to jump to result
 * 
 * @version 4.0.0
 */

import { useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useReactFlow } from '@xyflow/react';
import designTokens from '@/lib/design-tokens';
import { useSearchStore, searchConversations } from '@/stores/search-store';
import { useCanvasStore } from '@/stores/canvas-store';
import { zIndex } from '@/constants/zIndex';

// =============================================================================
// STYLES
// =============================================================================

// Import individual tokens
const { colors, effects, animation } = designTokens;

const styles = {
  backdrop: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    pointerEvents: 'none' as const,
    zIndex: zIndex.ui.dropdown,
    display: 'flex',
    justifyContent: 'center',
    paddingTop: '80px',
  },
  container: {
    pointerEvents: 'auto' as const,
    width: '400px',
    maxWidth: '90vw',
    backgroundColor: colors.bg.secondary,
    borderRadius: effects.border.radius.lg,
    boxShadow: effects.shadow.lg,
    border: `1px solid ${colors.accent.muted}`,
    overflow: 'hidden',
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 16px',
    borderBottom: `1px solid var(--border-secondary)`,
  },
  searchIcon: {
    color: colors.fg.secondary,
    flexShrink: 0,
  },
  input: {
    flex: 1,
    backgroundColor: 'transparent',
    border: 'none',
    outline: 'none',
    color: colors.fg.primary,
    fontSize: '14px',
    fontFamily: 'inherit',
  },
  resultCount: {
    fontSize: '12px',
    color: colors.fg.secondary,
    flexShrink: 0,
  },
  resultsList: {
    maxHeight: '300px',
    overflowY: 'auto' as const,
  },
  resultItem: {
    padding: '10px 16px',
    cursor: 'pointer',
    borderBottom: `1px solid var(--border-secondary)`,
    transition: 'background-color 150ms',
  },
  resultItemActive: {
    backgroundColor: colors.bg.primary,
  },
  resultTitle: {
    fontSize: '13px',
    fontWeight: 500,
    color: colors.fg.primary,
    marginBottom: '4px',
  },
  resultSnippet: {
    fontSize: '12px',
    color: colors.fg.secondary,
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  matchBadge: {
    display: 'inline-block',
    fontSize: '10px',
    padding: '2px 6px',
    borderRadius: '4px',
    backgroundColor: colors.accent.muted,
    color: colors.accent.secondary,
    marginLeft: '8px',
    textTransform: 'uppercase' as const,
  },
  noResults: {
    padding: '24px 16px',
    textAlign: 'center' as const,
    color: colors.fg.quaternary,
    fontSize: '13px',
  },
  hint: {
    padding: '8px 16px',
    fontSize: '11px',
    color: colors.fg.quaternary,
    backgroundColor: colors.bg.primary,
    display: 'flex',
    justifyContent: 'space-between',
  },
  kbd: {
    display: 'inline-block',
    padding: '1px 5px',
    fontSize: '10px',
    fontFamily: 'monospace',
    backgroundColor: colors.bg.primary,
    borderRadius: '3px',
    border: `1px solid ${colors.accent.muted}`,
    marginLeft: '4px',
  },
};

// =============================================================================
// COMPONENT
// =============================================================================

export function CanvasSearch() {
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const reactFlow = useReactFlow();
  
  const { 
    isOpen, 
    query, 
    results, 
    activeIndex,
    closeSearch, 
    setQuery, 
    setResults,
    nextResult,
    prevResult,
    setActiveIndex,
  } = useSearchStore();
  
  const conversations = useCanvasStore((s) => s.conversations);
  const setSelected = useCanvasStore((s) => s.setSelected);
  
  // Perform search when query changes
  useEffect(() => {
    if (!isOpen) return;
    
    // 150ms debounce - optimal balance between responsiveness and performance
    // Increase to 300ms if performance degrades at 50+ cards with large message histories
    const timeoutId = setTimeout(() => {
      const searchResults = searchConversations(conversations, query);
      setResults(searchResults);
    }, 150);
    
    return () => clearTimeout(timeoutId);
  }, [query, conversations, isOpen, setResults]);
  
  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure the element is rendered
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [isOpen]);
  
  // Scroll active result into view
  useEffect(() => {
    if (!listRef.current || results.length === 0) return;
    
    const activeElement = listRef.current.children[activeIndex] as HTMLElement;
    if (activeElement) {
      activeElement.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex, results.length]);
  
  const jumpToResult = useCallback((index: number) => {
    const result = results[index];
    if (!result) return;
    
    // Select the card
    setSelected([result.cardId]);
    
    // Pan to the card
    const nodes = reactFlow.getNodes();
    const targetNode = nodes.find((n) => n.id === result.cardId);
    if (targetNode) {
      reactFlow.setCenter(
        targetNode.position.x + (targetNode.width || 320) / 2,
        targetNode.position.y + (targetNode.height || 200) / 2,
        { duration: 300 }
      );
    }
    
    closeSearch();
  }, [results, setSelected, reactFlow, closeSearch]);
  
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        closeSearch();
        break;
      case 'ArrowDown':
        e.preventDefault();
        nextResult();
        break;
      case 'ArrowUp':
        e.preventDefault();
        prevResult();
        break;
      case 'Enter':
        e.preventDefault();
        if (results.length > 0) {
          jumpToResult(activeIndex);
        }
        break;
    }
  }, [closeSearch, nextResult, prevResult, results.length, activeIndex, jumpToResult]);
  
  // Render highlighted snippet
  const renderSnippet = useCallback((snippet: string) => {
    // Replace markers with styled spans
    const parts = snippet.split(/【|】/);
    return parts.map((part, i) => {
      if (i % 2 === 1) {
        return (
          <span 
            key={i} 
            style={{ 
              backgroundColor: colors.accent.muted,
              color: colors.accent.secondary,
              padding: '0 2px',
              borderRadius: '2px',
            }}
          >
            {part}
          </span>
        );
      }
      return part;
    });
  }, []);
  
  return (
    <AnimatePresence>
      {isOpen && (
        <div style={styles.backdrop}>
          <motion.div
            style={styles.container}
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={animation.spring.snappy}
          >
            {/* Search Input */}
            <div style={styles.searchBox}>
              <svg 
                width="16" 
                height="16" 
                viewBox="0 0 16 16" 
                fill="none" 
                style={styles.searchIcon}
              >
                <path 
                  d="M7 12C9.76142 12 12 9.76142 12 7C12 4.23858 9.76142 2 7 2C4.23858 2 2 4.23858 2 7C2 9.76142 4.23858 12 7 12Z" 
                  stroke="currentColor" 
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <path 
                  d="M14 14L10.5 10.5" 
                  stroke="currentColor" 
                  strokeWidth="1.5" 
                  strokeLinecap="round"
                />
              </svg>
              
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search cards..."
                style={styles.input}
              />
              
              {query && results.length > 0 && (
                <span style={styles.resultCount}>
                  {activeIndex + 1}/{results.length}
                </span>
              )}
            </div>
            
            {/* Results List */}
            {query && (
              <div ref={listRef} style={styles.resultsList}>
                {results.length > 0 ? (
                  results.map((result, index) => (
                    <div
                      key={result.cardId}
                      style={{
                        ...styles.resultItem,
                        ...(index === activeIndex ? styles.resultItemActive : {}),
                      }}
                      onClick={() => jumpToResult(index)}
                      onMouseEnter={() => setActiveIndex(index)}
                    >
                      <div style={styles.resultTitle}>
                        {result.title}
                        <span style={styles.matchBadge}>{result.matchType}</span>
                      </div>
                      <div style={styles.resultSnippet}>
                        {renderSnippet(result.snippet)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={styles.noResults}>
                    No cards found matching "{query}"
                  </div>
                )}
              </div>
            )}
            
            {/* Keyboard Hints */}
            <div style={styles.hint}>
              <span>
                <kbd style={styles.kbd}>↑</kbd>
                <kbd style={styles.kbd}>↓</kbd>
                Navigate
              </span>
              <span>
                <kbd style={styles.kbd}>Enter</kbd>
                Jump to card
              </span>
              <span>
                <kbd style={styles.kbd}>Esc</kbd>
                Close
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default CanvasSearch;
