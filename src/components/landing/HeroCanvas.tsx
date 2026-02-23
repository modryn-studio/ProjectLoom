'use client';

import React, { useEffect, useRef, useLayoutEffect, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { LandingCard, type LandingCardData } from './LandingCard';
import { LandingChatPanel } from './LandingChatPanel';

// =============================================================================
// COORDINATE SYSTEM — HORIZONTAL (default)
// Diamond: 1 parent → 2 branches → 1 merge, plus a chat panel on the right
// =============================================================================

const CANVAS_W = 1060;
const CANVAS_H = 480;
const CARD_W = 220;
const CARD_H = 130;
const CHAT_PANEL_W = 280;
const CHAT_PANEL_GAP = 20;

const CARD_XY = [
  { x: 10,  y: 175 }, // 0: root  — vertically centred
  { x: 260, y: 30  }, // 1: branch A (top)
  { x: 260, y: 320 }, // 2: branch B (bottom)
  { x: 510, y: 175 }, // 3: merge  — vertically centred
];

// Chat panel sits to the right of the card diamond
const CHAT_X = CARD_XY[3].x + CARD_W + CHAT_PANEL_GAP;
const CHAT_Y = 0;
const CHAT_H = CANVAS_H;

const cy = (i: number) => CARD_XY[i].y + CARD_H / 2;
const rx = (i: number) => CARD_XY[i].x + CARD_W;
const lx = (i: number) => CARD_XY[i].x;

// Diamond SVG paths: 0→1, 0→2 (branch), 1→3, 2→3 (merge)
const SVG_PATHS: Record<string, string> = {
  '0-1': `M ${rx(0)} ${cy(0)} C ${rx(0)+40} ${cy(0)}, ${lx(1)-40} ${cy(1)}, ${lx(1)} ${cy(1)}`,
  '0-2': `M ${rx(0)} ${cy(0)} C ${rx(0)+40} ${cy(0)}, ${lx(2)-40} ${cy(2)}, ${lx(2)} ${cy(2)}`,
  '1-3': `M ${rx(1)} ${cy(1)} C ${rx(1)+40} ${cy(1)}, ${lx(3)-40} ${cy(3)}, ${lx(3)} ${cy(3)}`,
  '2-3': `M ${rx(2)} ${cy(2)} C ${rx(2)+40} ${cy(2)}, ${lx(3)-40} ${cy(3)}, ${lx(3)} ${cy(3)}`,
};

// Phase machine — sequential reveal: parent+chat0 → child1+chat1 → child2+chat2 → merge+chat3
const CARD_SHOW_AT: number[] = [1, 3, 5, 7];
const LINE_SHOW_AT: Record<string, number> = { '0-1': 2, '0-2': 4, '1-3': 6, '2-3': 6 };

// =============================================================================
// COORDINATE SYSTEM — VERTICAL (mobile, top-down diamond)
// Root at top-centre, two branches in middle, merge at bottom.
// No chat panel on mobile.
// =============================================================================

const V_CANVAS_W = 640;
const V_CANVAS_H = 600;

const V_CARD_XY = [
  { x: 210, y: 10  }, // 0: root  (centre-top)
  { x: 30,  y: 240 }, // 1: branch A (left-mid)
  { x: 390, y: 240 }, // 2: branch B (right-mid)
  { x: 210, y: 460 }, // 3: merge (centre-bottom)
];

const v_bcx = (i: number) => V_CARD_XY[i].x + CARD_W / 2;
const v_by  = (i: number) => V_CARD_XY[i].y + CARD_H;
const v_tcx = (i: number) => V_CARD_XY[i].x + CARD_W / 2;
const v_ty  = (i: number) => V_CARD_XY[i].y;

const V_SVG_PATHS: Record<string, string> = {
  '0-1': `M ${v_bcx(0)} ${v_by(0)} C ${v_bcx(0)} ${v_by(0)+50}, ${v_tcx(1)} ${v_ty(1)-50}, ${v_tcx(1)} ${v_ty(1)}`,
  '0-2': `M ${v_bcx(0)} ${v_by(0)} C ${v_bcx(0)} ${v_by(0)+50}, ${v_tcx(2)} ${v_ty(2)-50}, ${v_tcx(2)} ${v_ty(2)}`,
  '1-3': `M ${v_bcx(1)} ${v_by(1)} C ${v_bcx(1)} ${v_by(1)+50}, ${v_tcx(3)} ${v_ty(3)-50}, ${v_tcx(3)} ${v_ty(3)}`,
  '2-3': `M ${v_bcx(2)} ${v_by(2)} C ${v_bcx(2)} ${v_by(2)+50}, ${v_tcx(3)} ${v_ty(3)-50}, ${v_tcx(3)} ${v_ty(3)}`,
};

// phase machine — same sequential timing as horizontal
const V_CARD_SHOW_AT: number[] = [1, 3, 5, 7];
const V_LINE_SHOW_AT: Record<string, number> = { '0-1': 2, '0-2': 4, '1-3': 6, '2-3': 6 };

// =============================================================================
// ANIMATION PHASE HELPERS
// =============================================================================

const isCardVisible = (i: number, phase: number, showAt: number[]) =>
  phase >= showAt[i] && phase < 9;
const isLineVisible = (id: string, phase: number, showAt: Record<string, number>) =>
  phase >= showAt[id] && phase < 9;

// =============================================================================
// CARD DATA
// =============================================================================

const CARDS: LandingCardData[] = [
  {
    title: 'New product idea',
    preview: 'I want to build a tool for indie hackers to track their MRR. Should I build this?',
    timestamp: '2d ago',
  },
  {
    title: 'Build it',
    preview: 'Yes — scratch your own itch. Ship an MVP in two weeks and charge from day one.',
    timestamp: '2d ago',
    isBranch: true,
  },
  {
    title: 'Validate first',
    preview: 'Don\'t build yet. Post in communities, collect 10 emails, and see if anyone pays.',
    timestamp: '2d ago',
    isBranch: true,
  },
  {
    title: 'Combined strategy',
    preview: 'Build a lightweight MVP and validate in parallel — ship fast, but prove demand first.',
    timestamp: '1d ago',
    isMerge: true,
  },
];

// =============================================================================
// SCALED STAGE
// =============================================================================

/**
 * Scales a fixed w × h inner stage to fill its container.
 */
function ScaledStage({ canvasW, canvasH, children }: { canvasW: number; canvasH: number; children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      setScale(Math.min(width / canvasW, height / canvasH));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [canvasW, canvasH]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: canvasW,
          height: canvasH,
          transformOrigin: 'center center',
          transform: `translate(-50%, -50%) scale(${scale})`,
        }}
      >
        {children}
      </div>
    </div>
  );
}

// =============================================================================
// DOT GRID
// =============================================================================

function DotGrid() {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `radial-gradient(circle, var(--border-default) 1.5px, transparent 1.5px)`,
        backgroundSize: '20px 20px',
        opacity: 0.6,
        pointerEvents: 'none',
      }}
    />
  );
}

// =============================================================================
// HERO CANVAS
// =============================================================================

/**
 * Cinematic looping demo of ProjectLoom branching.
 * Pass vertical=true for a top-down layout (mobile).
 */
export function HeroCanvas({ vertical = false }: { vertical?: boolean }) {
  // Pick the right layout config
  const cw     = vertical ? V_CANVAS_W     : CANVAS_W;
  const ch     = vertical ? V_CANVAS_H     : CANVAS_H;
  const cardXY = vertical ? V_CARD_XY      : CARD_XY;
  const paths  = vertical ? V_SVG_PATHS    : SVG_PATHS;
  const cards  = CARDS;
  const showAt = vertical ? V_CARD_SHOW_AT : CARD_SHOW_AT;
  const lineAt = vertical ? V_LINE_SHOW_AT : LINE_SHOW_AT;
  const [phase, setPhase] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const schedule = (fn: () => void, ms: number) => {
    const t = setTimeout(fn, ms);
    timers.current.push(t);
  };

  const runLoop = () => {
    setPhase(0);
    // Both layouts use the same phase sequence:
    // root+chat0 → line to child1 → child1+chat1 → line to child2 → child2+chat2
    // → merge lines → merge+chat3 → hold → fade
    schedule(() => {
      setPhase(1);
      schedule(() => {
        setPhase(2);
        schedule(() => {
          setPhase(3);
          schedule(() => {
            setPhase(4);
            schedule(() => {
              setPhase(5);
              schedule(() => {
                setPhase(6);
                schedule(() => {
                  setPhase(7);
                  schedule(() => {
                    setPhase(8);
                    schedule(() => {
                      setPhase(9);
                      schedule(runLoop, 1000);
                    }, 1000);
                  }, 3600);
                }, 600);
              }, 700);
            }, 600);
          }, 700);
        }, 700);
      }, 600);
    }, 700);
  };

  useEffect(() => {
    const t = setTimeout(runLoop, 400);
    return () => {
      clearTimeout(t);
      clearTimers();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vertical]);

  const cardAnim = (i: number) => ({
    opacity: isCardVisible(i, phase, showAt) ? 1 : 0,
    y: isCardVisible(i, phase, showAt) ? 0 : 14,
  });

  const cardTransition = (i: number) => ({
    duration: phase === 9 ? 0.6 : 0.45,
    ease: 'easeOut' as const,
    delay: phase === 9 ? 0 : (i === 1 || i === 3) ? 0 : 0.15,
  });

  const lineAnim = (id: string) => ({
    pathLength: isLineVisible(id, phase, lineAt) ? 1 : 0,
    opacity: isLineVisible(id, phase, lineAt) ? 1 : 0,
  });

  const lineTransition = () => ({
    pathLength: { duration: phase === 9 ? 0.4 : 0.65, ease: 'easeInOut' as const },
    opacity: { duration: 0.25 },
  });

  const chatStepIndex = phase >= 7
    ? 3
    : phase >= 5
    ? 2
    : phase >= 3
    ? 1
    : 0;

  return (
    <div style={styles.outer}>
      <DotGrid />
      <ScaledStage canvasW={cw} canvasH={ch}>
        <div style={{ position: 'relative', width: cw, height: ch }}>
          {/* SVG connector lines */}
          <svg
            style={{ position: 'absolute', top: 0, left: 0, width: cw, height: ch, pointerEvents: 'none', overflow: 'visible' }}
            viewBox={`0 0 ${cw} ${ch}`}
            xmlns="http://www.w3.org/2000/svg"
          >
            {Object.entries(paths).map(([id, d]) => (
              <motion.path
                key={id}
                d={d}
                fill="none"
                stroke="var(--accent-primary)"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={lineAnim(id)}
                transition={lineTransition()}
              />
            ))}

          </svg>

          {/* Cards */}
          {cards.map((card, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 14 }}
              animate={cardAnim(i)}
              transition={cardTransition(i)}
              style={{
                position: 'absolute',
                left: cardXY[i].x,
                top: cardXY[i].y,
              }}
            >
              <LandingCard data={card} style={{ width: CARD_W, height: CARD_H }} />
            </motion.div>
          ))}

          {/* Chat panel — desktop only, fades in with the first card */}
          {!vertical && (
            <LandingChatPanel
              x={CHAT_X}
              y={CHAT_Y}
              width={CHAT_PANEL_W}
              height={CHAT_H}
              visible={phase >= 1 && phase < 9}
              messageIndex={chatStepIndex}
            />
          )}
        </div>
      </ScaledStage>
    </div>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles: Record<string, React.CSSProperties> = {
  outer: {
    position: 'relative',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  },

};
