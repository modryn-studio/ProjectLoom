'use client';

import { useEffect, useState, useRef } from 'react';
import { colors, typography, spacing, effects } from '@/lib/design-tokens';
import { zIndex } from '@/constants/zIndex';

// =============================================================================
// TYPES
// =============================================================================

interface PerformanceStats {
  fps: number;
  nodeCount: number;
  edgeCount: number;
  memoryMB?: number;
}

interface Props {
  nodeCount: number;
  edgeCount: number;
}

// =============================================================================
// DEV PERFORMANCE OVERLAY
// =============================================================================

/**
 * Development-only overlay showing FPS and node count
 * 
 * Only renders in development mode. Displays real-time
 * performance metrics for validating canvas performance.
 */
export function DevPerformanceOverlay({ nodeCount, edgeCount }: Props) {
  const [stats, setStats] = useState<PerformanceStats>({
    fps: 0,
    nodeCount,
    edgeCount,
  });
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  const frameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(performance.now());
  const framesRef = useRef<number>(0);

  // Only render in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  // FPS counter
  useEffect(() => {
    let animationId: number;
    
    const measureFPS = (currentTime: number) => {
      framesRef.current++;
      
      const elapsed = currentTime - lastTimeRef.current;
      
      if (elapsed >= 1000) {
        const fps = Math.round((framesRef.current * 1000) / elapsed);
        
        // Get memory if available (Chrome only)
        let memoryMB: number | undefined;
        if ('memory' in performance) {
          const memory = (performance as Performance & { memory: { usedJSHeapSize: number } }).memory;
          memoryMB = Math.round(memory.usedJSHeapSize / 1024 / 1024);
        }
        
        setStats({
          fps,
          nodeCount,
          edgeCount,
          memoryMB,
        });
        
        framesRef.current = 0;
        lastTimeRef.current = currentTime;
      }
      
      animationId = requestAnimationFrame(measureFPS);
    };
    
    animationId = requestAnimationFrame(measureFPS);
    
    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [nodeCount, edgeCount]);

  const getFPSColor = (fps: number): string => {
    if (fps >= 55) return colors.semantic.success;
    if (fps >= 30) return colors.semantic.warning;
    return colors.semantic.error;
  };

  if (isCollapsed) {
    return (
      <button
        onClick={() => setIsCollapsed(false)}
        style={styles.collapsedButton}
        title="Show performance stats"
      >
        📊
      </button>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.title}>Performance</span>
        <button
          onClick={() => setIsCollapsed(true)}
          style={styles.closeButton}
          title="Collapse"
        >
          ×
        </button>
      </div>
      
      <div style={styles.stats}>
        <div style={styles.statRow}>
          <span style={styles.statLabel}>FPS</span>
          <span style={{ ...styles.statValue, color: getFPSColor(stats.fps) }}>
            {stats.fps}
          </span>
        </div>
        
        <div style={styles.statRow}>
          <span style={styles.statLabel}>Nodes</span>
          <span style={styles.statValue}>{stats.nodeCount}</span>
        </div>
        
        <div style={styles.statRow}>
          <span style={styles.statLabel}>Edges</span>
          <span style={styles.statValue}>{stats.edgeCount}</span>
        </div>
        
        {stats.memoryMB !== undefined && (
          <div style={styles.statRow}>
            <span style={styles.statLabel}>Memory</span>
            <span style={styles.statValue}>{stats.memoryMB} MB</span>
          </div>
        )}
      </div>
      
      <div style={styles.footer}>
        <span style={styles.footerText}>Dev Only</span>
      </div>
    </div>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    top: spacing[4],
    right: spacing[4],
    backgroundColor: `${colors.navy.dark}ee`,
    borderRadius: effects.border.radius.default,
    padding: spacing[3],
    minWidth: '140px',
    zIndex: zIndex.overlay.devOverlay,
    fontFamily: typography.fonts.code,
    fontSize: typography.sizes.xs,
    border: `1px solid ${colors.navy.hover}`,
    backdropFilter: `blur(${effects.blur.sm})`,
  },
  
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[2],
    paddingBottom: spacing[2],
    borderBottom: `1px solid ${colors.navy.hover}`,
  },
  
  title: {
    color: colors.contrast.gray,
    fontWeight: typography.weights.medium,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  
  closeButton: {
    background: 'none',
    border: 'none',
    color: colors.contrast.grayDark,
    cursor: 'pointer',
    fontSize: typography.sizes.base,
    padding: 0,
    lineHeight: 1,
  },
  
  stats: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing[1],
  },
  
  statRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  
  statLabel: {
    color: colors.contrast.grayDark,
  },
  
  statValue: {
    color: colors.contrast.white,
    fontWeight: typography.weights.medium,
  },
  
  footer: {
    marginTop: spacing[2],
    paddingTop: spacing[2],
    borderTop: `1px solid ${colors.navy.hover}`,
  },
  
  footerText: {
    color: colors.violet.muted,
    fontSize: typography.sizes.xs,
  },
  
  collapsedButton: {
    position: 'fixed',
    top: spacing[4],
    right: spacing[4],
    width: '32px',
    height: '32px',
    backgroundColor: `${colors.navy.dark}ee`,
    border: `1px solid ${colors.navy.hover}`,
    borderRadius: effects.border.radius.default,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: zIndex.overlay.devOverlay,
    fontSize: typography.sizes.sm,
  },
};

export default DevPerformanceOverlay;
