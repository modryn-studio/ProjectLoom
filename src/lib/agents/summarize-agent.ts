/**
 * Summarize Agent
 * 
 * Reads multiple cards and produces a combined markdown summary document.
 * The document captures key decisions, findings, and open items across cards.
 * 
 * Tools:
 *   - readCard: Read conversation content from a specific card
 *   - createMarkdownDoc: Generate a structured markdown document
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
// TYPES
// =============================================================================

export interface CardContent {
  id: string;
  title: string;
  messages: Array<{
    role: string;
    content: string;
  }>;
}

// =============================================================================
// SYSTEM PROMPT
// =============================================================================

const SUMMARIZE_SYSTEM_PROMPT = `You are the Summarize Agent for ProjectLoom, an AI-native thinking workspace.

Your job is to read conversation cards and create a structured markdown summary document that captures the essence of the workspace.

RULES:
- Start by reading the cards you want to summarize (use readCard for each)
- After reading, create a single markdown document with createMarkdownDoc
- Organize the document logically with clear sections
- Preserve key decisions, conclusions, and open questions from each card
- Include the card titles as section references
- Be concise but thorough — aim for a document that someone could read to understand the workspace without reading every card
- If cards are related (parent/child), note the relationships
- Don't just copy messages verbatim — synthesize and organize the content
- Keep the total document under 2000 words

The document structure should include:
1. Executive Summary (2-3 sentences)
2. Key Decisions & Conclusions
3. Open Questions & Next Steps
4. Per-card summaries (brief)`;

// =============================================================================
// SUMMARIZE AGENT RUNNER
// =============================================================================

export interface RunSummarizeAgentOptions {
  /** Which card IDs to summarize (empty = all cards) */
  cardIds?: string[];
  /** Full conversation content for each card (keyed by card ID) */
  cardContents: Map<string, CardContent>;
  workspace: WorkspaceSnapshot;
  config: AgentRunnerConfig;
  abortSignal?: AbortSignal;
  onStep?: (step: AgentStep) => void;
}

export async function runSummarizeAgent(
  options: RunSummarizeAgentOptions
): Promise<AgentRunResult> {
  const { cardIds, cardContents, workspace, config, abortSignal, onStep } = options;

  const targetCardIds = cardIds || workspace.cards.map((c) => c.id);

  const tools = {
    readCard: tool({
      description: 'Read the conversation content of a specific card. Returns the card title and all messages.',
      parameters: z.object({
        cardId: z.string().describe('The ID of the card to read'),
      }),
      execute: async ({ cardId }) => {
        const content = cardContents.get(cardId);
        if (!content) {
          return { error: `Card ${cardId} not found or has no content` };
        }
        return {
          cardId: content.id,
          title: content.title,
          messageCount: content.messages.length,
          messages: content.messages.slice(0, 50).map((m) => ({
            role: m.role,
            content: m.content.substring(0, 500),
          })),
        };
      },
    }),

    createMarkdownDoc: tool({
      description: 'Create a markdown summary document from the analyzed cards.',
      parameters: z.object({
        title: z.string().describe('Document title'),
        sections: z.array(
          z.object({
            heading: z.string().describe('Section heading'),
            content: z.string().describe('Section content in markdown'),
          })
        ).describe('Document sections'),
      }),
      execute: async ({ title, sections }) => {
        const markdown = `# ${title}\n\n${sections
          .map((s) => `## ${s.heading}\n\n${s.content}`)
          .join('\n\n---\n\n')}`;

        return {
          status: 'pending_confirmation',
          actionType: 'create_document',
          description: `Create summary document: "${title}" (${sections.length} sections)`,
          title,
          markdown,
          wordCount: markdown.split(/\s+/).length,
        };
      },
    }),
  };

  const cardList = targetCardIds
    .map((id) => {
      const card = workspace.cards.find((c) => c.id === id);
      return card ? `- "${card.title}" (${card.messageCount} messages, ID: ${id})` : null;
    })
    .filter(Boolean)
    .join('\n');

  const userPrompt = `Summarize the following cards from workspace "${workspace.workspaceTitle}":

${cardList}

Read each card's content, then create a single comprehensive markdown summary document.`;

  return runAgent({
    systemPrompt: SUMMARIZE_SYSTEM_PROMPT,
    userPrompt,
    tools,
    config,
    abortSignal,
    onStep,
  });
}
