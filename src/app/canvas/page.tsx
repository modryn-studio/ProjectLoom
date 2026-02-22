'use client';

import { useEffect, useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { InfiniteCanvas } from '@/components/InfiniteCanvas';
import { ToastContainer } from '@/components/ToastContainer';
import { HierarchicalMergeDialog } from '@/components/HierarchicalMergeDialog';
import { KeyboardShortcutsPanelProvider } from '@/components/KeyboardShortcutsPanel';
import { APIKeySetupModal } from '@/components/APIKeySetupModal';
import { OnboardingGuide } from '@/components/OnboardingGuide';
import { WorkspaceNameModal } from '@/components/WorkspaceNameModal';
import { MobileLayout } from '@/components/MobileLayout';
import { MobileTabContent } from '@/components/MobileTabContent';
import { useCanvasStore } from '@/stores/canvas-store';
import { hasSeenOnboarding } from '@/stores/onboarding-store';
import { colors } from '@/lib/design-tokens';
import { launchOnboardingInDemoWorkspace } from '@/lib/onboarding-demo-workspace';
import { useIsMobile } from '@/hooks/useIsMobile';
import { clearKnowledgeBaseStorage } from '@/lib/knowledge-base-db';
import { STORAGE_KEYS } from '@/lib/storage';

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

  // Handle reset URL params (for testing)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('onboarding') === 'reset') {
      const firstTime = params.get('firstTime') === '1';

      if (firstTime) {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i += 1) {
          const key = localStorage.key(i);
          if (key?.startsWith('projectloom:')) {
            keysToRemove.push(key);
          }
        }
        // Usage is stored under a non-colon key (`projectloom-usage`), so
        // clear it explicitly for true first-time resets.
        keysToRemove.push(STORAGE_KEYS.USAGE);
        keysToRemove.forEach((key) => localStorage.removeItem(key));
        void clearKnowledgeBaseStorage().catch(() => {
          // Best-effort in dev reset flow
        }).finally(() => {
          location.href = window.location.pathname;
        });
        return;
      }

      localStorage.removeItem('projectloom:onboarding-seen');
      localStorage.removeItem('projectloom:onboarding-v2');
      localStorage.removeItem('projectloom:canvas-data');
      localStorage.removeItem('projectloom:workspaces');
      localStorage.removeItem(STORAGE_KEYS.USAGE);
      location.href = window.location.pathname;
    }
  }, []);

  // Listen for API key setup requests from deep in the component tree
  useEffect(() => {
    const handler = () => setShowAPIKeySetup(true);
    window.addEventListener('projectloom:requestAPIKeySetup', handler);
    return () => window.removeEventListener('projectloom:requestAPIKeySetup', handler);
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
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);

  useEffect(() => {
    if (!isInitialized) {
      initializeFromStorage();
    }
  }, [initializeFromStorage, isInitialized]);

  // Start guided onboarding for first-time desktop users
  useEffect(() => {
    if (!isInitialized || isMobile) return;
    if (!hasSeenOnboarding() && useCanvasStore.getState().conversations.size === 0) {
      // Short delay so the canvas renders before the overlay appears
      const t = setTimeout(() => launchOnboardingInDemoWorkspace(), 300);
      return () => clearTimeout(t);
    }
  }, [isInitialized, isMobile]);

  const handleNewProjectConfirm = (name: string) => {
    const store = useCanvasStore.getState();
    const ws = store.createWorkspace(name);
    store.navigateToWorkspace(ws.id);
    setShowNewProjectModal(false);
  };

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
      <OnboardingGuide />
      <WorkspaceNameModal
        isOpen={showNewProjectModal}
        suggestedName="My Project"
        onConfirm={handleNewProjectConfirm}
        onClose={() => setShowNewProjectModal(false)}
      />
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
