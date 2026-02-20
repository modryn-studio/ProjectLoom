'use client';

import React, { useEffect, useRef, useLayoutEffect, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { LandingCard, type LandingCardData } from './LandingCard';

// =============================================================================
// COORDINATE SYSTEM — HORIZONTAL (default)
// =============================================================================

const CANVAS_W = 960;
const CANVAS_H = 480;
const CARD_W = 280; // card.size.minWidth
const CARD_H = 160; // card.size.collapsedHeight

const CARD_XY = [
  { x: 10,  y: 160 }, // 0: root
  { x: 340, y: 40  }, // 1: tech stack
  { x: 340, y: 282 }, // 2: finding users
  { x: 660, y: 10  }, // 3: app router
  { x: 660, y: 252 }, // 4: landing page
];

const cy = (i: number) => CARD_XY[i].y + CARD_H / 2;
const rx = (i: number) => CARD_XY[i].x + CARD_W;
const lx = (i: number) => CARD_XY[i].x;

const SVG_PATHS: Record<string, string> = {
  '0-1': `M ${rx(0)} ${cy(0)} C ${rx(0)+50} ${cy(0)}, ${lx(1)-50} ${cy(1)}, ${lx(1)} ${cy(1)}`,
  '0-2': `M ${rx(0)} ${cy(0)} C ${rx(0)+50} ${cy(0)}, ${lx(2)-50} ${cy(2)}, ${lx(2)} ${cy(2)}`,
  '1-3': `M ${rx(1)} ${cy(1)} C ${rx(1)+50} ${cy(1)}, ${lx(3)-50} ${cy(3)}, ${lx(3)} ${cy(3)}`,
  '2-4': `M ${rx(2)} ${cy(2)} C ${rx(2)+50} ${cy(2)}, ${lx(4)-50} ${cy(4)}, ${lx(4)} ${cy(4)}`,
};

// phase machine — 5 cards, 2 levels of branching
const CARD_SHOW_AT: number[] = [1, 3, 3, 5, 5];
const LINE_SHOW_AT: Record<string, number> = { '0-1': 2, '0-2': 2, '1-3': 4, '2-4': 4 };

// =============================================================================
// COORDINATE SYSTEM — VERTICAL (mobile, top-down)
// 3 levels: root at top-centre, two branches in middle, two leaves at bottom.
// =============================================================================

const V_CANVAS_W = 640;
const V_CANVAS_H = 760;

const V_CARD_XY = [
  { x: 180, y: 10  }, // 0: root  (centre-x=320, bottom=170)
  { x: 20,  y: 300 }, // 1: tech stack   (centre-x=160, top=300, bottom=460)
  { x: 340, y: 300 }, // 2: finding users (centre-x=480, top=300, bottom=460)
  { x: 20,  y: 590 }, // 3: app router   (centre-x=160)
  { x: 340, y: 590 }, // 4: landing page  (centre-x=480)
];

const v_bcx = (i: number) => V_CARD_XY[i].x + CARD_W / 2;
const v_by  = (i: number) => V_CARD_XY[i].y + CARD_H;
const v_tcx = (i: number) => V_CARD_XY[i].x + CARD_W / 2;
const v_ty  = (i: number) => V_CARD_XY[i].y;

// Cubic bezier curves with vertical control-point offsets — same technique as
// the horizontal layout but rotated 90°. CP1 is directly below the source;
// CP2 is directly above the target. This makes the line leave straight down
// and arrive straight down, with a smooth arc in between.
const V_SVG_PATHS: Record<string, string> = {
  '0-1': `M ${v_bcx(0)} ${v_by(0)} C ${v_bcx(0)} ${v_by(0)+65}, ${v_tcx(1)} ${v_ty(1)-65}, ${v_tcx(1)} ${v_ty(1)}`,
  '0-2': `M ${v_bcx(0)} ${v_by(0)} C ${v_bcx(0)} ${v_by(0)+65}, ${v_tcx(2)} ${v_ty(2)-65}, ${v_tcx(2)} ${v_ty(2)}`,
  '1-3': `M ${v_bcx(1)} ${v_by(1)} C ${v_bcx(1)} ${v_by(1)+65}, ${v_tcx(3)} ${v_ty(3)-65}, ${v_tcx(3)} ${v_ty(3)}`,
  '2-4': `M ${v_bcx(2)} ${v_by(2)} C ${v_bcx(2)} ${v_by(2)+65}, ${v_tcx(4)} ${v_ty(4)-65}, ${v_tcx(4)} ${v_ty(4)}`,
};

// phase machine — 5 cards, 2 levels of branching (same as horizontal)
const V_CARD_SHOW_AT: number[] = [1, 3, 3, 5, 5];
const V_LINE_SHOW_AT: Record<string, number> = { '0-1': 2, '0-2': 2, '1-3': 4, '2-4': 4 };

// =============================================================================
// ANIMATION PHASE HELPERS
// =============================================================================

const isCardVisible = (i: number, phase: number, showAt: number[]) =>
  phase >= showAt[i] && phase < 7;
const isLineVisible = (id: string, phase: number, showAt: Record<string, number>) =>
  phase >= showAt[id] && phase < 7;

// =============================================================================
// CARD DATA
// =============================================================================

const CARDS: LandingCardData[] = [
  {
    title: 'Ship a Side Project in 30 Days',
    preview: 'I want to build and ship a side project in 30 days. How do I actually do this?',
    timestamp: '3d ago',
  },
  {
    title: 'Tech Stack',
    preview: 'What stack should I use? I know React and Node. I want to ship fast without fighting the tools.',
    timestamp: '2d ago',
    isBranch: true,
  },
  {
    title: 'Finding Your Users',
    preview: 'Who are my first users and how do I actually find them? "Post on social" feels vague.',
    timestamp: '2d ago',
    isBranch: true,
  },
  {
    title: 'App Router vs Pages Router',
    preview: 'Should I use the App Router or stick with Pages Router for an MVP?',
    timestamp: '1d ago',
    isBranch: true,
  },
  {
    title: 'Landing Page Copy',
    preview: 'How do I write landing page copy that actually converts developers?',
    timestamp: '18h ago',
    isBranch: true,
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
    // Both layouts use the same 5-phase sequence: root → lines1 → cards1 → lines2 → cards2 → hold → fade
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
                setPhase(7);
                schedule(runLoop, 1000);
              }, 4000);
            }, 600);
          }, 600);
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
    duration: phase === 7 ? 0.6 : 0.45,
    ease: 'easeOut' as const,
    delay: phase === 7 ? 0 : (i === 1 || i === 3) ? 0 : 0.15,
  });

  const lineAnim = (id: string) => ({
    pathLength: isLineVisible(id, phase, lineAt) ? 1 : 0,
    opacity: isLineVisible(id, phase, lineAt) ? 1 : 0,
  });

  const lineTransition = () => ({
    pathLength: { duration: phase === 7 ? 0.4 : 0.65, ease: 'easeInOut' as const },
    opacity: { duration: 0.25 },
  });

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
              <LandingCard data={card} />
            </motion.div>
          ))}
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
