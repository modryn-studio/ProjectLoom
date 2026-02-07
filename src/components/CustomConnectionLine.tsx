'use client';

import React from 'react';
import type { ConnectionLineComponentProps } from '@xyflow/react';
import { colors } from '@/lib/design-tokens';

// =============================================================================
// CUSTOM CONNECTION LINE COMPONENT
// =============================================================================

/**
 * Custom connection line shown while dragging to create a new edge
 * 
 * Features:
 * - Dashed amber line (distinct from final edge color)
 * - Animated dash pattern
 * - Glowing endpoint indicator
 * 
 * Per Phase 1 spec Section 19: Connection Visual Feedback
 */
export function CustomConnectionLine({
  fromX,
  fromY,
  toX,
  toY,
}: ConnectionLineComponentProps) {
  // Calculate control points for a smooth curve
  const midX = (fromX + toX) / 2;
  
  // Bezier curve path
  const path = `M ${fromX} ${fromY} C ${midX} ${fromY} ${midX} ${toY} ${toX} ${toY}`;

  return (
    <g>
      {/* Main connection line - dashed amber */}
      <path
        d={path}
        fill="none"
        stroke={colors.accent.primary}
        strokeWidth={3}
        strokeDasharray="8, 4"
        className="connection-line-animated"
        style={{
          filter: `drop-shadow(0 0 4px ${colors.accent.muted})`,
        }}
      />
      
      {/* Glowing endpoint indicator */}
      <circle
        cx={toX}
        cy={toY}
        r={8}
        fill={colors.accent.primary}
        style={{
          filter: `drop-shadow(0 0 8px ${colors.accent.muted})`,
        }}
      >
        <animate
          attributeName="r"
          values="6;10;6"
          dur="1s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="opacity"
          values="1;0.6;1"
          dur="1s"
          repeatCount="indefinite"
        />
      </circle>
      
      {/* Inner circle for depth */}
      <circle
        cx={toX}
        cy={toY}
        r={4}
        fill={colors.accent.secondary}
      />
    </g>
  );
}

// =============================================================================
// CSS (add to globals.css or canvas.css)
// =============================================================================
/*
@keyframes connectionDash {
  to {
    stroke-dashoffset: -12;
  }
}

.connection-line-animated {
  animation: connectionDash 0.5s linear infinite;
}
*/

export default CustomConnectionLine;
