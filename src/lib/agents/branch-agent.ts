/**
 * Branch Agent
 * 
 * Creates multiple branched conversations from a single user prompt.
 * E.g., "Give me 3 approaches to state management" → creates 3 branch cards.
 * 
 * Tools:
 *   - createBranch: Create a new branch card with a reason and initial prompt
 * 
 * @version 1.0.0
 */

import { tool } from 'ai';
import { z } from 'zod';

import { runAgent } from './agent-runner';
import type {
  AgentRunResult,
  AgentRunnerConfig,
  WorkspaceSnapshot,
  AgentStep,
} from './types';

// =============================================================================
// SYSTEM PROMPT
// =============================================================================

const BRANCH_SYSTEM_PROMPT = `You are the Branch Agent for ProjectLoom, an AI-native thinking workspace.

Your job is to create multiple branched conversation cards based on the user's prompt. Each branch explores a different angle or approach.

RULES:
- Create between 2 and 5 branches (unless the user specifies otherwise)
- Each branch should have a clear, descriptive branchReason (this becomes the card title)
- Each branch should have a well-crafted initialPrompt that starts the conversation
- Make branches genuinely distinct — don't create near-duplicates
- The initialPrompt should be a user message that sets up the conversation direction
- Keep branchReason concise (under 50 characters)
- If a parentCardId is provided, branch from that card; otherwise branches are standalone

After creating branches, provide a brief summary of what was created.`;

// =============================================================================
// BRANCH AGENT RUNNER
// =============================================================================

export interface RunBranchAgentOptions {
  /** User's prompt describing what branches to create */
  userPrompt: string;
  /** Optional parent card to branch from */
  parentCardId?: string;
  parentTitle?: string;
  workspace: WorkspaceSnapshot;
  config: AgentRunnerConfig;
  abortSignal?: AbortSignal;
  onStep?: (step: AgentStep) => void;
}

export async function runBranchAgent(
  options: RunBranchAgentOptions
): Promise<AgentRunResult> {
  const { userPrompt, parentCardId, parentTitle, workspace, config, abortSignal, onStep } = options;

  const tools = {
    createBranch: tool({
      description: 'Create a new branched conversation card. Returns a pending action for the user to confirm.',
      parameters: z.object({
        branchReason: z.string().describe('Short title for the branch card (under 50 chars)'),
        initialPrompt: z.string().describe('The first user message in this branch conversation'),
      }),
      execute: async ({ branchReason, initialPrompt }) => {
        return {
          status: 'pending_confirmation',
          actionType: 'create_branch',
          description: `Create branch: "${branchReason}"`,
          parentCardId: parentCardId || null,
          parentTitle: parentTitle || null,
          branchReason,
          initialPrompt,
        };
      },
    }),
  };

  const contextNote = parentCardId
    ? `You are branching from the card "${parentTitle || parentCardId}". Set parentCardId to "${parentCardId}" for each branch.`
    : 'These are standalone branches (no parent card).';

  const fullPrompt = `${contextNote}

User request: ${userPrompt}

Create the appropriate branches now. Each branch should explore a distinct angle.`;

  return runAgent({
    systemPrompt: BRANCH_SYSTEM_PROMPT,
    userPrompt: fullPrompt,
    tools,
    config,
    abortSignal,
    onStep,
  });
}
