/**
 * Cleanup Agent
 * 
 * Analyzes workspace cards and suggests deletions/renames.
 * All destructive actions return pending_confirmation status —
 * nothing is auto-executed.
 * 
 * Tools:
 *   - analyzeWorkspace: Read-only scan of all cards
 *   - suggestDeletion: Propose a card for removal
 *   - suggestRename: Propose a title change
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

const CLEANUP_SYSTEM_PROMPT = `You are the Cleanup Agent for ProjectLoom, an AI-native thinking workspace.

Your job is to analyze conversations (called "cards") in the user's workspace and suggest improvements:
1. Identify cards that appear outdated, empty, or redundant
2. Suggest cards to delete (with clear reasons)
3. Suggest better titles for cards with vague or auto-generated names

RULES:
- ALWAYS call analyzeWorkspace first to see all cards
- NEVER suggest deleting cards that have many messages (>10) without strong reason
- NEVER auto-delete — always use suggestDeletion which requires user confirmation
- Provide clear, specific reasons for each suggestion
- Be conservative: it's better to miss a suggestion than to wrongly suggest deletion
- Empty cards (0 messages) are good candidates for deletion
- Cards titled "Branch from message X" should be suggested for renaming
- Consider card relationships (parents/children) before suggesting deletion

After analyzing, provide a brief summary of your findings.`;

// =============================================================================
// CLEANUP AGENT RUNNER
// =============================================================================

export interface RunCleanupAgentOptions {
  workspace: WorkspaceSnapshot;
  config: AgentRunnerConfig;
  abortSignal?: AbortSignal;
  onStep?: (step: AgentStep) => void;
}

export async function runCleanupAgent(
  options: RunCleanupAgentOptions
): Promise<AgentRunResult> {
  const { workspace, config, abortSignal, onStep } = options;

  // Create tools with workspace context baked in
  const tools = {
    analyzeWorkspace: tool({
      description: 'Get an overview of all cards in the workspace. Call this first to understand the workspace structure.',
      inputSchema: z.object({}),
      execute: async () => {
        return {
          workspaceTitle: workspace.workspaceTitle,
          totalCards: workspace.totalCards,
          totalEdges: workspace.totalEdges,
          cards: workspace.cards.map((c) => ({
            id: c.id,
            title: c.title,
            messageCount: c.messageCount,
            createdAt: c.createdAt.toISOString(),
            updatedAt: c.updatedAt.toISOString(),
            hasParents: c.parentCardIds.length > 0,
            parentCount: c.parentCardIds.length,
            isMergeNode: c.isMergeNode,
            tags: c.tags,
            firstMessage: c.firstMessage?.substring(0, 100),
            lastMessage: c.lastMessage?.substring(0, 100),
          })),
        };
      },
    }),

    suggestDeletion: tool({
      description: 'Suggest a card for deletion. This requires user confirmation — it will NOT be auto-deleted.',
      inputSchema: z.object({
        cardId: z.string().describe('The ID of the card to suggest for deletion'),
        reason: z.string().describe('Clear explanation of why this card should be deleted'),
      }),
      execute: async ({ cardId, reason }) => {
        const card = workspace.cards.find((c) => c.id === cardId);
        if (!card) {
          return { error: `Card ${cardId} not found` };
        }
        return {
          status: 'pending_confirmation',
          actionType: 'delete',
          description: `Delete "${card.title}" — ${reason}`,
          cardId,
          cardTitle: card.title,
          reason,
        };
      },
    }),

    suggestRename: tool({
      description: 'Suggest a better name for a card.',
      inputSchema: z.object({
        cardId: z.string().describe('The ID of the card to rename'),
        newTitle: z.string().describe('The suggested new title'),
        reason: z.string().describe('Why this name is better'),
      }),
      execute: async ({ cardId, newTitle, reason }) => {
        const card = workspace.cards.find((c) => c.id === cardId);
        if (!card) {
          return { error: `Card ${cardId} not found` };
        }
        return {
          status: 'pending_confirmation',
          actionType: 'rename',
          description: `Rename "${card.title}" → "${newTitle}" — ${reason}`,
          cardId,
          currentTitle: card.title,
          newTitle,
          reason,
        };
      },
    }),
  };

  const userPrompt = `Analyze this workspace and suggest improvements. The workspace "${workspace.workspaceTitle}" has ${workspace.totalCards} cards and ${workspace.totalEdges} connections.

Start by calling analyzeWorkspace to see all cards, then make your suggestions.`;

  return runAgent({
    systemPrompt: CLEANUP_SYSTEM_PROMPT,
    userPrompt,
    tools,
    config,
    abortSignal,
    onStep,
  });
}
