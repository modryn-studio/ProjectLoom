/**
 * Onboarding Guide (v3)
 *
 * Scripted interactive onboarding — user creates their first card, then
 * watches a job-offer decision unfold while performing branch and merge
 * actions to learn the tool. All prompts auto-type and auto-send.
 *
 * Steps:
 *   idle            — waiting for first card creation
 *   auto-chat-0     — root card prompt types + sends + streams
 *   branch-1-hint   — spotlight: "Right-click → Branch from here"
 *   auto-chat-1     — branch 1 prompt types + sends + streams
 *   branch-2-hint   — spotlight root card: "Branch again"
 *   auto-chat-2     — branch 2 prompt types + sends + streams
 *   reflect         — canvas overlay: "You forked your thinking"
 *   merge-hint      — spotlight: "Shift-click both, then Merge"
 *   auto-chat-3     — merge card prompt types + sends + streams
 *   complete        — two-button overlay: Clear / Keep
 *
 * @version 3.0.0
 */

'use client';

import React, { useEffect, useCallback, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, GitBranch, GitMerge, ArrowRight, Trash2, Sparkles } from 'lucide-react';
import { colors, typography, animation, effects } from '@/lib/design-tokens';
import { zIndex } from '@/constants/zIndex';
import { useOnboardingStore, ONBOARDING_PROMPTS } from '@/stores/onboarding-store';
import { useCanvasStore } from '@/stores/canvas-store';
import { analytics } from '@/lib/analytics';

// =============================================================================
// CONSTANTS
// =============================================================================

const SPOTLIGHT_PADDING = 12;
const TOTAL_STEPS = 5; // visual step dots: create, branch1, branch2, merge, done

// =============================================================================
// HOOKS
// =============================================================================

/** Track a DOM element's rect via ResizeObserver + MutationObserver */
function useElementRect(selector: string | null): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!selector) {
      queueMicrotask(() => setRect(null));
      return;
    }

    let ro: ResizeObserver | null = null;
    let mo: MutationObserver | null = null;
    let rafId: number | null = null;
    let resizeHandler: (() => void) | null = null;
    let scrollHandler: (() => void) | null = null;

    const measure = (el: Element) => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        setRect(el.getBoundingClientRect());
      });
    };

    // Also watch the React Flow viewport transform — pan/zoom changes the
    // CSS transform on this element but fires no scroll/resize event.
    let viewportMo: MutationObserver | null = null;
    const attachViewportObserver = (el: Element) => {
      const viewport = document.querySelector('.react-flow__viewport');
      if (viewport) {
        viewportMo = new MutationObserver(() => measure(el));
        viewportMo.observe(viewport, { attributes: true, attributeFilter: ['style'] });
      }
    };

    const attach = () => {
      const el = document.querySelector(selector);
      if (!el) return false;
      measure(el);
      ro = new ResizeObserver(() => measure(el));
      ro.observe(el);
      resizeHandler = () => measure(el);
      scrollHandler = () => measure(el);
      window.addEventListener('resize', resizeHandler);
      window.addEventListener('scroll', scrollHandler, true);
      attachViewportObserver(el);
      return true;
    };

    if (!attach()) {
      mo = new MutationObserver(() => {
        if (attach()) mo?.disconnect();
      });
      mo.observe(document.body, { childList: true, subtree: true });
    }

    return () => {
      ro?.disconnect();
      mo?.disconnect();
      viewportMo?.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
      if (resizeHandler) window.removeEventListener('resize', resizeHandler);
      if (scrollHandler) window.removeEventListener('scroll', scrollHandler, true);
    };
  }, [selector]);

  return rect;
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

/** Spotlight overlay with box-shadow cutout + tooltip */
function SpotlightOverlay({
  targetRect,
  tooltip,
  icon,
  onDismiss,
  visualStep,
}: {
  targetRect: DOMRect | null;
  tooltip: { title: string; description: string };
  icon: React.ReactNode;
  onDismiss: () => void;
  visualStep: number;
}) {
  const tooltipStyle: React.CSSProperties = targetRect
    ? {
        position: 'fixed' as const,
        left: targetRect.left + targetRect.width / 2,
        top: targetRect.top - SPOTLIGHT_PADDING - 16,
        transform: 'translate(-50%, -100%)',
      }
    : {
        position: 'fixed' as const,
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
      };

  return (
    <>
      {/* Semi-transparent backdrop with box-shadow cutout */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: zIndex.overlay.modalBackdrop,
          ...(targetRect
            ? {
                left: targetRect.left - SPOTLIGHT_PADDING,
                top: targetRect.top - SPOTLIGHT_PADDING,
                width: targetRect.width + SPOTLIGHT_PADDING * 2,
                height: targetRect.height + SPOTLIGHT_PADDING * 2,
                borderRadius: 12,
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.55)',
              }
            : {
                background: 'rgba(0, 0, 0, 0.55)',
              }),
          pointerEvents: 'none',
        }}
      />

      {/* Tooltip */}
      <AnimatePresence mode="wait">
        <div
          style={{
            ...tooltipStyle,
            zIndex: zIndex.top.tooltip,
            pointerEvents: 'auto',
            maxWidth: 380,
            width: 'max-content',
          }}
        >
          <motion.div
            key={`spotlight-${visualStep}`}
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.25, delay: 0.15 }}
          >
            <div style={spotlightStyles.tooltip}>
              <button onClick={onDismiss} style={spotlightStyles.closeBtn} aria-label="Skip onboarding">
                <X size={14} />
              </button>

              <div style={spotlightStyles.content}>
                <div style={spotlightStyles.iconWrap}>{icon}</div>
                <div style={spotlightStyles.textWrap}>
                  <div style={spotlightStyles.title}>{tooltip.title}</div>
                  <div style={spotlightStyles.description}>{tooltip.description}</div>
                </div>
              </div>

              {/* Step dots */}
              <div style={spotlightStyles.dots}>
                {Array.from({ length: TOTAL_STEPS }, (_, i) => (
                  <div
                    key={i}
                    style={{
                      ...spotlightStyles.dot,
                      backgroundColor: i < visualStep
                        ? colors.accent.primary
                        : i === visualStep
                          ? colors.accent.primary
                          : colors.border.muted,
                      transform: i === visualStep ? 'scale(1.3)' : 'scale(1)',
                    }}
                  />
                ))}
              </div>

              {/* Arrow pointing down */}
              {targetRect && (
                <div style={spotlightStyles.arrow}>
                  <svg width="16" height="8" viewBox="0 0 16 8">
                    <path d="M0 0 L8 8 L16 0" fill={colors.bg.secondary} stroke={colors.border.default} strokeWidth="1" />
                  </svg>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </AnimatePresence>
    </>
  );
}

/** Full-canvas overlay for reflect and complete steps */
function CanvasOverlay({
  title,
  subtitle,
  children,
  onDismiss,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  onDismiss?: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      style={overlayStyles.backdrop}
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -12, scale: 0.97 }}
        transition={animation.spring.gentle}
        style={overlayStyles.card}
      >
        {onDismiss && (
          <button onClick={onDismiss} style={overlayStyles.skipBtn} aria-label="Skip">
            <X size={16} />
          </button>
        )}
        <h2 style={overlayStyles.title}>{title}</h2>
        {subtitle && <p style={overlayStyles.subtitle}>{subtitle}</p>}
        {children}
      </motion.div>
    </motion.div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function OnboardingGuide() {
  const { active, step, rootCardId, branch1CardId, branch2CardId, dismissOnboarding, completeOnboarding } = useOnboardingStore();

  // Track step transitions (skip the very first render when step is initialised)
  const prevStepRef = useRef<string | null>(null);
  useEffect(() => {
    if (!active) return;
    if (prevStepRef.current !== null && prevStepRef.current !== step) {
      analytics.onboardingStepReached(step);
    }
    prevStepRef.current = step;
  }, [active, step]);
  const selectedNodeIds = useCanvasStore((s) => s.selectedNodeIds);
  const knownIdsRef = useRef<Set<string>>(new Set());

  const mergeSelectedCount = branch1CardId && branch2CardId
    ? Number(selectedNodeIds.has(branch1CardId)) + Number(selectedNodeIds.has(branch2CardId))
    : 0;

  const mergeHintSelector =
    mergeSelectedCount >= 2
      ? '[data-onboarding="merge-button"]'
      : mergeSelectedCount === 1
        ? selectedNodeIds.has(branch1CardId ?? '')
          ? (branch2CardId ? `.react-flow__node[data-id="${branch2CardId}"]` : null)
          : (branch1CardId ? `.react-flow__node[data-id="${branch1CardId}"]` : null)
        : (branch1CardId ? `.react-flow__node[data-id="${branch1CardId}"]` : null);

  // ── Determine spotlight selector based on step ──
  const spotlightSelector =
    step === 'idle'
      ? '[data-onboarding="empty-canvas-hint"]'
      : step === 'branch-1-hint' || step === 'branch-2-hint'
      ? (rootCardId ? `.react-flow__node[data-id="${rootCardId}"]` : null)
      : step === 'merge-hint'
        ? mergeHintSelector
        : null;

  const targetRect = useElementRect(active ? spotlightSelector : null);

  // ── auto-chat steps: fire pending message when entering auto-chat-* ──
  useEffect(() => {
    if (!active) return;
    const onb = useOnboardingStore.getState();
    const prompt = ONBOARDING_PROMPTS[step];
    if (!prompt) return;

    let targetCardId: string | null = null;
    if (step === 'auto-chat-0') targetCardId = onb.rootCardId;
    else if (step === 'auto-chat-1') targetCardId = onb.branch1CardId;
    else if (step === 'auto-chat-2') targetCardId = onb.branch2CardId;
    else if (step === 'auto-chat-3') targetCardId = onb.mergeCardId;

    if (!targetCardId) return;

    // Open the chat panel for this card
    useCanvasStore.getState().openChatPanel(targetCardId);

    // Short delay to let the chat panel mount before injecting
    const t = setTimeout(() => {
      useOnboardingStore.getState().setPendingMessage({
        cardId: targetCardId!,
        text: prompt,
      });
    }, 600);

    return () => clearTimeout(t);
  }, [active, step]);

  // ── Auto-advance: auto-chat-0 → branch-1-hint ──
  // When root card has >= 2 messages (user + AI response)
  useEffect(() => {
    if (!active || step !== 'auto-chat-0') return;
    let advanced = false;

    const unsub = useCanvasStore.subscribe(
      (s) => {
        const id = useOnboardingStore.getState().rootCardId;
        if (!id) return 0;
        return s.conversations.get(id)?.content?.length ?? 0;
      },
      (len) => {
        if (len >= 2 && !advanced) {
          advanced = true;
          setTimeout(() => useOnboardingStore.getState().nextStep(), 1500);
        }
      },
    );

    // Guard: may have already arrived
    const id = useOnboardingStore.getState().rootCardId;
    if (id) {
      const len = useCanvasStore.getState().conversations.get(id)?.content?.length ?? 0;
      if (len >= 2 && !advanced) {
        advanced = true;
        setTimeout(() => useOnboardingStore.getState().nextStep(), 1500);
      }
    }

    return unsub;
  }, [active, step]);

  // ── Auto-advance: branch-1-hint → auto-chat-1 ──
  // When a new card appears (user branched from root)
  useEffect(() => {
    if (!active || step !== 'branch-1-hint') return;
    let advanced = false;

    // Snapshot current conversation IDs so we detect new ones
    knownIdsRef.current = new Set(useCanvasStore.getState().conversations.keys());

    const unsub = useCanvasStore.subscribe(
      (s) => s.conversations.size,
      (size, prevSize) => {
        if (size > prevSize && !advanced) {
          const state = useCanvasStore.getState();
          const rootId = useOnboardingStore.getState().rootCardId;
          if (!rootId) return;

          for (const [id, conv] of state.conversations) {
            if (!knownIdsRef.current.has(id)) {
              knownIdsRef.current.add(id);
              const isExpectedBranch = !conv.isMergeNode
                && conv.parentCardIds.length === 1
                && conv.parentCardIds[0] === rootId;

              if (isExpectedBranch) {
                advanced = true;
                useOnboardingStore.getState().setBranch1CardId(id);
                pulseNewEdge(id);
                useOnboardingStore.getState().nextStep();
                break;
              }
            }
          }
        }
      },
    );
    return unsub;
  }, [active, step]);

  // ── Auto-advance: auto-chat-1 → branch-2-hint ──
  useEffect(() => {
    if (!active || step !== 'auto-chat-1') return;
    let advanced = false;

    const unsub = useCanvasStore.subscribe(
      (s) => {
        const id = useOnboardingStore.getState().branch1CardId;
        if (!id) return 0;
        return s.conversations.get(id)?.content?.length ?? 0;
      },
      (len) => {
        if (len >= 2 && !advanced) {
          advanced = true;
          setTimeout(() => {
            // Close chat panel and focus root card for next branch
            useCanvasStore.getState().closeChatPanel();
            setTimeout(() => {
              const rootId = useOnboardingStore.getState().rootCardId;
              if (rootId) {
                useCanvasStore.getState().requestFocusNode(rootId);
              }
              useOnboardingStore.getState().nextStep();
            }, 500);
          }, 1500);
        }
      },
    );

    const id = useOnboardingStore.getState().branch1CardId;
    if (id) {
      const len = useCanvasStore.getState().conversations.get(id)?.content?.length ?? 0;
      if (len >= 2 && !advanced) {
        advanced = true;
        setTimeout(() => {
          useCanvasStore.getState().closeChatPanel();
          setTimeout(() => {
            const rootId = useOnboardingStore.getState().rootCardId;
            if (rootId) useCanvasStore.getState().requestFocusNode(rootId);
            useOnboardingStore.getState().nextStep();
          }, 500);
        }, 1500);
      }
    }

    return unsub;
  }, [active, step]);

  // ── Auto-advance: branch-2-hint → auto-chat-2 ──
  useEffect(() => {
    if (!active || step !== 'branch-2-hint') return;
    let advanced = false;

    knownIdsRef.current = new Set(useCanvasStore.getState().conversations.keys());

    const unsub = useCanvasStore.subscribe(
      (s) => s.conversations.size,
      (size, prevSize) => {
        if (size > prevSize && !advanced) {
          const state = useCanvasStore.getState();
          const rootId = useOnboardingStore.getState().rootCardId;
          const branch1Id = useOnboardingStore.getState().branch1CardId;
          if (!rootId || !branch1Id) return;

          for (const [id, conv] of state.conversations) {
            if (!knownIdsRef.current.has(id)) {
              knownIdsRef.current.add(id);
              const isExpectedBranch = id !== branch1Id
                && !conv.isMergeNode
                && conv.parentCardIds.length === 1
                && conv.parentCardIds[0] === rootId;

              if (isExpectedBranch) {
                advanced = true;
                useOnboardingStore.getState().setBranch2CardId(id);
                pulseNewEdge(id);
                useOnboardingStore.getState().nextStep();
                break;
              }
            }
          }
        }
      },
    );
    return unsub;
  }, [active, step]);

  // ── Auto-advance: auto-chat-2 → reflect ──
  useEffect(() => {
    if (!active || step !== 'auto-chat-2') return;
    let advanced = false;

    const unsub = useCanvasStore.subscribe(
      (s) => {
        const id = useOnboardingStore.getState().branch2CardId;
        if (!id) return 0;
        return s.conversations.get(id)?.content?.length ?? 0;
      },
      (len) => {
        if (len >= 2 && !advanced) {
          advanced = true;
          setTimeout(() => {
            useCanvasStore.getState().closeChatPanel();
            setTimeout(() => useOnboardingStore.getState().nextStep(), 500);
          }, 1500);
        }
      },
    );

    const id = useOnboardingStore.getState().branch2CardId;
    if (id) {
      const len = useCanvasStore.getState().conversations.get(id)?.content?.length ?? 0;
      if (len >= 2 && !advanced) {
        advanced = true;
        setTimeout(() => {
          useCanvasStore.getState().closeChatPanel();
          setTimeout(() => useOnboardingStore.getState().nextStep(), 500);
        }, 1500);
      }
    }

    return unsub;
  }, [active, step]);

  // ── Auto-advance: merge-hint → auto-chat-3 ──
  // When a new merge node appears
  useEffect(() => {
    if (!active || step !== 'merge-hint') return;
    let advanced = false;

    knownIdsRef.current = new Set(useCanvasStore.getState().conversations.keys());

    const unsub = useCanvasStore.subscribe(
      (s) => s.conversations.size,
      (size, prevSize) => {
        if (size > prevSize && !advanced) {
          const state = useCanvasStore.getState();
          const branch1Id = useOnboardingStore.getState().branch1CardId;
          const branch2Id = useOnboardingStore.getState().branch2CardId;
          if (!branch1Id || !branch2Id) return;

          for (const [id, conv] of state.conversations) {
            if (!knownIdsRef.current.has(id) && conv.isMergeNode) {
              knownIdsRef.current.add(id);
              const parentSet = new Set(conv.parentCardIds);
              const isExpectedMerge = conv.parentCardIds.length === 2
                && parentSet.has(branch1Id)
                && parentSet.has(branch2Id);

              if (isExpectedMerge) {
                advanced = true;
                useOnboardingStore.getState().setMergeCardId(id);
                pulseNewEdge(id);
                useOnboardingStore.getState().nextStep();
                break;
              }
            }
          }
        }
      },
    );
    return unsub;
  }, [active, step]);

  // ── Auto-advance: auto-chat-3 → complete ──
  useEffect(() => {
    if (!active || step !== 'auto-chat-3') return;
    let advanced = false;

    const unsub = useCanvasStore.subscribe(
      (s) => {
        const id = useOnboardingStore.getState().mergeCardId;
        if (!id) return 0;
        return s.conversations.get(id)?.content?.length ?? 0;
      },
      (len) => {
        if (len >= 2 && !advanced) {
          advanced = true;
          setTimeout(() => {
            useCanvasStore.getState().closeChatPanel();
            setTimeout(() => useOnboardingStore.getState().nextStep(), 500);
          }, 2000);
        }
      },
    );

    const id = useOnboardingStore.getState().mergeCardId;
    if (id) {
      const len = useCanvasStore.getState().conversations.get(id)?.content?.length ?? 0;
      if (len >= 2 && !advanced) {
        advanced = true;
        setTimeout(() => {
          useCanvasStore.getState().closeChatPanel();
          setTimeout(() => useOnboardingStore.getState().nextStep(), 500);
        }, 2000);
      }
    }

    return unsub;
  }, [active, step]);

  const handleDismiss = useCallback(() => {
    analytics.onboardingAbandoned(step);
    dismissOnboarding();
  }, [dismissOnboarding, step]);

  const handleClearCanvas = useCallback(() => {
    analytics.onboardingCompleted('clear');
    const store = useCanvasStore.getState();
    // Delete all conversations in the active workspace
    const ids = Array.from(store.conversations.keys());
    ids.forEach(id => store.deleteConversation(id));
    completeOnboarding();
  }, [completeOnboarding]);

  const handleKeepExploring = useCallback(() => {
    analytics.onboardingCompleted('keep');
    completeOnboarding();
  }, [completeOnboarding]);

  if (!active) return null;

  // ── Intro: pain-statement overlay — framing before canvas interaction ──
  if (step === 'intro') {
    return (
      <AnimatePresence>
        <CanvasOverlay
          title="Every time you wanted to explore a different angle, you had to start over."
          subtitle="Not anymore."
          onDismiss={handleDismiss}
        >
          <motion.button
            onClick={() => useOnboardingStore.getState().nextStep()}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            style={overlayStyles.continueBtn}
          >
            Start walkthrough
            <ArrowRight size={16} style={{ marginLeft: 8 }} />
          </motion.button>
        </CanvasOverlay>
      </AnimatePresence>
    );
  }

  // ── Idle: canvas visible, waiting for first card creation ──
  if (step === 'idle') {
    return (
      <SpotlightOverlay
        targetRect={targetRect}
        tooltip={{
          title: 'Start a conversation',
          description: 'Create your first card, then we’ll explore branching.',
        }}
        icon={<ArrowRight size={18} />}
        onDismiss={handleDismiss}
        visualStep={0}
      />
    );
  }

  // ── Auto-chat steps: no overlay (auto-typing happens in MessageInput) ──
  if (step.startsWith('auto-chat')) return null;

  // ── Branch hints: spotlight the root card ──
  if (step === 'branch-1-hint') {
    return (
      <SpotlightOverlay
        targetRect={targetRect}
        tooltip={{
          title: 'Branch to explore a different angle',
          description: "Right-click this card and choose 'Branch from here'.",
        }}
        icon={<GitBranch size={18} />}
        onDismiss={handleDismiss}
        visualStep={1}
      />
    );
  }

  if (step === 'branch-2-hint') {
    return (
      <SpotlightOverlay
        targetRect={targetRect}
        tooltip={{
          title: 'Branch again — same context, different angle',
          description: 'Branch once more from this original card.',
        }}
        icon={<GitBranch size={18} />}
        onDismiss={handleDismiss}
        visualStep={2}
      />
    );
  }

  // ── Reflect: canvas-only overlay ──
  if (step === 'reflect') {
    return (
      <AnimatePresence>
        <CanvasOverlay
          title="You're exploring two angles in parallel"
          subtitle="Both branches keep the same starting context."
          onDismiss={handleDismiss}
        >
          <motion.button
            onClick={() => useOnboardingStore.getState().nextStep()}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            style={overlayStyles.continueBtn}
          >
            Continue
            <ArrowRight size={16} style={{ marginLeft: 8 }} />
          </motion.button>
        </CanvasOverlay>
      </AnimatePresence>
    );
  }

  // ── Merge hint ──
  if (step === 'merge-hint') {
    const mergeTooltip = mergeSelectedCount >= 2
      ? {
          title: 'Perfect — now merge them',
          description: 'Click Merge in the floating action bar.',
        }
      : mergeSelectedCount === 1
        ? {
            title: 'Select one more branch card',
            description: 'Hold Shift and click the other branch card to multi-select both.',
          }
        : {
            title: 'Select both branch cards',
            description: 'Click one branch card, then hold Shift and click the second card.',
          };

    return (
      <SpotlightOverlay
        targetRect={targetRect}
        tooltip={mergeTooltip}
        icon={<GitMerge size={18} />}
        onDismiss={handleDismiss}
        visualStep={3}
      />
    );
  }

  // ── Complete: two-button overlay ──
  if (step === 'complete') {
    return (
      <AnimatePresence>
        <CanvasOverlay
          title="That's it. This canvas is yours."
          subtitle="Add your API key in Settings for real conversations. Your data stays in your browser."
        >
          <div style={overlayStyles.completeActions}>
            <motion.button
              onClick={handleClearCanvas}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              style={overlayStyles.clearBtn}
            >
              <Trash2 size={16} />
              Start fresh
            </motion.button>
            <motion.button
              onClick={handleKeepExploring}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              style={overlayStyles.keepBtn}
            >
              <Sparkles size={16} />
              Keep this canvas
            </motion.button>
          </div>
        </CanvasOverlay>
      </AnimatePresence>
    );
  }

  return null;
}

// =============================================================================
// HELPERS
// =============================================================================

/** Temporarily animate the edge connected to a new card */
function pulseNewEdge(newCardId: string) {
  const state = useCanvasStore.getState();

  // Find edge that targets this new card
  const newEdge = state.edges.find((e) => e.target === newCardId);

  if (newEdge) {
    useCanvasStore.setState({
      edges: state.edges.map((e) =>
        e.id === newEdge.id ? { ...e, animated: true } : e,
      ),
    });
    setTimeout(() => {
      const current = useCanvasStore.getState();
      useCanvasStore.setState({
        edges: current.edges.map((e) =>
          e.id === newEdge.id ? { ...e, animated: false } : e,
        ),
      });
    }, 2500);
  }
}

// =============================================================================
// STYLES — Spotlight
// =============================================================================

const spotlightStyles: Record<string, React.CSSProperties> = {
  tooltip: {
    backgroundColor: colors.bg.secondary,
    border: `1px solid ${colors.border.default}`,
    borderRadius: effects.border.radius.lg,
    padding: '16px 20px',
    boxShadow: effects.shadow.xl,
    position: 'relative',
    minWidth: 280,
  },
  closeBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    background: 'transparent',
    border: 'none',
    color: colors.fg.quaternary,
    cursor: 'pointer',
    padding: 4,
    borderRadius: 6,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconWrap: {
    flexShrink: 0,
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.accent.muted,
    color: colors.accent.primary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
    paddingRight: 14,
  },
  title: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    fontFamily: typography.fonts.heading,
    letterSpacing: '-0.01em',
    color: colors.fg.primary,
    marginBottom: 4,
  },
  description: {
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.body,
    color: colors.fg.secondary,
    lineHeight: typography.lineHeights.comfortable,
  },
  dots: {
    display: 'flex',
    justifyContent: 'center',
    gap: 5,
    marginTop: 12,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    transition: 'background-color 0.2s, transform 0.2s',
  },
  arrow: {
    position: 'absolute',
    bottom: -8,
    left: '50%',
    transform: 'translateX(-50%)',
    lineHeight: 0,
  },
};

// =============================================================================
// STYLES — Canvas Overlay
// =============================================================================

const overlayStyles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: zIndex.overlay.modalBackdrop,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: colors.bg.secondary,
    border: `1px solid ${colors.border.default}`,
    borderRadius: effects.border.radius.xl,
    padding: '44px 44px 36px',
    maxWidth: 520,
    width: '90vw',
    position: 'relative',
    boxShadow: effects.shadow.xl,
    textAlign: 'center' as const,
  },
  skipBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    background: 'transparent',
    border: 'none',
    color: colors.fg.quaternary,
    cursor: 'pointer',
    padding: 6,
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: '1.4rem',
    fontWeight: typography.weights.bold,
    fontFamily: typography.fonts.heading,
    letterSpacing: '-0.025em',
    color: colors.fg.primary,
    margin: '0 0 12px',
    lineHeight: 1.3,
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.body,
    color: colors.fg.secondary,
    lineHeight: typography.lineHeights.comfortable,
    margin: '0 0 24px',
  },
  continueBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '10px 24px',
    borderRadius: 12,
    border: 'none',
    backgroundColor: colors.accent.primary,
    color: colors.accent.contrast,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    fontFamily: typography.fonts.body,
    cursor: 'pointer',
  },
  mergeInstructions: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 12,
    textAlign: 'left' as const,
    margin: '0 auto',
    maxWidth: 340,
  },
  mergeStep: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.body,
    color: colors.fg.secondary,
  },
  mergeStepNumber: {
    width: 24,
    height: 24,
    borderRadius: '50%',
    backgroundColor: colors.accent.muted,
    color: colors.accent.primary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    flexShrink: 0,
  },
  completeActions: {
    display: 'flex',
    gap: 12,
    justifyContent: 'center',
    flexWrap: 'wrap' as const,
  },
  clearBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 20px',
    borderRadius: 12,
    border: `1px solid ${colors.border.default}`,
    backgroundColor: colors.bg.inset,
    color: colors.fg.secondary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    fontFamily: typography.fonts.body,
    cursor: 'pointer',
  },
  keepBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 20px',
    borderRadius: 12,
    border: 'none',
    backgroundColor: colors.accent.primary,
    color: colors.accent.contrast,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    fontFamily: typography.fonts.body,
    cursor: 'pointer',
  },
};
