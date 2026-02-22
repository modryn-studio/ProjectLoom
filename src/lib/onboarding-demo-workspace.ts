import { useCanvasStore } from '@/stores/canvas-store';
import { useOnboardingStore } from '@/stores/onboarding-store';

const ONBOARDING_DEMO_WORKSPACE_TITLE = 'Demo (Onboarding)';
const ONBOARDING_DEMO_WORKSPACE_TAG = 'onboarding-demo';

function isOnboardingDemoWorkspace(workspace: { tags?: string[] }): boolean {
  return workspace.tags?.includes(ONBOARDING_DEMO_WORKSPACE_TAG) ?? false;
}

export function launchOnboardingInDemoWorkspace(): void {
  const canvas = useCanvasStore.getState();

  const demoWorkspaceIds = canvas
    .getWorkspaces()
    .filter(isOnboardingDemoWorkspace)
    .map((workspace) => workspace.id);

  demoWorkspaceIds.forEach((workspaceId) => {
    canvas.deleteWorkspace(workspaceId);
  });

  const demoWorkspace = canvas.createWorkspace(ONBOARDING_DEMO_WORKSPACE_TITLE);
  canvas.updateWorkspace(demoWorkspace.id, {
    tags: [...demoWorkspace.tags, ONBOARDING_DEMO_WORKSPACE_TAG],
  });
  canvas.navigateToWorkspace(demoWorkspace.id);

  useOnboardingStore.getState().startOnboarding();
}
