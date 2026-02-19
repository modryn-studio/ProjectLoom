/**
 * Agent Runner
 * 
 * Shared execution engine for all agents. Provides guardrails:
 * - Max steps limit (prevents infinite tool loops)
 * - Timeout (60s default)
 * - Cost budget tracking
 * - Loop detection (repeated identical tool calls)
 * - Abort controller for cancellation
 * 
 * Uses Vercel AI SDK's generateText with tools + maxSteps.
 * 
 * @version 1.0.0
 */

import { generateText, type ToolSet, stepCountIs } from 'ai';
import type { LanguageModel } from 'ai';
import { createModel as createProviderModel } from '@/lib/provider-factory';
import type { ProviderKeys } from '@/lib/provider-factory';
import { nanoid } from 'nanoid';

import { estimateCost, detectProvider } from '@/lib/vercel-ai-integration';
import { getModelConfig } from '@/lib/model-configs';
import type {
  AgentRunnerConfig,
  AgentRunResult,
  AgentAction,
  AgentStep,
} from './types';

// =============================================================================
// PROVIDER FACTORY
// =============================================================================

/**
 * Create a model instance via the provider factory.
 * Agents don't use web search tools — they define their own tool set.
 */
function createAgentModel(modelId: string, keys: ProviderKeys): LanguageModel {
  return createProviderModel(modelId, keys);
}

// =============================================================================
// LOOP DETECTION
// =============================================================================

interface ToolCallRecord {
  toolName: string;
  argsHash: string;
}

function hashArgs(args: Record<string, unknown>): string {
  try {
    return JSON.stringify(args);
  } catch {
    return String(args);
  }
}

function detectLoop(history: ToolCallRecord[], windowSize = 3): boolean {
  if (history.length < windowSize * 2) return false;

  const recent = history.slice(-windowSize);
  const preceding = history.slice(-windowSize * 2, -windowSize);

  return recent.every((call, i) =>
    call.toolName === preceding[i]?.toolName &&
    call.argsHash === preceding[i]?.argsHash
  );
}

// =============================================================================
// AGENT RUNNER
// =============================================================================

export interface RunAgentOptions {
  /** System prompt for the agent */
  systemPrompt: string;
  /** User prompt (what the user asked) */
  userPrompt: string;
  /** Tools available to the agent */
  tools: ToolSet;
  /** Runner configuration */
  config: AgentRunnerConfig;
  /** Abort signal for cancellation */
  abortSignal?: AbortSignal;
  /** Callback for progress updates */
  onStep?: (step: AgentStep) => void;
}

/**
 * Run an agent with full guardrails.
 * 
 * The agent uses generateText with tools and maxSteps.
 * Each tool call is tracked for loop detection and cost estimation.
 * Tools should return `{ status: 'pending_confirmation', ... }` for
 * destructive actions — the runner collects these as AgentActions.
 */
export async function runAgent(options: RunAgentOptions): Promise<AgentRunResult> {
  const { systemPrompt, userPrompt, tools, config, abortSignal, onStep } = options;

  const startTime = Date.now();
  const steps: AgentStep[] = [];
  const actions: AgentAction[] = [];
  const callHistory: ToolCallRecord[] = [];

  // Check for cancellation
  if (abortSignal?.aborted) {
    return {
      status: 'cancelled',
      actions: [],
      steps: [],
      summary: 'Agent cancelled before starting.',
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    };
  }

  try {
    const model = createAgentModel(config.modelId, config.keys);
    const modelConfig = getModelConfig(config.modelId);
    const providerType = detectProvider(config.modelId);

    // Reasoning models (gpt-5.2, gpt-5.1) don't support temperature — omit entirely.
    // GPT-5 Mini only supports temperature: 1 (must be explicit, SDK defaults to 0 with tools).
    const temperatureConfig = modelConfig.reasoning
      ? {}
      : (providerType === 'openai' && config.modelId === 'openai/gpt-5-mini')
        ? { temperature: 1 }
        : { temperature: modelConfig.temperature };

    // Create a timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('AGENT_TIMEOUT')), config.timeoutMs);
    });

    // We'll use generateText with maxSteps for multi-step tool calling
    const generatePromise = generateText({
      model,
      system: systemPrompt,
      prompt: userPrompt,
      ...temperatureConfig,
      maxOutputTokens: modelConfig.maxTokens,
      tools,
      stopWhen: stepCountIs(config.maxSteps),
      abortSignal,
      onStepFinish: (event) => {
        // Track each tool call
        if (event.toolCalls && event.toolCalls.length > 0) {
          for (const toolCall of event.toolCalls) {
            const stepIndex = steps.length;
            const args = (toolCall as unknown as { input: unknown }).input as Record<string, unknown>;
            
            // Record for loop detection
            callHistory.push({
              toolName: toolCall.toolName,
              argsHash: hashArgs(args),
            });

            // Find matching result (v6: output instead of result)
            const toolResults = event.toolResults as Array<{ toolCallId: string; output: unknown }> | undefined;
            const matchingResult = toolResults?.find(
              (r) => r.toolCallId === toolCall.toolCallId
            );

            const resultValue = matchingResult?.output ?? null;

            const step: AgentStep = {
              index: stepIndex,
              toolName: toolCall.toolName,
              args,
              result: resultValue,
              timestamp: new Date(),
            };
            steps.push(step);
            onStep?.(step);

            // Collect pending_confirmation results as actions
            if (
              resultValue &&
              typeof resultValue === 'object' &&
              (resultValue as Record<string, unknown>).status === 'pending_confirmation'
            ) {
              const resultData = resultValue as Record<string, unknown>;
              actions.push({
                id: nanoid(),
                type: resultData.actionType as AgentAction['type'],
                description: resultData.description as string || `${toolCall.toolName} action`,
                approved: false,
                data: resultData,
              });
            }

            // Check loop detection
            if (detectLoop(callHistory)) {
              throw new Error('AGENT_LOOP_DETECTED');
            }

            // Check timeout
            if (Date.now() - startTime > config.timeoutMs) {
              throw new Error('AGENT_TIMEOUT');
            }
          }
        }
      },
    });

    // Race against timeout
    const result = await Promise.race([generatePromise, timeoutPromise]) as Awaited<typeof generatePromise>;

    // Calculate usage
    const usage = {
      promptTokens: result.usage?.inputTokens ?? 0,
      completionTokens: result.usage?.outputTokens ?? 0,
      totalTokens: (result.usage?.inputTokens ?? 0) + (result.usage?.outputTokens ?? 0),
    };

    // Check cost budget
    const cost = estimateCost(usage.promptTokens, usage.completionTokens, config.modelId);
    if (cost > config.maxCostUsd) {
      return {
        status: 'error',
        actions,
        steps,
        summary: `Agent exceeded cost budget ($${cost.toFixed(2)} > $${config.maxCostUsd.toFixed(2)}).`,
        usage,
        error: `Cost budget exceeded: $${cost.toFixed(2)}`,
      };
    }

    return {
      status: actions.length > 0 ? 'success' : 'success',
      actions,
      steps,
      summary: result.text || 'Agent completed successfully.',
      usage,
    };
  } catch (error) {
    const err = error as Error;

    if (abortSignal?.aborted || err.name === 'AbortError') {
      return {
        status: 'cancelled',
        actions,
        steps,
        summary: 'Agent was cancelled by user.',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      };
    }

    if (err.message === 'AGENT_TIMEOUT') {
      return {
        status: 'timeout',
        actions,
        steps,
        summary: `Agent timed out after ${config.timeoutMs / 1000}s. Partial results may be available.`,
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        error: 'Agent execution timed out.',
      };
    }

    if (err.message === 'AGENT_LOOP_DETECTED') {
      return {
        status: 'error',
        actions,
        steps,
        summary: 'Agent detected in a loop (repeating same tool calls). Stopped automatically.',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        error: 'Loop detected: agent was repeating the same actions.',
      };
    }

    return {
      status: 'error',
      actions,
      steps,
      summary: `Agent encountered an error: ${err.message}`,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      error: err.message,
    };
  }
}
