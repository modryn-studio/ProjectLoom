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
import { apiKeyManager } from '@/lib/api-key-manager';
import { colors } from '@/lib/design-tokens';
import { useIsMobile } from '@/hooks/useIsMobile';

// =============================================================================
// CANVAS PAGE — /canvas
// =============================================================================

export default function CanvasPage() {
  const [showAPIKeySetup, setShowAPIKeySetup] = useState(false);

  // Expose store globally for debugging
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as Window & { useCanvasStore?: typeof useCanvasStore }).useCanvasStore = useCanvasStore;
    }
  }, []);

  // Check for missing API keys on first visit to canvas
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const keysConfigured = localStorage.getItem('projectloom:keys-configured');
    const hasAnyKey = apiKeyManager.hasAnyKey();

    if (!keysConfigured && !hasAnyKey) {
      const timer = setTimeout(() => setShowAPIKeySetup(true), 500);
      return () => clearTimeout(timer);
    }
  }, []);

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
