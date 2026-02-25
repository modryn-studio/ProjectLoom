/**
 * Mock Responses for Onboarding (v3)
 *
 * Two response modes:
 *   1. Step-keyed scripted responses for the onboarding flow (job offer scenario).
 *      These form a coherent narrative arc and are returned by step ID.
 *   2. Intent-detected fallback responses for unscripted interactions.
 *      Fully immersive — no mention of "demo", "API key", or "ProjectLoom".
 *
 * @version 3.0.0
 */

// =============================================================================
// STEP-KEYED ONBOARDING RESPONSES
// =============================================================================

/**
 * Scripted responses for each onboarding step. These match the prompts
 * defined in ONBOARDING_PROMPTS in onboarding-store.ts and form a
 * coherent job-offer decision narrative.
 */
const ONBOARDING_STEP_RESPONSES: Record<string, string> = {
  'auto-chat-0': `This is a big one — 40% more pay is significant, but so is a team you genuinely enjoy working with. Let's break this down properly instead of going with gut feel.

**The money question isn't just about the number:**
- What's the total comp difference? (equity, benefits, bonus structure)
- Does the new role have a higher growth ceiling, or is the 40% bump a one-time jump?
- What's the cost of the transition? (learning curve, proving yourself again, lost institutional knowledge)

**The team question goes deeper than "I like these people":**
- Is the team the reason you're growing, or the reason you're comfortable?
- Would you still love this team if the work stopped being interesting?
- How rare is this kind of team chemistry — could you find it again?

**The question most people skip:**
What would you need to be true about the new role to make leaving a no-brainer? If you can name that clearly, the decision gets much easier.

Where do you want to dig in first?`,

  'auto-chat-1': `Smart move — the right questions save you from the wrong decision. Here's what I'd be asking:

**About the role itself:**
- What does success look like in the first 6 months? (Vague answers = red flag)
- Why is this position open? (Growth vs. someone left vs. new initiative)  
- Who would I report to, and what's their management style?
- What's the biggest challenge the team is facing right now?

**About the culture:**
- How are decisions made — top-down or collaborative?
- What happened to the last person who failed at something? (This reveals psychological safety)
- How often do people leave, and why?

**About your career trajectory:**
- Where do people in this role typically go after 2-3 years?
- Is there budget and support for growth (conferences, learning, mentorship)?
- Would this role expand your skills, or just your salary?

**The uncomfortable one:**
- If you took this job and hated it after 6 months, how hard would it be to course-correct?

The answers to these questions will tell you whether this is a genuine upgrade or just more money for more problems. Which of these feels most important to investigate?`,

  'auto-chat-2': `This is where most people don't think clearly enough — they focus on what they're gaining and underweight what they're losing. Let's be honest about the real costs:

**The obvious losses:**
- A team that works well together (this is genuinely rare — most people go years without finding it)
- Institutional knowledge and credibility you've built up
- Comfort and confidence in your daily work

**The hidden losses:**
- **Relationship capital** — You know who to ask, who to trust, who to avoid. At a new company, you start from zero.
- **Influence** — You probably have more impact than you realize. New employees take 6-12 months to build equivalent influence.
- **The benefit of the doubt** — When you make a mistake now, people give you grace because they know your track record. New job = no track record.

**The loss most people don't see until it's too late:**
- **Identity and belonging** — If "my team" is part of how you describe yourself, leaving isn't just a career move. It's a personal transition. That takes emotional energy on top of the professional adjustment.

**But here's the counter-argument:**
- Comfort can become stagnation. If you're no longer being challenged, the "great team" might actually be holding you back.
- The pain of leaving fades faster than you expect. The pain of staying somewhere you've outgrown doesn't.

The question isn't whether you'd lose something — you will. The question is whether what you'd gain is worth more than what you'd grieve.`,

  'auto-chat-3': `You've done the hard thinking. Now let's synthesize.

**What the "take the offer" path looks like:**
You've identified that the new role pays significantly more and likely has a higher growth ceiling. The questions you'd ask in interviews would reveal whether the culture and trajectory match what you need. The losses are real — team chemistry, institutional capital, comfort — but they're recoverable over time.

**What the "stay" path looks like:**
You keep the team, the relationships, and the influence. But you need to be honest: is staying a choice you're making, or a choice you're avoiding? If the only reason to stay is *fear of loss*, that's not a strong enough reason.

**My framework for the actual decision:**

1. **If the new role answers your career-trajectory questions well** (growth path, learning, challenge) — the 40% pay bump on top of that makes it a strong move. The team you'll miss, but the version of you that grows into a bigger role will build new teams.

2. **If the new role is just "more money for similar work"** — staying is probably right. A great team doing meaningful work at lower pay beats a mediocre team doing the same work at higher pay, every time.

3. **The tiebreaker:** Ask yourself — *in 3 years, which decision am I more likely to regret?* Regret from inaction (not taking the leap) tends to compound. Regret from action (taking a risk that didn't pan out) tends to fade.

You don't need certainty. You need clarity on what matters most to you *right now*. The fact that you're thinking this deeply tells me you'll make the right call either way.`,
};

// =============================================================================
// STEP-KEYED DEMO RECORDING RESPONSES
// =============================================================================

/**
 * Scripted responses for the demo recording mode (?demo=record).
 * These match the prompts in DEMO_PROMPTS in demo-record-store.ts and
 * form a coherent "difficult conversation with manager" narrative for the
 * marketing video. 4-card structure: root → 2 branches → merge.
 */
const DEMO_RECORD_RESPONSES: Record<string, string> = {
  'demo-root-chat': `Being passed over despite strong reviews is genuinely difficult — and more common than it should be. The good news is this is a very winnable conversation if you approach it right.

Two things will determine whether this goes well:

**Your case** — what you say, the evidence you bring, and how you frame it. Most people either come in too emotional or too vague. You need neither.

**Your composure** — how you handle their reaction in real time. Managers get defensive, deflect, or make vague promises. Your ability to stay grounded through that is what separates a productive conversation from a damaging one.

These are worth preparing separately. Let's explore both angles.`,

  'demo-branch-a-chat': `Let's build a case that's hard to dismiss.

**Opening line (memorize this):**
*"I want to talk about my career trajectory here. I've had consistently strong reviews, and I want to understand what the path to promotion looks like for me specifically."*

This is non-confrontational but direct. You're not accusing — you're asking for clarity.

**Evidence to bring:**
- Your last 2–3 performance reviews (pull exact quotes)
- Specific examples of work that exceeded your current role's scope
- Any metrics: revenue impact, team contributions, projects delivered
- If peers were promoted, note what they had that you can demonstrate too

**The structure that works:**
1. State the pattern: "I've been here X years with strong reviews each cycle"
2. Ask the question: "What specifically would I need to demonstrate to be promoted?"
3. Listen carefully — their answer reveals whether there's a real path or not
4. Pin it down: "Can we set a timeline and specific milestones so I can work toward this?"

**The trap to avoid:** Don't compare yourself to others who got promoted. The moment you say "but they got promoted," the conversation becomes about them, not you.`,

  'demo-branch-b-chat': `This is the part most people skip — and it's the part that actually decides how the conversation goes.

**Before the meeting:**
- Write down your worst-case fear (they say no, they get angry, they dismiss you). Now ask: *could I survive that?* Yes. You could. Naming the fear shrinks it.
- Decide on your emotional floor: "No matter what happens, I will stay calm and professional." This is a commitment, not a hope.

**During the conversation:**
- **If they get defensive:** Don't match their energy. Pause, then say: *"I'm not trying to create conflict — I genuinely want to understand the path forward."*
- **If they dismiss your concerns:** Don't argue. Ask a question instead: *"Help me understand — what would need to change for this to be the right time?"*
- **If they make vague promises:** Pin it down gently: *"I appreciate that. Can we put a specific timeline on this so we're both aligned?"*

**The physiological trick:**
When you feel your heart rate spike, slow your speech by 30%. Deliberately. This sends a calm signal to your brain and forces you out of fight-or-flight. It also makes you sound more authoritative.

**After the meeting:**
Send a brief email summarizing what was discussed and any commitments made. This creates accountability without being aggressive.`,

  'demo-merge-1-chat': `Here's your complete conversation plan — preparation and composure woven together so you can actually follow this tomorrow.

**1 hour before — Set the foundation**
- Review your evidence packet: last 2–3 reviews, key achievements, scope-exceeding contributions
- Read through your opening line once: *"I want to talk about my career trajectory here…"*
- Do the fear-naming exercise: write your worst case, acknowledge you'd survive it, let it go
- Commit to your emotional floor: calm, professional, no matter what

**The conversation — Follow this structure**

1. **Open** — *"I want to understand the path to promotion for me specifically."* Speak 30% slower than feels natural.
2. **Present evidence** — Share 2–3 specific achievements that exceed your current role. Stick to facts — no emotion, no comparison to peers.
3. **Ask the key question** — *"What specifically would I need to demonstrate?"* Pause after asking. Let silence work for you.
4. **Handle defensiveness** — *"I'm not trying to create conflict — I want to understand the path forward."* If your heart rate spikes, slow your speech further.
5. **Pin down next steps** — *"Can we set a timeline and milestones so I'm working toward something concrete?"* Frame it as collaboration, not an ultimatum.

**After the meeting — Lock it in**
- Send a follow-up email within 2 hours summarizing commitments and timeline
- If the conversation revealed there's no real path → that's valuable information too. You now know where you stand.

**The insight that makes this work:** Your preparation gives you confidence to stay calm. Your calm gives you the clarity to use your evidence well. They reinforce each other — that's why both threads matter.`,
};

// =============================================================================
// INTENT DETECTION (fallback for unscripted interactions)
// =============================================================================

type Intent = 'decision' | 'howto' | 'brainstorm' | 'explain' | 'compare' | 'code' | 'general';

const INTENT_PATTERNS: { intent: Intent; patterns: RegExp[] }[] = [
  {
    intent: 'decision',
    patterns: [
      /should i|which.*better|pros.*cons|trade.?off|choose|decide|versus|vs\b|or should/i,
    ],
  },
  {
    intent: 'howto',
    patterns: [
      /how (do|can|to|would|should)|steps to|way to|guide|tutorial|walk me/i,
    ],
  },
  {
    intent: 'brainstorm',
    patterns: [
      /ideas?|brainstorm|suggestions?|creative|what if|imagine|possibilities|could we/i,
    ],
  },
  {
    intent: 'explain',
    patterns: [
      /explain|what is|what are|define|meaning|difference between|why does|why is/i,
    ],
  },
  {
    intent: 'compare',
    patterns: [
      /compare|comparison|differ|distinction|similarities|contrast|better.*or|worse/i,
    ],
  },
  {
    intent: 'code',
    patterns: [
      /code|function|program|script|implement|build.*app|debug|error|bug|typescript|javascript|python|react|api/i,
    ],
  },
];

function detectIntent(message: string): Intent {
  for (const { intent, patterns } of INTENT_PATTERNS) {
    if (patterns.some((p) => p.test(message))) return intent;
  }
  return 'general';
}

// =============================================================================
// RESPONSE TEMPLATES (intent-based fallback)
// =============================================================================

/** Pick a random item from an array */
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}


const RESPONSE_TEMPLATES: Record<Intent, string[]> = {
  decision: [
    `Good thinking to break this down. Here's how I'd approach it:\n\n**Option A — Go with the first instinct**\n- Faster to execute, lower switching cost\n- Risk: you might miss a better path\n\n**Option B — Explore the alternative**\n- More upfront effort, but potentially higher payoff\n- Risk: analysis paralysis\n\n**My suggestion:** start with whichever option you could reverse most easily. The best decisions preserve optionality early on.\n\nWhat's pulling you toward one side?`,

    `Let me lay out a framework for thinking through this:\n\n1. **What's the cost of being wrong?** If it's low, move fast and pick one.\n2. **What information would change your mind?** If you can get that info cheaply, do it first.\n3. **What would you advise a friend in this situation?** We're often clearer when it's not our own decision.\n\nBased on what you've shared, I'd lean toward the option that gives you the most learning — even if it's not the "safe" pick.\n\nWant to dig into any of these angles?`,
  ],

  howto: [
    `Here's a step-by-step approach:\n\n**1. Start with the foundation**\nGet the basics working before optimizing. A rough version you can test is worth more than a perfect plan you haven't started.\n\n**2. Break it into small wins**\nEach step should produce something visible or testable. This keeps momentum going and makes it easy to course-correct.\n\n**3. Iterate based on what you learn**\nThe first attempt will reveal things you couldn't have planned for. Build that into your timeline.\n\nWant me to go deeper on any of these steps?`,

    `Great question — let me walk through this:\n\n**Phase 1: Preparation**\n- Clarify exactly what "done" looks like\n- Identify the smallest version that delivers value\n- Gather what you need before starting\n\n**Phase 2: Execution**\n- Work in focused blocks — time-box each piece\n- Check progress against your "done" criteria regularly\n- Don't polish until the structure is solid\n\n**Phase 3: Refinement**\n- Get feedback early, even if it's rough\n- Focus on the 20% of effort that delivers 80% of impact\n\nWhat's the piece you're least sure about?`,
  ],

  brainstorm: [
    `Here are some directions worth exploring:\n\n**🎯 The practical angle**\nStart with the most obvious approach and do it exceptionally well. There's often more room to innovate in execution than in the concept itself.\n\n**💡 The unexpected twist**\nWhat if you flipped one core assumption? Sometimes the most interesting ideas come from inverting the obvious.\n\n**🔗 The cross-pollination**\nBorrow a pattern from a completely different domain. What works in one field often creates something fresh when applied elsewhere.\n\n**🚀 The ambitious version**\nIf resources weren't a constraint, what would this look like? Sometimes working backward from the ideal reveals practical steps you'd never find going forward.\n\nWhich of these sparks something for you?`,

    `Let me riff on this:\n\n1. **Start with the user's problem** — what specific frustration or desire are you solving? The tighter the problem, the more creative the solution can be.\n\n2. **What's the "10x" version?** — not 10% better, but fundamentally different. Even if you can't build it all, it reveals what really matters.\n\n3. **What already exists that's close?** — understanding adjacent solutions helps you find the gap that's uniquely yours.\n\n4. **What would make someone tell a friend about this?** — word-of-mouth worthy features tend to be the most valuable to build.\n\nI can help develop any of these threads further.`,
  ],

  explain: [
    `Let me break this down:\n\n**The core concept:**\nAt its simplest, this is about understanding the relationship between the parts and the whole. Each component serves a specific purpose, and the interesting part is how they interact.\n\n**Why it matters:**\nOnce you see the underlying structure, you can predict how changes in one area affect others. That's where the real understanding lives — not in memorizing facts, but in grasping the connections.\n\n**The nuance people miss:**\nMost explanations oversimplify. The reality is that context matters enormously. What's true in one situation might not apply in another, and recognizing those boundaries is what separates surface understanding from deep knowledge.\n\nWant me to go deeper on any of these layers?`,

    `Here's how I think about this:\n\n**Level 1 — The basics:**\nThe simplest way to understand this is as a system with inputs, a process, and outputs. What goes in gets transformed, and what comes out is the result.\n\n**Level 2 — The mechanics:**\nThe transformation step is where the interesting work happens. It's not just one thing — there are usually multiple factors interacting simultaneously.\n\n**Level 3 — The insight:**\nThe real "aha" comes from understanding *why* it works this way, not just *how*. The design constraints and trade-offs reveal the thinking behind the system.\n\nWhich level would be most useful to explore?`,
  ],

  compare: [
    `Let me lay out a clear comparison:\n\n| Dimension | First option | Second option |\n|-----------|-------------|---------------|\n| **Speed** | Faster to start | Faster long-term |\n| **Flexibility** | More adaptable | More structured |\n| **Risk** | Lower upfront | Lower overall |\n| **Learning curve** | Gentler | Steeper, but deeper |\n\n**The real question** isn't which is "better" — it's which fits your situation right now. A great tool used at the wrong time is worse than a decent tool used at the right time.\n\nWhat's your primary constraint — time, quality, or flexibility?`,

    `Good comparison to think through. Here are the key differences:\n\n**Where the first one wins:**\n- Simpler mental model — easier to start with\n- More community/ecosystem support\n- Battle-tested in production\n\n**Where the second one wins:**\n- Better architecture for complex use cases\n- Scales more gracefully\n- More aligned with where things are heading\n\n**My take:**\nIf you're building something you'll maintain for a long time, the second option's upfront investment usually pays off. For quick projects or prototypes, the first option gets you there faster.\n\nWhat's the lifespan of what you're building?`,
  ],

  code: [
    `Here's how I'd approach this:\n\n\`\`\`typescript\n// Start with the core logic — keep it simple and testable\ninterface Result<T> {\n  success: boolean;\n  data?: T;\n  error?: string;\n}\n\nasync function execute<T>(fn: () => Promise<T>): Promise<Result<T>> {\n  try {\n    const data = await fn();\n    return { success: true, data };\n  } catch (err) {\n    return { success: false, error: String(err) };\n  }\n}\n\`\`\`\n\n**Key design decisions:**\n- Generic result type keeps it reusable\n- Error handling is explicit, not thrown\n- Easy to test — pure function, no side effects\n\nWant me to adapt this to your specific use case?`,

    `Let me think through this technically:\n\n**Architecture approach:**\n\`\`\`typescript\n// Separate concerns: data, logic, presentation\nconst fetchData = async (query: string) => {\n  const response = await fetch(\`/api/search?q=\${encodeURIComponent(query)}\`);\n  if (!response.ok) throw new Error(\`HTTP \${response.status}\`);\n  return response.json();\n};\n\n// Transform the raw data into what the UI needs\nconst transform = (raw: RawData[]): DisplayItem[] =>\n  raw.map(item => ({\n    id: item.id,\n    label: item.name,\n    value: formatValue(item.metric),\n  }));\n\`\`\`\n\n**Why this pattern:**\n- Each function does one thing — easy to test and debug\n- The transform layer means your API shape doesn't leak into your UI\n- Error boundaries are clear\n\nShould I refine this for your specific stack?`,
  ],

  general: [
    `That's a great thread to pull on. Let me think about this:\n\n**What I'd focus on first:**\nThe most important thing is identifying the core constraint — what's the one thing that, if solved, would make everything else easier? Start there.\n\n**A useful mental model:**\nThink of this as a map with multiple paths to the destination. You don't need to see the whole route upfront — just the next clear step and a general direction.\n\n**What I'd push back on:**\nDon't try to optimize everything at once. Pick the lever with the highest impact-to-effort ratio and focus there.\n\nWhat's the part that feels most uncertain to you?`,

    `Let me engage with this thoughtfully:\n\n**First, the framing matters.** How you define the problem shapes what solutions are even visible. It's worth spending a moment asking: "Am I solving the right problem?"\n\n**Second, constraints can be gifts.** Limitations force creativity and prevent scope creep. What are the boundaries you're working within?\n\n**Third, progress beats perfection.** A shipped 80% solution teaches you more than an imagined 100% solution. The gaps become obvious once you have something real to react to.\n\nI'm happy to dig deeper on any angle here — what resonates?`,
  ],
};

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Get a step-keyed scripted response for onboarding.
 * Returns the canned response for the given step, or null if no scripted response.
 */
export function getOnboardingResponse(step: string): string | null {
  return ONBOARDING_STEP_RESPONSES[step] ?? null;
}

/**
 * Get a step-keyed scripted response for demo recording mode.
 * Returns the canned response for the given step, or null if no scripted response.
 */
export function getDemoRecordResponse(step: string): string | null {
  return DEMO_RECORD_RESPONSES[step] ?? null;
}

/**
 * Get a fully immersive mock response for the given user message.
 * Uses intent detection — no mention of "demo" or "API key".
 * Falls back to this when no step-keyed response is available.
 */
export function getMockResponse(userMessage: string): string {
  const intent = detectIntent(userMessage);
  const template = pick(RESPONSE_TEMPLATES[intent]);
  return template;
}

/**
 * Chunk a response string into word-level pieces for simulated streaming.
 * Returns an array of strings that, when concatenated, produce the original text.
 */
export function chunkResponse(text: string): string[] {
  const chunks: string[] = [];
  const words = text.split(/(\s+)/);
  for (const word of words) {
    if (word) chunks.push(word);
  }
  return chunks;
}
