'use client';

import { useEffect, useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { InfiniteCanvas } from '@/components/InfiniteCanvas';
import { ToastContainer } from '@/components/ToastContainer';
import { HierarchicalMergeDialog } from '@/components/HierarchicalMergeDialog';
import { KeyboardShortcutsPanelProvider } from '@/components/KeyboardShortcutsPanel';
import { APIKeySetupModal } from '@/components/APIKeySetupModal';
import { LandingPage } from '@/components/landing/LandingPage';
import { useCanvasStore } from '@/stores/canvas-store';
import { apiKeyManager } from '@/lib/api-key-manager';
import { colors } from '@/lib/design-tokens';

// =============================================================================
// STORAGE KEY
// =============================================================================

const VISITED_KEY = 'loom_visited';

// =============================================================================
// MAIN PAGE COMPONENT
// =============================================================================

export default function CanvasPage() {
  // Lazy initializer reads localStorage once on first render (client only)
  const [showLanding, setShowLanding] = useState<boolean | null>(() => {
    if (typeof window === 'undefined') return null;
    return !localStorage.getItem(VISITED_KEY);
  });
  const [showAPIKeySetup, setShowAPIKeySetup] = useState(false);

  // Expose store globally for debugging
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as Window & { useCanvasStore?: typeof useCanvasStore }).useCanvasStore = useCanvasStore;
    }
  }, []);

  // Check for first launch or missing API keys (only when canvas is shown)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (showLanding) return; // Don't show API key modal on landing page

    const keysConfigured = localStorage.getItem('projectloom:keys-configured');
    const hasAnyKey = apiKeyManager.hasAnyKey();

    if (!keysConfigured && !hasAnyKey) {
      const timer = setTimeout(() => setShowAPIKeySetup(true), 500);
      return () => clearTimeout(timer);
    }
  }, [showLanding]);

  const handleEnterCanvas = () => {
    localStorage.setItem(VISITED_KEY, '1');
    setShowLanding(false);
  };

  const handleAPIKeySetupClose = () => {
    setShowAPIKeySetup(false);
  };

  const handleAPIKeySetupSuccess = () => {
    setShowAPIKeySetup(false);
    // Keys are marked as configured in the modal's save handler
  };

  // Still checking localStorage — avoid flash
  if (showLanding === null) {
    return (
      <div style={styles.loading}>
        <div style={styles.loadingContent}>
          <div style={styles.spinner} />
        </div>
      </div>
    );
  }

  // First-time visitor: show landing page
  if (showLanding) {
    return <LandingPage onEnter={handleEnterCanvas} />;
  }

  // Returning visitor: show the canvas
  return (
    <ErrorBoundary>
      <ReactFlowProvider>
        <CanvasWrapper />
      </ReactFlowProvider>
      <ToastContainer />
      <HierarchicalMergeDialog />
      <KeyboardShortcutsPanelProvider />
      <APIKeySetupModal 
        isOpen={showAPIKeySetup}
        onClose={handleAPIKeySetupClose}
        onSuccess={handleAPIKeySetupSuccess}
      />
    </ErrorBoundary>
  );
}

// =============================================================================
// CANVAS WRAPPER
// =============================================================================

/**
 * Canvas wrapper handles initialization and provides full viewport layout
 */
function CanvasWrapper() {
  const initializeFromStorage = useCanvasStore((s) => s.initializeFromStorage);
  const isInitialized = useCanvasStore((s) => s.isInitialized);

  // Initialize on mount
  useEffect(() => {
    if (!isInitialized) {
      initializeFromStorage();
    }
  }, [initializeFromStorage, isInitialized]);

  return (
    <main style={styles.main}>
      {!isInitialized ? (
        <LoadingState />
      ) : (
        <InfiniteCanvas />
      )}
    </main>
  );
}

// =============================================================================
// LOADING STATE
// =============================================================================

function LoadingState() {
  return (
    <div style={styles.loading}>
      <div style={styles.loadingContent}>
        <div style={styles.spinner} />
        <p style={styles.loadingText}>Loading ProjectLoom...</p>
      </div>
    </div>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles: Record<string, React.CSSProperties> = {
  main: {
    width: '100vw',
    height: '100vh',
    backgroundColor: colors.bg.primary,
    overflow: 'hidden',
    position: 'relative',
  },

  loading: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg.primary,
  },

  loadingContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
  },

  spinner: {
    width: '40px',
    height: '40px',
    border: `3px solid ${colors.accent.muted}`,
    borderTopColor: colors.accent.primary,
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },

  loadingText: {
    fontSize: '14px',
    color: colors.fg.secondary,
    margin: 0,
  },
};
