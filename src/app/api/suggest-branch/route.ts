/**
 * Suggest Branch API Route
 *
 * Async classifier that runs after each chat response to detect genuine
 * decision forks. Uses a cheap/fast model (Haiku or GPT-5 Mini) from the
 * same provider the user has keys for.
 *
 * Returns `{ branches: [{ title, seedPrompt }] }` when a fork is detected,
 * or `{ branches: null }` when no fork exists.
 *
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { z } from 'zod';
import { createModel, detectProvider as detectModelProvider } from '@/lib/provider-factory';
import { createRouteLogger } from '@/lib/route-logger';
import { isTrialEnabled } from '@/lib/trial-cookie';

export const runtime = 'edge';
export const maxDuration = 30;

const log = createRouteLogger('suggest-branch');

// =============================================================================
// TYPES
// =============================================================================

interface SuggestBranchRequest {
  /** Recent conversation turns (last N messages) */
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  /** The model the user is currently chatting with (used to detect provider) */
  model: string;
  /** BYOK keys */
  anthropicKey?: string;
  openaiKey?: string;
}

export interface BranchSuggestion {
  title: string;
  seedPrompt: string;
}

// =============================================================================
// SCHEMA
// =============================================================================

const BranchSchema = z.object({
  branches: z
    .array(
      z.object({
        title: z.string().describe('2–5 word title for this branch, title case'),
        seedPrompt: z.string().describe('First-person user message that opens this direction'),
      }),
    )
    .nullable()
    .describe('Array of branches when a genuine fork exists, null otherwise'),
});

// =============================================================================
// CLASSIFIER PROMPT
// =============================================================================

const CLASSIFIER_SYSTEM_PROMPT = `You are a conversation analyst. Your ONLY job is to detect genuine decision forks in conversations.

A genuine fork exists when the assistant's latest response presents TWO OR MORE approaches that:
- Start from fundamentally different assumptions
- Target different outcomes or audiences
- Require completely separate exploration to evaluate properly
- Cannot be meaningfully covered in a single follow-up message

A fork does NOT exist when:
- The assistant lists pros and cons of ONE approach
- Options are minor variations or phrasings of the same idea
- The response presents a single recommendation with caveats
- Follow-up questions or clarifications are suggested
- The assistant covers multiple aspects of one cohesive answer

DEFAULT TO "no fork." Most conversations do NOT have a fork. Be conservative — a false positive is worse than a false negative.

When a fork exists, output ONLY valid JSON:
{"branches":[{"title":"Short Title","seedPrompt":"A natural user message that opens this direction"}]}

When no fork exists, output ONLY:
{"branches":null}

Rules for branches:
- 2–4 branches maximum (2 is most common)
- Titles: 2–5 words, title case, descriptive
- Seed prompts: written as if the USER is asking — first person, conversational, specific
- Each branch must be genuinely distinct — not overlapping angles on the same approach

Output ONLY the JSON object. No explanation, no markdown, no commentary.`;

// =============================================================================
// CHEAP MODEL SELECTION
// =============================================================================

const CHEAP_MODELS: Record<string, string> = {
  anthropic: 'anthropic/claude-haiku-4-5',
  openai: 'openai/gpt-5-mini',
};

function selectClassifierModel(
  userModel: string,
  keys: { anthropic?: string; openai?: string },
): string {
  // Use cheap model from the same provider the user is on
  try {
    const provider = detectModelProvider(userModel);
    if (keys[provider]) {
      return CHEAP_MODELS[provider];
    }
  } catch {
    // Unknown provider — fall through
  }

  // Fallback: use whichever provider has a key
  if (keys.anthropic) return CHEAP_MODELS.anthropic;
  if (keys.openai) return CHEAP_MODELS.openai;

  // No keys at all — will be handled by trial logic below
  return CHEAP_MODELS.openai;
}

// =============================================================================
// HANDLER
// =============================================================================

export async function POST(request: NextRequest): Promise<Response> {
  const ctx = log.begin();

  try {
    const body = (await request.json()) as SuggestBranchRequest;
    const { messages, anthropicKey, openaiKey } = body;
    const userModel = body.model;
    const keys: { anthropic?: string; openai?: string } = {
      anthropic: anthropicKey,
      openai: openaiKey,
    };

    // Validation
    if (!messages || messages.length < 2) {
      log.info(ctx.reqId, 'Skipped — fewer than 2 messages');
      return log.end(ctx, NextResponse.json({ branches: null }));
    }

    // Select cheap classifier model
    let classifierModel = selectClassifierModel(userModel, keys);

    // Trial fallback: inject platform key if user has no keys
    if (!keys.anthropic && !keys.openai) {
      if (isTrialEnabled()) {
        keys.openai = process.env.TRIAL_OPENAI_KEY!;
        classifierModel = CHEAP_MODELS.openai;
        log.info(ctx.reqId, 'Trial mode — using platform key');
      } else {
        log.info(ctx.reqId, 'No API keys and trial disabled — skipping');
        return log.end(ctx, NextResponse.json({ branches: null }));
      }
    }

    log.info(ctx.reqId, 'Classifying', {
      classifierModel,
      userModel,
      messageCount: messages.length,
    });

    // Build conversation excerpt — last 6 messages max, truncated
    const recentMessages = messages.slice(-6);
    const conversationExcerpt = recentMessages
      .map((m) => `${m.role.toUpperCase()}: ${m.content.slice(0, 800)}`)
      .join('\n\n');

    const aiModel = createModel(classifierModel, keys);

    // generateObject() handles structured output natively for both reasoning
    // models (OpenAI Responses API / structured outputs) and Anthropic (tool call).
    // No temperature or manual JSON parsing needed.
    const { object: parsed } = await generateObject({
      model: aiModel,
      schema: BranchSchema,
      system: CLASSIFIER_SYSTEM_PROMPT,
      prompt: `Analyze this conversation for a genuine decision fork:\n\n${conversationExcerpt}`,
      maxOutputTokens: 500,
    });

    log.info(ctx.reqId, 'Classifier output', { branches: parsed?.branches?.map((b) => b.title) ?? null });

    // Validate structure
    if (!parsed?.branches || parsed.branches.length < 2) {
      log.info(ctx.reqId, 'No fork detected');
      return log.end(ctx, NextResponse.json({ branches: null }));
    }

    // Cap at 4 branches; schema already enforces types so no String() coercion needed
    const branches = parsed.branches.slice(0, 4).map((b) => ({
      title: b.title.slice(0, 50),
      seedPrompt: b.seedPrompt.slice(0, 500),
    }));

    log.info(ctx.reqId, 'Fork detected', {
      branchCount: branches.length,
      titles: branches.map((b) => b.title),
    });

    return log.end(ctx, NextResponse.json({ branches }), {
      branchCount: branches.length,
    });
  } catch (error) {
    log.err(ctx, error);
    // Non-critical — never block the chat experience
    return NextResponse.json({ branches: null }, { status: 200 });
  }
}
