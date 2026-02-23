/**
 * Demo Recording Guide
 *
 * Orchestrates the `?demo=record` screen recording mode. Unlike OnboardingGuide,
 * this component has NO spotlight overlays — it runs silently in the background.
 *
 * It watches the canvas store for branch/merge events, advances the demo store
 * steps, and fires `pendingMessage` to trigger auto-typing in MessageInput.
 *
 * The user is expected to:
 *   - NOT create the root card (done automatically)
 *   - Manually create branches (right-click → Branch)
 *   - Manually create merges (select → Merge)
 *
 * @version 1.0.0
 */

'use client';

import { useEffect, useRef } from 'react';
import { useDemoRecordStore, DEMO_PROMPTS } from '@/stores/demo-record-store';
import { useCanvasStore } from '@/stores/canvas-store';

const DEMO_PREROLL_DELAY_MS = 10000;

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function DemoRecordGuide() {
  const active = useDemoRecordStore((s) => s.active);
  const step = useDemoRecordStore((s) => s.step);
  const knownIdsRef = useRef<Set<string>>(new Set());

  // ── Apply slight zoom-in at demo start for recording framing ──
  useEffect(() => {
    if (!active || step !== 'demo-idle') return;
    if (typeof window === 'undefined') return;

    const t = setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent('projectloom:demoZoom', {
          detail: { zoom: 0.9, duration: 500 },
        }),
      );
    }, DEMO_PREROLL_DELAY_MS);

    return () => clearTimeout(t);
  }, [active, step]);

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
    }, DEMO_PREROLL_DELAY_MS);

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
            const rootId = useDemoRecordStore.getState().rootCardId;
            if (rootId) {
              useCanvasStore.getState().requestFocusNode(rootId);
              useCanvasStore.getState().openChatPanel(rootId);
            }
            useDemoRecordStore.getState().goToStep('demo-wait-branch-a');
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
          if (id) {
            useCanvasStore.getState().requestFocusNode(id);
            useCanvasStore.getState().openChatPanel(id);
          }
          useDemoRecordStore.getState().goToStep('demo-wait-branch-a');
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
            const rootId = useDemoRecordStore.getState().rootCardId;
            if (rootId) {
              useCanvasStore.getState().requestFocusNode(rootId);
              useCanvasStore.getState().openChatPanel(rootId);
            }
            useDemoRecordStore.getState().goToStep('demo-wait-branch-b');
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
          const rootId = useDemoRecordStore.getState().rootCardId;
          if (rootId) {
            useCanvasStore.getState().requestFocusNode(rootId);
            useCanvasStore.getState().openChatPanel(rootId);
          }
          useDemoRecordStore.getState().goToStep('demo-wait-branch-b');
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
            useDemoRecordStore.getState().goToStep('demo-wait-merge-1');
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
          useDemoRecordStore.getState().goToStep('demo-wait-merge-1');
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
            const mergeId = useDemoRecordStore.getState().merge1CardId;
            if (mergeId) {
              useCanvasStore.getState().requestFocusNode(mergeId);
              useCanvasStore.getState().openChatPanel(mergeId);
            }
            useDemoRecordStore.getState().goToStep('demo-wait-branch-c');
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
          if (id) {
            useCanvasStore.getState().requestFocusNode(id);
            useCanvasStore.getState().openChatPanel(id);
          }
          useDemoRecordStore.getState().goToStep('demo-wait-branch-c');
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
            useDemoRecordStore.getState().goToStep('demo-wait-merge-2');
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
          useDemoRecordStore.getState().goToStep('demo-wait-merge-2');
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
            console.log('[DemoRecord] ✅ Demo complete — stop your screen recorder.');
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
          console.log('[DemoRecord] ✅ Demo complete — stop your screen recorder.');
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

  // Renders nothing — runs silently in the background
  return null;
}
