/**
 * Demo Recording Guide
 *
 * Orchestrates the `?demo=record` screen recording mode. Unlike OnboardingGuide,
 * this component has NO spotlight overlays — it runs silently in the background
 * and only shows a minimal floating toolbar (step label + keyboard shortcuts).
 *
 * It watches the canvas store for branch/merge events, advances the demo store
 * steps, and fires `pendingMessage` to trigger auto-typing in MessageInput.
 *
 * The user is expected to:
 *   - NOT create the root card (done automatically)
 *   - Manually create branches (right-click → Branch)
 *   - Manually create merges (select → Merge)
 *   - Press Space to advance when a "wait" step is active (optional manual trigger)
 *
 * @version 1.0.0
 */

'use client';

import React, { useEffect, useRef, useMemo } from 'react';
import { useDemoRecordStore, DEMO_PROMPTS } from '@/stores/demo-record-store';
import { useCanvasStore } from '@/stores/canvas-store';
import { colors, typography, spacing } from '@/lib/design-tokens';
import { zIndex } from '@/constants/zIndex';

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function DemoRecordGuide() {
  const active = useDemoRecordStore((s) => s.active);
  const step = useDemoRecordStore((s) => s.step);
  const knownIdsRef = useRef<Set<string>>(new Set());

  // ── Status text derived from step ──
  const statusText = useMemo(() => {
    const labels: Record<string, string> = {
      'demo-idle': 'Starting demo...',
      'demo-root-chat': '1/6  Root card',
      'demo-wait-branch-a': 'Branch from root → pipeline advice',
      'demo-branch-a-chat': '2/6  Branch A',
      'demo-wait-branch-b': 'Branch from root → financial advice',
      'demo-branch-b-chat': '3/6  Branch B',
      'demo-wait-merge-1': 'Merge branches A + B',
      'demo-merge-1-chat': '4/6  Merge → 90-day plan',
      'demo-wait-branch-c': 'Branch from merge → critical review',
      'demo-branch-c-chat': '5/6  Branch C',
      'demo-wait-merge-2': 'Merge → final plan',
      'demo-merge-2-chat': '6/6  Final merge',
      'demo-complete': 'Demo complete!',
    };
    return labels[step] ?? step;
  }, [step]);

  // ── Create root card automatically on demo start ──
  useEffect(() => {
    if (!active || step !== 'demo-idle') return;

    // Short delay to let the canvas render
    const t = setTimeout(() => {
      const canvas = useCanvasStore.getState();
      const workspaceId = canvas.activeWorkspaceId;
      if (!workspaceId) return;

      // Create a root card at center of canvas
      const newCard = canvas.createConversationCard(workspaceId, { x: 400, y: 300 }, {
        openChat: true,
      });
      if (newCard) {
        const demo = useDemoRecordStore.getState();
        demo.setRootCardId(newCard.id);
        demo.goToStep('demo-root-chat');
      }
    }, 800);

    return () => clearTimeout(t);
  }, [active, step]);

  // ── Auto-chat steps: fire pendingMessage when entering a chat step ──
  useEffect(() => {
    if (!active) return;
    const prompt = DEMO_PROMPTS[step];
    if (!prompt) return;

    const demo = useDemoRecordStore.getState();
    let targetCardId: string | null = null;

    if (step === 'demo-root-chat') targetCardId = demo.rootCardId;
    else if (step === 'demo-branch-a-chat') targetCardId = demo.branchACardId;
    else if (step === 'demo-branch-b-chat') targetCardId = demo.branchBCardId;
    else if (step === 'demo-merge-1-chat') targetCardId = demo.merge1CardId;
    else if (step === 'demo-branch-c-chat') targetCardId = demo.branchCCardId;
    else if (step === 'demo-merge-2-chat') targetCardId = demo.merge2CardId;

    if (!targetCardId) return;

    // Open chat panel for this card
    useCanvasStore.getState().openChatPanel(targetCardId);

    // Short delay to let the chat panel mount
    const t = setTimeout(() => {
      useDemoRecordStore.getState().setPendingMessage({
        cardId: targetCardId!,
        text: prompt,
      });
    }, 600);

    return () => clearTimeout(t);
  }, [active, step]);

  // ── Auto-advance: demo-root-chat → demo-wait-branch-a ──
  // When root card has >= 2 messages (user + AI response)
  useEffect(() => {
    if (!active || step !== 'demo-root-chat') return;
    let advanced = false;

    const unsub = useCanvasStore.subscribe(
      (s) => {
        const id = useDemoRecordStore.getState().rootCardId;
        if (!id) return 0;
        return s.conversations.get(id)?.content?.length ?? 0;
      },
      (len) => {
        if (len >= 2 && !advanced) {
          advanced = true;
          setTimeout(() => {
            useCanvasStore.getState().closeChatPanel();
            setTimeout(() => {
              const rootId = useDemoRecordStore.getState().rootCardId;
              if (rootId) useCanvasStore.getState().requestFocusNode(rootId);
              useDemoRecordStore.getState().goToStep('demo-wait-branch-a');
            }, 500);
          }, 1500);
        }
      },
    );

    // Guard: may have already received response
    const id = useDemoRecordStore.getState().rootCardId;
    if (id) {
      const len = useCanvasStore.getState().conversations.get(id)?.content?.length ?? 0;
      if (len >= 2 && !advanced) {
        advanced = true;
        setTimeout(() => {
          useCanvasStore.getState().closeChatPanel();
          setTimeout(() => {
            if (id) useCanvasStore.getState().requestFocusNode(id);
            useDemoRecordStore.getState().goToStep('demo-wait-branch-a');
          }, 500);
        }, 1500);
      }
    }

    return unsub;
  }, [active, step]);

  // ── Auto-advance: demo-wait-branch-a → demo-branch-a-chat ──
  // User creates a branch from root card
  useEffect(() => {
    if (!active || step !== 'demo-wait-branch-a') return;
    let advanced = false;

    knownIdsRef.current = new Set(useCanvasStore.getState().conversations.keys());

    const unsub = useCanvasStore.subscribe(
      (s) => s.conversations.size,
      (size, prevSize) => {
        if (size > prevSize && !advanced) {
          const state = useCanvasStore.getState();
          const rootId = useDemoRecordStore.getState().rootCardId;
          if (!rootId) return;

          for (const [id, conv] of state.conversations) {
            if (!knownIdsRef.current.has(id)) {
              knownIdsRef.current.add(id);
              const isExpectedBranch = !conv.isMergeNode
                && conv.parentCardIds.length === 1
                && conv.parentCardIds[0] === rootId;

              if (isExpectedBranch) {
                advanced = true;
                useDemoRecordStore.getState().setBranchACardId(id);
                useDemoRecordStore.getState().goToStep('demo-branch-a-chat');
                break;
              }
            }
          }
        }
      },
    );
    return unsub;
  }, [active, step]);

  // ── Auto-advance: demo-branch-a-chat → demo-wait-branch-b ──
  useEffect(() => {
    if (!active || step !== 'demo-branch-a-chat') return;
    let advanced = false;

    const unsub = useCanvasStore.subscribe(
      (s) => {
        const id = useDemoRecordStore.getState().branchACardId;
        if (!id) return 0;
        return s.conversations.get(id)?.content?.length ?? 0;
      },
      (len) => {
        if (len >= 2 && !advanced) {
          advanced = true;
          setTimeout(() => {
            useCanvasStore.getState().closeChatPanel();
            setTimeout(() => {
              const rootId = useDemoRecordStore.getState().rootCardId;
              if (rootId) useCanvasStore.getState().requestFocusNode(rootId);
              useDemoRecordStore.getState().goToStep('demo-wait-branch-b');
            }, 500);
          }, 1500);
        }
      },
    );

    const id = useDemoRecordStore.getState().branchACardId;
    if (id) {
      const len = useCanvasStore.getState().conversations.get(id)?.content?.length ?? 0;
      if (len >= 2 && !advanced) {
        advanced = true;
        setTimeout(() => {
          useCanvasStore.getState().closeChatPanel();
          setTimeout(() => {
            const rootId = useDemoRecordStore.getState().rootCardId;
            if (rootId) useCanvasStore.getState().requestFocusNode(rootId);
            useDemoRecordStore.getState().goToStep('demo-wait-branch-b');
          }, 500);
        }, 1500);
      }
    }

    return unsub;
  }, [active, step]);

  // ── Auto-advance: demo-wait-branch-b → demo-branch-b-chat ──
  useEffect(() => {
    if (!active || step !== 'demo-wait-branch-b') return;
    let advanced = false;

    knownIdsRef.current = new Set(useCanvasStore.getState().conversations.keys());

    const unsub = useCanvasStore.subscribe(
      (s) => s.conversations.size,
      (size, prevSize) => {
        if (size > prevSize && !advanced) {
          const state = useCanvasStore.getState();
          const rootId = useDemoRecordStore.getState().rootCardId;
          const branchAId = useDemoRecordStore.getState().branchACardId;
          if (!rootId || !branchAId) return;

          for (const [id, conv] of state.conversations) {
            if (!knownIdsRef.current.has(id)) {
              knownIdsRef.current.add(id);
              const isExpectedBranch = id !== branchAId
                && !conv.isMergeNode
                && conv.parentCardIds.length === 1
                && conv.parentCardIds[0] === rootId;

              if (isExpectedBranch) {
                advanced = true;
                useDemoRecordStore.getState().setBranchBCardId(id);
                useDemoRecordStore.getState().goToStep('demo-branch-b-chat');
                break;
              }
            }
          }
        }
      },
    );
    return unsub;
  }, [active, step]);

  // ── Auto-advance: demo-branch-b-chat → demo-wait-merge-1 ──
  useEffect(() => {
    if (!active || step !== 'demo-branch-b-chat') return;
    let advanced = false;

    const unsub = useCanvasStore.subscribe(
      (s) => {
        const id = useDemoRecordStore.getState().branchBCardId;
        if (!id) return 0;
        return s.conversations.get(id)?.content?.length ?? 0;
      },
      (len) => {
        if (len >= 2 && !advanced) {
          advanced = true;
          setTimeout(() => {
            useCanvasStore.getState().closeChatPanel();
            setTimeout(() => {
              useDemoRecordStore.getState().goToStep('demo-wait-merge-1');
            }, 500);
          }, 1500);
        }
      },
    );

    const id = useDemoRecordStore.getState().branchBCardId;
    if (id) {
      const len = useCanvasStore.getState().conversations.get(id)?.content?.length ?? 0;
      if (len >= 2 && !advanced) {
        advanced = true;
        setTimeout(() => {
          useCanvasStore.getState().closeChatPanel();
          setTimeout(() => {
            useDemoRecordStore.getState().goToStep('demo-wait-merge-1');
          }, 500);
        }, 1500);
      }
    }

    return unsub;
  }, [active, step]);

  // ── Auto-advance: demo-wait-merge-1 → demo-merge-1-chat ──
  useEffect(() => {
    if (!active || step !== 'demo-wait-merge-1') return;
    let advanced = false;

    knownIdsRef.current = new Set(useCanvasStore.getState().conversations.keys());

    const unsub = useCanvasStore.subscribe(
      (s) => s.conversations.size,
      (size, prevSize) => {
        if (size > prevSize && !advanced) {
          const state = useCanvasStore.getState();
          const branchAId = useDemoRecordStore.getState().branchACardId;
          const branchBId = useDemoRecordStore.getState().branchBCardId;
          if (!branchAId || !branchBId) return;

          for (const [id, conv] of state.conversations) {
            if (!knownIdsRef.current.has(id) && conv.isMergeNode) {
              knownIdsRef.current.add(id);
              const parentSet = new Set(conv.parentCardIds);
              const isExpectedMerge = conv.parentCardIds.length === 2
                && parentSet.has(branchAId)
                && parentSet.has(branchBId);

              if (isExpectedMerge) {
                advanced = true;
                useDemoRecordStore.getState().setMerge1CardId(id);
                useDemoRecordStore.getState().goToStep('demo-merge-1-chat');
                break;
              }
            }
          }
        }
      },
    );
    return unsub;
  }, [active, step]);

  // ── Auto-advance: demo-merge-1-chat → demo-wait-branch-c ──
  useEffect(() => {
    if (!active || step !== 'demo-merge-1-chat') return;
    let advanced = false;

    const unsub = useCanvasStore.subscribe(
      (s) => {
        const id = useDemoRecordStore.getState().merge1CardId;
        if (!id) return 0;
        return s.conversations.get(id)?.content?.length ?? 0;
      },
      (len) => {
        if (len >= 2 && !advanced) {
          advanced = true;
          setTimeout(() => {
            useCanvasStore.getState().closeChatPanel();
            setTimeout(() => {
              const mergeId = useDemoRecordStore.getState().merge1CardId;
              if (mergeId) useCanvasStore.getState().requestFocusNode(mergeId);
              useDemoRecordStore.getState().goToStep('demo-wait-branch-c');
            }, 500);
          }, 1500);
        }
      },
    );

    const id = useDemoRecordStore.getState().merge1CardId;
    if (id) {
      const len = useCanvasStore.getState().conversations.get(id)?.content?.length ?? 0;
      if (len >= 2 && !advanced) {
        advanced = true;
        setTimeout(() => {
          useCanvasStore.getState().closeChatPanel();
          setTimeout(() => {
            if (id) useCanvasStore.getState().requestFocusNode(id);
            useDemoRecordStore.getState().goToStep('demo-wait-branch-c');
          }, 500);
        }, 1500);
      }
    }

    return unsub;
  }, [active, step]);

  // ── Auto-advance: demo-wait-branch-c → demo-branch-c-chat ──
  useEffect(() => {
    if (!active || step !== 'demo-wait-branch-c') return;
    let advanced = false;

    knownIdsRef.current = new Set(useCanvasStore.getState().conversations.keys());

    const unsub = useCanvasStore.subscribe(
      (s) => s.conversations.size,
      (size, prevSize) => {
        if (size > prevSize && !advanced) {
          const state = useCanvasStore.getState();
          const merge1Id = useDemoRecordStore.getState().merge1CardId;
          if (!merge1Id) return;

          for (const [id, conv] of state.conversations) {
            if (!knownIdsRef.current.has(id)) {
              knownIdsRef.current.add(id);
              const isExpectedBranch = !conv.isMergeNode
                && conv.parentCardIds.length === 1
                && conv.parentCardIds[0] === merge1Id;

              if (isExpectedBranch) {
                advanced = true;
                useDemoRecordStore.getState().setBranchCCardId(id);
                useDemoRecordStore.getState().goToStep('demo-branch-c-chat');
                break;
              }
            }
          }
        }
      },
    );
    return unsub;
  }, [active, step]);

  // ── Auto-advance: demo-branch-c-chat → demo-wait-merge-2 ──
  useEffect(() => {
    if (!active || step !== 'demo-branch-c-chat') return;
    let advanced = false;

    const unsub = useCanvasStore.subscribe(
      (s) => {
        const id = useDemoRecordStore.getState().branchCCardId;
        if (!id) return 0;
        return s.conversations.get(id)?.content?.length ?? 0;
      },
      (len) => {
        if (len >= 2 && !advanced) {
          advanced = true;
          setTimeout(() => {
            useCanvasStore.getState().closeChatPanel();
            setTimeout(() => {
              useDemoRecordStore.getState().goToStep('demo-wait-merge-2');
            }, 500);
          }, 1500);
        }
      },
    );

    const id = useDemoRecordStore.getState().branchCCardId;
    if (id) {
      const len = useCanvasStore.getState().conversations.get(id)?.content?.length ?? 0;
      if (len >= 2 && !advanced) {
        advanced = true;
        setTimeout(() => {
          useCanvasStore.getState().closeChatPanel();
          setTimeout(() => {
            useDemoRecordStore.getState().goToStep('demo-wait-merge-2');
          }, 500);
        }, 1500);
      }
    }

    return unsub;
  }, [active, step]);

  // ── Auto-advance: demo-wait-merge-2 → demo-merge-2-chat ──
  useEffect(() => {
    if (!active || step !== 'demo-wait-merge-2') return;
    let advanced = false;

    knownIdsRef.current = new Set(useCanvasStore.getState().conversations.keys());

    const unsub = useCanvasStore.subscribe(
      (s) => s.conversations.size,
      (size, prevSize) => {
        if (size > prevSize && !advanced) {
          const state = useCanvasStore.getState();
          const merge1Id = useDemoRecordStore.getState().merge1CardId;
          const branchCId = useDemoRecordStore.getState().branchCCardId;
          if (!merge1Id || !branchCId) return;

          for (const [id, conv] of state.conversations) {
            if (!knownIdsRef.current.has(id) && conv.isMergeNode) {
              knownIdsRef.current.add(id);
              const parentSet = new Set(conv.parentCardIds);
              const isExpectedMerge = conv.parentCardIds.length === 2
                && parentSet.has(merge1Id)
                && parentSet.has(branchCId);

              if (isExpectedMerge) {
                advanced = true;
                useDemoRecordStore.getState().setMerge2CardId(id);
                useDemoRecordStore.getState().goToStep('demo-merge-2-chat');
                break;
              }
            }
          }
        }
      },
    );
    return unsub;
  }, [active, step]);

  // ── Auto-advance: demo-merge-2-chat → demo-complete ──
  useEffect(() => {
    if (!active || step !== 'demo-merge-2-chat') return;
    let advanced = false;

    const unsub = useCanvasStore.subscribe(
      (s) => {
        const id = useDemoRecordStore.getState().merge2CardId;
        if (!id) return 0;
        return s.conversations.get(id)?.content?.length ?? 0;
      },
      (len) => {
        if (len >= 2 && !advanced) {
          advanced = true;
          setTimeout(() => {
            useDemoRecordStore.getState().completeDemoRecord();
          }, 2000);
        }
      },
    );

    const id = useDemoRecordStore.getState().merge2CardId;
    if (id) {
      const len = useCanvasStore.getState().conversations.get(id)?.content?.length ?? 0;
      if (len >= 2 && !advanced) {
        advanced = true;
        setTimeout(() => {
          useDemoRecordStore.getState().completeDemoRecord();
        }, 2000);
      }
    }

    return unsub;
  }, [active, step]);

  // ── Keyboard shortcut: Escape to cancel demo ──
  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        useDemoRecordStore.getState().completeDemoRecord();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [active]);

  // Don't render anything if not active
  if (!active) return null;

  // Minimal floating toolbar in top-right
  return (
    <div style={styles.toolbar}>
      <div style={styles.recDot} />
      <span style={styles.label}>REC</span>
      <span style={styles.separator}>|</span>
      <span style={styles.step}>{statusText}</span>
      <button
        onClick={() => useDemoRecordStore.getState().completeDemoRecord()}
        style={styles.stopBtn}
      >
        Stop
      </button>
    </div>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles: Record<string, React.CSSProperties> = {
  toolbar: {
    position: 'fixed',
    top: 12,
    right: 12,
    zIndex: zIndex.top.tooltip,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: `${spacing[2]} ${spacing[4]}`,
    background: colors.bg.secondary,
    border: `1px solid ${colors.border.default}`,
    borderRadius: 8,
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
    pointerEvents: 'auto',
  },
  recDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    backgroundColor: '#ef4444',
    animation: 'pulse 1.5s ease-in-out infinite',
  },
  label: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.xs,
    color: '#ef4444',
    fontWeight: 700,
    letterSpacing: 1,
  },
  separator: {
    color: colors.border.default,
    fontSize: 14,
  },
  step: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.xs,
    color: colors.fg.secondary,
    minWidth: 180,
  },
  stopBtn: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.xs,
    color: colors.fg.primary,
    background: 'rgba(255,255,255,0.08)',
    border: `1px solid ${colors.border.default}`,
    borderRadius: 4,
    padding: '2px 10px',
    cursor: 'pointer',
  },
};
