'use client';

import { useState, useEffect } from 'react';

// =============================================================================
// MOBILE BREAKPOINT — matches CSS media query in globals.css
// =============================================================================

const MOBILE_BREAKPOINT = 1024; // px — anything below this gets mobile layout

// =============================================================================
// TOUCH DEVICE DETECTION
// =============================================================================

/** Returns true if the device has touch capability (phones, tablets, touch laptops) */
export function getIsTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

// =============================================================================
// useIsMobile — responsive breakpoint hook
// =============================================================================

/**
 * Returns true when viewport width is below MOBILE_BREAKPOINT (1024px).
 * Uses matchMedia for efficiency (no resize listener polling).
 * 
 * SSR-safe: returns false on the server, hydrates on mount.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    
    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(e.matches);
    };

    // Set initial value
    handleChange(mql);

    // Listen for changes
    mql.addEventListener('change', handleChange as (e: MediaQueryListEvent) => void);
    return () => mql.removeEventListener('change', handleChange as (e: MediaQueryListEvent) => void);
  }, []);

  return isMobile;
}

// =============================================================================
// useIsTouchDevice — stable touch detection hook
// =============================================================================

/**
 * Returns true on touch-capable devices. Evaluated once on mount.
 */
export function useIsTouchDevice(): boolean {
  const [isTouch] = useState(() => getIsTouchDevice());
  return isTouch;
}

// =============================================================================
// MOBILE_BREAKPOINT export for CSS-in-JS usage
// =============================================================================

export { MOBILE_BREAKPOINT };
