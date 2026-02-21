'use client';

import { useEffect, useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { InfiniteCanvas } from '@/components/InfiniteCanvas';
import { ToastContainer } from '@/components/ToastContainer';
import { HierarchicalMergeDialog } from '@/components/HierarchicalMergeDialog';
import { KeyboardShortcutsPanelProvider } from '@/components/KeyboardShortcutsPanel';
import { APIKeySetupModal } from '@/components/APIKeySetupModal';
import { MobileLayout } from '@/components/MobileLayout';
import { MobileTabContent } from '@/components/MobileTabContent';
import { useCanvasStore } from '@/stores/canvas-store';
import { colors } from '@/lib/design-tokens';
import { useIsMobile } from '@/hooks/useIsMobile';

// =============================================================================
// CANVAS PAGE — /canvas
// =============================================================================

export default function CanvasPage() {
  const [showAPIKeySetup, setShowAPIKeySetup] = useState(false);
  const [showDemoBanner, setShowDemoBanner] = useState(false);

  // Expose store globally for debugging
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as Window & { useCanvasStore?: typeof useCanvasStore }).useCanvasStore = useCanvasStore;
    }
  }, []);

  // Show demo banner on first-ever canvas visit (same condition as mock data load)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const seen = localStorage.getItem('projectloom:demo-seen');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!seen) setShowDemoBanner(true);
  }, []);

  // Listen for API key setup requests from deep in the component tree
  useEffect(() => {
    const handler = () => setShowAPIKeySetup(true);
    window.addEventListener('projectloom:requestAPIKeySetup', handler);
    return () => window.removeEventListener('projectloom:requestAPIKeySetup', handler);
  }, []);

  const handleDismissBanner = () => {
    setShowDemoBanner(false);
    localStorage.setItem('projectloom:demo-seen', '1');
  };

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
        onClose={() => setShowAPIKeySetup(false)}
        onSuccess={() => setShowAPIKeySetup(false)}
      />
      {showDemoBanner && <DemoBanner onDismiss={handleDismissBanner} />}
    </ErrorBoundary>
  );
}

// =============================================================================
// CANVAS WRAPPER
// =============================================================================

/**
 * Handles store initialization and provides full-viewport layout.
 * On mobile renders MobileLayout; on desktop renders InfiniteCanvas.
 */
function CanvasWrapper() {
  const initializeFromStorage = useCanvasStore((s) => s.initializeFromStorage);
  const isInitialized = useCanvasStore((s) => s.isInitialized);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!isInitialized) {
      initializeFromStorage();
    }
  }, [initializeFromStorage, isInitialized]);

  if (!isInitialized) {
    return (
      <main style={styles.main}>
        <LoadingState />
      </main>
    );
  }

  if (isMobile) {
    return (
      <MobileLayout canvasElement={<InfiniteCanvas isMobile />}>
        <MobileTabContent />
      </MobileLayout>
    );
  }

  return (
    <main style={styles.main}>
      <InfiniteCanvas />
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
// DEMO BANNER
// =============================================================================

function DemoBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div style={styles.demoBanner}>
      <span style={styles.demoBannerText}>
        This is a demo workspace. Explore how branching works, then add an API key to start your own conversation.
      </span>
      <div style={styles.demoBannerActions}>
        <button
          onClick={() => window.dispatchEvent(new Event('projectloom:requestAPIKeySetup'))}
          style={styles.demoBannerCTA}
        >
          Add API key
        </button>
        <button onClick={onDismiss} style={styles.demoBannerDismiss} aria-label="Dismiss">
          ×
        </button>
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

  demoBanner: {
    position: 'fixed',
    bottom: 24,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 290,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.bg.secondary,
    border: `1px solid ${colors.border.default}`,
    borderRadius: 10,
    padding: '10px 16px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
    maxWidth: 600,
    width: 'calc(100vw - 48px)',
  },

  demoBannerText: {
    fontSize: 13,
    color: colors.fg.secondary,
    flex: 1,
    lineHeight: 1.4,
  },

  demoBannerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },

  demoBannerCTA: {
    fontSize: 12,
    fontWeight: 600,
    color: colors.accent.primary,
    background: 'none',
    border: `1px solid ${colors.accent.primary}`,
    borderRadius: 6,
    padding: '4px 10px',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  },

  demoBannerDismiss: {
    fontSize: 16,
    lineHeight: 1,
    color: colors.fg.tertiary,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '2px 4px',
  },
};
