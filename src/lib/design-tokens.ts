/**
 * ProjectLoom Design Tokens
 * 
 * Complete design system using CSS custom properties for theme-aware colors.
 * Colors reference CSS variables defined in globals.css, enabling light/dark
 * theme switching without component changes.
 * 
 * Typography, spacing, and animation remain as static values.
 * 
 * @version 2.0.0 - Neutral theme system (Zinc-based, professional, easy on eyes)
 */

// =============================================================================
// COLOR PALETTE - CSS Variable References (theme-aware)
// =============================================================================

export const colors = {
  // Background colors (maps to CSS --bg-* variables)
  bg: {
    primary: 'var(--bg-primary)',
    secondary: 'var(--bg-secondary)',
    tertiary: 'var(--bg-tertiary)',
    inset: 'var(--bg-inset)',
    overlay: 'var(--bg-overlay)',
  },
  
  // Foreground/text colors (maps to CSS --fg-* variables)
  fg: {
    primary: 'var(--fg-primary)',
    secondary: 'var(--fg-secondary)',
    tertiary: 'var(--fg-tertiary)',
    quaternary: 'var(--fg-quaternary)',
  },
  
  // Border colors (maps to CSS --border-* variables)
  border: {
    default: 'var(--border-default)',
    muted: 'var(--border-muted)',
    strong: 'var(--border-strong)',
  },
  
  // Accent color (subtle blue for interactions)
  accent: {
    primary: 'var(--accent-primary)',
    secondary: 'var(--accent-secondary)',
    muted: 'var(--accent-muted)',
    emphasis: 'var(--accent-emphasis)',
  },
  
  // Semantic colors
  semantic: {
    success: 'var(--success-solid)',
    successBg: 'var(--success-bg)',
    successFg: 'var(--success-fg)',
    successBorder: 'var(--success-border)',
    
    warning: 'var(--warning-solid)',
    warningBg: 'var(--warning-bg)',
    warningFg: 'var(--warning-fg)',
    warningBorder: 'var(--warning-border)',
    
    error: 'var(--error-solid)',
    errorBg: 'var(--error-bg)',
    errorFg: 'var(--error-fg)',
    errorBorder: 'var(--error-border)',
    
    info: 'var(--info-solid)',
    infoBg: 'var(--info-bg)',
    infoFg: 'var(--info-fg)',
    infoBorder: 'var(--info-border)',
  },
  
  // Focus and selection
  focus: {
    ring: 'var(--focus-ring)',
    selection: 'var(--selection-bg)',
  },
  
} as const;

// =============================================================================
// TYPOGRAPHY
// =============================================================================

export const typography = {
  // Font families
  fonts: {
    heading: '"Inter", "Geist", system-ui, -apple-system, sans-serif',
    body: '"SF Pro", "Inter", system-ui, -apple-system, sans-serif',
    code: '"JetBrains Mono", "Fira Code", "Consolas", monospace',
    
    // Language-specific font stacks (used by language-utils.ts)
    japanese: '"Noto Sans JP", "Hiragino Sans", "Yu Gothic", sans-serif',
    chinese: '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif',
    korean: '"Noto Sans KR", "Malgun Gothic", sans-serif',
    arabic: '"Noto Sans Arabic", "Tahoma", "Arial", sans-serif',
    hebrew: '"Noto Sans Hebrew", "Arial Hebrew", sans-serif',
    thai: '"Noto Sans Thai", "Tahoma", sans-serif',
    devanagari: '"Noto Sans Devanagari", sans-serif',
  },
  
  // Font sizes (rem)
  sizes: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '1rem',     // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem', // 36px
  },
  
  // Font weights
  weights: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  
  // Line heights
  lineHeights: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75,
  },
} as const;

// =============================================================================
// SPACING
// =============================================================================

export const spacing = {
  // Base spacing scale (px)
  0: '0',
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
  10: '40px',
  12: '48px',
  16: '64px',
  20: '80px',
  24: '96px',
  
  // Semantic spacing
  card: {
    padding: '16px',
    gap: '12px',
    borderRadius: '12px',
  },
  canvas: {
    gridSize: 20,
    nodeGap: 280,  // Minimum gap between nodes in layout
    jitter: 20,    // Random offset for organic feel (±20px)
  },
} as const;

// =============================================================================
// LAYOUT
// =============================================================================

export const layout = {
  sidebar: {
    width: 260,
  },
};

// =============================================================================
// ANIMATION
// =============================================================================

export const animation = {
  // Timing functions
  easing: {
    // Standard easing
    ease: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
    easeIn: 'cubic-bezier(0.42, 0, 1, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.58, 1)',
    easeInOut: 'cubic-bezier(0.42, 0, 0.58, 1)',
    
    // Spring-like easing for UI elements
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    springSmooth: 'cubic-bezier(0.22, 1, 0.36, 1)',
    
    // For canvas interactions
    smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
  
  // Durations (ms)
  duration: {
    instant: 0,
    fast: 150,
    normal: 250,
    slow: 400,
    slower: 600,
    
    // Specific animations
    hover: 200,
    expand: 300,
    collapse: 250,
    fade: 200,
    slide: 300,
  },
  
  // Framer Motion spring configs
  spring: {
    // Default spring for most animations
    default: {
      type: 'spring' as const,
      stiffness: 400,
      damping: 30,
    },
    
    // Bouncy spring for hover effects
    bouncy: {
      type: 'spring' as const,
      stiffness: 500,
      damping: 25,
    },
    
    // Gentle spring for layout animations
    gentle: {
      type: 'spring' as const,
      stiffness: 300,
      damping: 35,
    },

    // Panel spring for sidebars/panels
    panel: {
      type: 'spring' as const,
      stiffness: 520,
      damping: 38,
    },
    
    // Snappy spring for quick feedback
    snappy: {
      type: 'spring' as const,
      stiffness: 600,
      damping: 40,
    },
  },
} as const;

// =============================================================================
// EFFECTS (Phase 2 advanced, Phase 1 core)
// =============================================================================

export const effects = {
  // Shadows
  shadow: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    default: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
    
    // Card-specific shadows
    card: '0 4px 12px rgba(0, 0, 0, 0.15)',
    cardHover: '0 8px 24px rgba(0, 0, 0, 0.2)',
    cardExpanded: '0 16px 48px rgba(0, 0, 0, 0.25)',
  },
  
  // Glow effects - uses accent color from CSS variables
  glow: {
    // Core glows using new accent system
    accent: '0 0 20px var(--accent-muted)',
    accentStrong: '0 0 12px var(--accent-primary)',
    
    // Card glows
    cardActive: '0 0 0 2px var(--accent-primary), 0 0 20px var(--accent-muted)',
    cardHover: '0 0 0 1px var(--border-strong)',
    
    // Semantic glows
    success: '0 0 12px var(--success-border)',
    warning: '0 0 12px var(--warning-border)',
    error: '0 0 12px var(--error-border)',
    
  },
  
  // Blur effects (Phase 2)
  blur: {
    sm: '4px',
    default: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
    
    // Depth of field for distant nodes (Phase 2)
    depthOfField: {
      near: '0px',
      mid: '2px',
      far: '4px',
    },
  },
  
  // Particle effects config (Phase 2) - using CSS variables
  particles: {
    contextFlow: {
      count: 5,
      speed: 2,
      size: 3,
      color: 'var(--accent-primary)',
      trail: true,
    },
    drag: {
      count: 3,
      speed: 1,
      size: 2,
      color: 'var(--accent-secondary)',
      trail: false,
    },
  },
  
  // Border styles
  border: {
    width: {
      thin: '1px',
      default: '2px',
      thick: '3px',
    },
    radius: {
      sm: '4px',
      default: '8px',
      md: '12px',
      lg: '16px',
      xl: '24px',
      full: '9999px',
    },
  },
} as const;

// =============================================================================
// CANVAS SPECIFIC
// =============================================================================

export const canvas = {
  // Background
  background: {
    color: 'var(--bg-primary)',
    dotColor: 'var(--border-default)',
    dotSize: 1.5,
    dotGap: 20,
  },
  
  // Minimap
  minimap: {
    width: 150,
    height: 100,
    backgroundColor: 'var(--bg-secondary)',
    nodeColor: 'var(--accent-muted)',
    maskColor: 'var(--bg-overlay)',
  },
  
  // Viewport
  viewport: {
    minZoom: 0.1,
    maxZoom: 2,
    defaultZoom: 1,
    fitViewPadding: 0.2,  // 20% padding
  },
  
  // Connection lines
  connectionLine: {
    type: 'bezier' as const,
    stroke: 'var(--accent-primary)',
    strokeWidth: 2,
    animated: false,
  },
  
  // Edge styling
  edge: {
    stroke: 'var(--accent-primary)',
    strokeWidth: 2,
    strokeHover: 'var(--accent-secondary)',
    strokeActive: 'var(--accent-emphasis)',
    curvature: 0.25,
  },
} as const;

// =============================================================================
// CARD SPECIFIC
// =============================================================================

export const card = {
  // Dimensions
  size: {
    minWidth: 280,
    maxWidth: 400,
    collapsedHeight: 160,      // Increased for title + preview + timestamp
    expandedMinHeight: 300,
    expandedMaxHeight: 600,
  },
  
  // Preview
  preview: {
    maxLines: 3,
    maxChars: 150,
  },
  
  // Badge styling
  badge: {
    height: '20px',
    fontSize: typography.sizes.xs,
    padding: '0 8px',
    borderRadius: effects.border.radius.full,
    backgroundColor: 'var(--accent-muted)',
    color: 'var(--fg-primary)',
  },
  
  // Hover animation values
  hover: {
    lift: -4,  // pixels to lift on hover
    scale: 1.02,
  },
} as const;

// =============================================================================
// BREAKPOINTS (for future responsive design)
// =============================================================================

export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

// =============================================================================
// EXPORTS
// =============================================================================

export const tokens = {
  colors,
  typography,
  spacing,
  animation,
  effects,
  canvas,
  card,
  breakpoints,
} as const;

export default tokens;
