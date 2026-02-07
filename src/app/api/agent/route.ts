/**
 * Agent API Route
 * 
 * Runs agent workflows server-side using Vercel AI SDK generateText.
 * Accepts agent type, user prompt, workspace snapshot, and config.
 * Returns AgentRunResult with proposed actions.
 * 
 * @version 1.0.0
 */

import { runCleanupAgent } from '@/lib/agents/cleanup-agent';
import { runBranchAgent } from '@/lib/agents/branch-agent';
import { runSummarizeAgent, type CardContent } from '@/lib/agents/summarize-agent';
import type {
  AgentId,
  AgentRunnerConfig,
  AgentRunResult,
  WorkspaceSnapshot,
  DEFAULT_AGENT_CONFIG,
} from '@/lib/agents/types';

// =============================================================================
// REQUEST TYPES
// =============================================================================

interface AgentRequestBody {
  agentId: AgentId;
  userPrompt: string;
  workspace: WorkspaceSnapshot;
  config: {
    modelId: string;
    apiKey: string;
    maxSteps?: number;
    timeoutMs?: number;
    maxCostUsd?: number;
  };
  /** Extra data depending on agent type */
  extra?: {
    parentCardId?: string;
    parentTitle?: string;
    cardIds?: string[];
    cardContents?: Array<{ id: string; title: string; messages: Array<{ role: string; content: string }> }>;
  };
}

// =============================================================================
// ERROR HELPERS
// =============================================================================

function errorResponse(message: string, code: string, status: number) {
  return Response.json({ error: message, code }, { status });
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

export async function POST(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as AgentRequestBody;
    const { agentId, userPrompt, workspace, config, extra } = body;

    // Validate required fields
    if (!agentId || !['cleanup', 'branch', 'summarize'].includes(agentId)) {
      return errorResponse('Invalid agent ID. Must be cleanup, branch, or summarize.', 'INVALID_AGENT', 400);
    }

    if (!config?.apiKey) {
      return errorResponse('API key is required.', 'MISSING_API_KEY', 401);
    }

    if (!workspace) {
      return errorResponse('Workspace snapshot is required.', 'MISSING_WORKSPACE', 400);
    }

    // Build full config with defaults
    const fullConfig: AgentRunnerConfig = {
      maxSteps: config.maxSteps ?? 10,
      timeoutMs: config.timeoutMs ?? 60_000,
      maxCostUsd: config.maxCostUsd ?? 0.50,
      modelId: config.modelId || 'claude-sonnet-4-20250514',
      apiKey: config.apiKey,
    };

    // Reconstruct Date objects from serialized workspace
    const hydratedWorkspace: WorkspaceSnapshot = {
      ...workspace,
      cards: workspace.cards.map((c) => ({
        ...c,
        createdAt: new Date(c.createdAt),
        updatedAt: new Date(c.updatedAt),
      })),
    };

    let result: AgentRunResult;

    switch (agentId) {
      case 'cleanup':
        result = await runCleanupAgent({
          workspace: hydratedWorkspace,
          config: fullConfig,
        });
        break;

      case 'branch':
        result = await runBranchAgent({
          userPrompt: userPrompt || 'Create useful branches for this workspace',
          parentCardId: extra?.parentCardId,
          parentTitle: extra?.parentTitle,
          workspace: hydratedWorkspace,
          config: fullConfig,
        });
        break;

      case 'summarize': {
        // Build card contents map
        const cardContents = new Map<string, CardContent>();
        if (extra?.cardContents) {
          for (const card of extra.cardContents) {
            cardContents.set(card.id, card);
          }
        }

        result = await runSummarizeAgent({
          cardIds: extra?.cardIds,
          cardContents,
          workspace: hydratedWorkspace,
          config: fullConfig,
        });
        break;
      }

      default:
        return errorResponse(`Unknown agent: ${agentId}`, 'UNKNOWN_AGENT', 400);
    }

    return Response.json(result);
  } catch (error) {
    console.error('[Agent API Error]', error);
    const err = error as Error;
    return errorResponse(
      err.message || 'Agent execution failed.',
      'AGENT_ERROR',
      500
    );
  }
}

// =============================================================================
// OPTIONS HANDLER (CORS)
// =============================================================================

export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
