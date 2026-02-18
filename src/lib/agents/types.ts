/**
 * Agent Types
 * 
 * Type definitions for the agent workflow system.
 * Agents use Vercel AI SDK's generateText + tools pattern
 * with shared guardrails (max steps, timeout, cost budget).
 * 
 * @version 1.0.0
 */

// =============================================================================
// AGENT IDENTIFICATION
// =============================================================================

export type AgentId = 'cleanup' | 'branch' | 'summarize';

export interface AgentInfo {
  id: AgentId;
  name: string;
  description: string;
  icon: string; // Lucide icon name
  destructive: boolean; // Whether agent can make destructive changes
}

export const AGENT_REGISTRY: Record<AgentId, AgentInfo> = {
  cleanup: {
    id: 'cleanup',
    name: 'Cleanup Agent',
    description: 'Analyze workspace and suggest cards to delete or rename',
    icon: 'Trash2',
    destructive: true,
  },
  branch: {
    id: 'branch',
    name: 'Branch Agent',
    description: 'Create multiple branched conversations from a single prompt',
    icon: 'GitBranch',
    destructive: false,
  },
  summarize: {
    id: 'summarize',
    name: 'Summarize Agent',
    description: 'Read cards and export a combined markdown summary document',
    icon: 'FileText',
    destructive: false,
  },
};

// =============================================================================
// AGENT ACTIONS (PENDING CONFIRMATION)
// =============================================================================

export interface AgentAction {
  id: string;
  type: 'delete' | 'rename' | 'create_branch' | 'create_document';
  description: string;
  /** Whether user has approved this action */
  approved: boolean;
  /** Additional data for execution */
  data: Record<string, unknown>;
}

export interface DeleteAction extends AgentAction {
  type: 'delete';
  data: {
    cardId: string;
    cardTitle: string;
    reason: string;
  };
}

export interface RenameAction extends AgentAction {
  type: 'rename';
  data: {
    cardId: string;
    currentTitle: string;
    newTitle: string;
    reason: string;
  };
}

export interface CreateBranchAction extends AgentAction {
  type: 'create_branch';
  data: {
    parentCardId: string;
    parentTitle: string;
    branchReason: string;
    initialPrompt: string;
  };
}

export interface CreateDocumentAction extends AgentAction {
  type: 'create_document';
  data: {
    title: string;
    markdown: string;
  };
}

// =============================================================================
// AGENT EXECUTION STATE
// =============================================================================

export type AgentStatus = 
  | 'idle'
  | 'running'
  | 'awaiting_confirmation'
  | 'executing_actions'
  | 'completed'
  | 'error'
  | 'cancelled';

export interface AgentStep {
  index: number;
  toolName: string;
  args: Record<string, unknown>;
  result: unknown;
  timestamp: Date;
}

export interface AgentRunResult {
  status: 'success' | 'error' | 'cancelled' | 'timeout';
  /** Proposed actions requiring user confirmation */
  actions: AgentAction[];
  /** Steps the agent took */
  steps: AgentStep[];
  /** Summary text from the agent */
  summary: string;
  /** Total tokens used */
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** Error message if status is 'error' */
  error?: string;
}

// =============================================================================
// AGENT RUNNER CONFIG
// =============================================================================

export interface AgentRunnerConfig {
  /** Maximum number of tool-calling steps (default: 10) */
  maxSteps: number;
  /** Timeout in milliseconds (default: 60000 = 60s) */
  timeoutMs: number;
  /** Maximum cost budget in USD (default: 0.50) */
  maxCostUsd: number;
  /** Model ID to use */
  modelId: string;
  /** API key */
  apiKey: string;
}

export const DEFAULT_AGENT_CONFIG: AgentRunnerConfig = {
  maxSteps: 10,
  timeoutMs: 60_000,
  maxCostUsd: 0.50,
  modelId: 'anthropic/claude-sonnet-4-5',
  apiKey: '',
};

// =============================================================================
// WORKSPACE SNAPSHOT (read-only data for agents)
// =============================================================================

export interface CardSnapshot {
  id: string;
  title: string;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
  parentCardIds: string[];
  isMergeNode: boolean;
  tags: string[];
  /** First and last message preview */
  firstMessage?: string;
  lastMessage?: string;
}

export interface WorkspaceSnapshot {
  workspaceId: string;
  workspaceTitle: string;
  cards: CardSnapshot[];
  totalCards: number;
  totalEdges: number;
}
