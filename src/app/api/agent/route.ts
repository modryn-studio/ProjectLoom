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
    anthropicKey?: string;
    openaiKey?: string;
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
  const reqId = Math.random().toString(36).slice(2, 7).toUpperCase();
  const reqStart = Date.now();
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`[agent] ▶ START [${reqId}] ${new Date().toISOString()}`);
  try {
    const body = (await req.json()) as AgentRequestBody;
    const { agentId, userPrompt, workspace, config, extra } = body;
    console.log(`[agent] [${reqId}] Request:`, {
      agentId,
      model: config?.modelId,
      cardCount: workspace?.cards?.length ?? 0,
      userPrompt: userPrompt?.substring(0, 100),
      extraKeys: extra ? Object.keys(extra) : [],
    });

    // Validate required fields
    if (!agentId || !['cleanup', 'branch', 'summarize'].includes(agentId)) {
      return errorResponse('Invalid agent ID. Must be cleanup, branch, or summarize.', 'INVALID_AGENT', 400);
    }

    if (!config?.anthropicKey && !config?.openaiKey) {
      return errorResponse('At least one API key is required.', 'MISSING_API_KEY', 401);
    }

    if (!workspace) {
      return errorResponse('Workspace snapshot is required.', 'MISSING_WORKSPACE', 400);
    }

    // Build full config with defaults
    const fullConfig: AgentRunnerConfig = {
      maxSteps: config.maxSteps ?? 10,
      timeoutMs: config.timeoutMs ?? 60_000,
      maxCostUsd: config.maxCostUsd ?? 0.50,
      modelId: config.modelId || 'anthropic/claude-sonnet-4-6',
      keys: { anthropic: config.anthropicKey, openai: config.openaiKey },
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

    console.log(`[agent] [${reqId}] ✅ Done in ${Date.now() - reqStart}ms`, {
      status: result.status,
      actionCount: result.actions?.length ?? 0,
      error: result.error,
    });
    return Response.json(result);
  } catch (error) {
    console.error(`[agent] [${reqId}] ❌ Error after ${Date.now() - reqStart}ms:`, error);
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
