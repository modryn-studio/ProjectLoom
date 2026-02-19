/**
 * Mock Data Generator
 * 
 * Creates narrative-driven mock conversations forming a coherent
 * project story. Includes diverse content: multiple languages,
 * code snippets, markdown, and varied conversation lengths.
 * 
 * v4 Card-Level Branching: Demonstrates branch points, inherited
 * context, and merge nodes.
 * 
 * @version 4.0.0
 */

import { nanoid } from 'nanoid';
import type {
  Conversation,
  Message,
  EdgeConnection,
  Position,
  BranchPoint,
  InheritedContextEntry,

  EdgeRelationType,
} from '@/types';
import { generateTreeLayout } from '@/utils/layoutGenerator';

// =============================================================================
// TYPES
// =============================================================================

export interface MockDataResult {
  conversations: Conversation[];
  edges: EdgeConnection[];
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function createMessage(
  role: 'user' | 'assistant',
  content: string,
  hoursAgo: number = 0
): Message {
  return {
    id: nanoid(),
    role,
    content,
    timestamp: new Date(Date.now() - hoursAgo * 60 * 60 * 1000),
  };
}

function createConversation(
  title: string,
  messages: Message[],
  position: Position,
  connections: string[] = [],
  parentCardIds: string[] = [],
  branchPoint?: BranchPoint,
  inheritedContext?: Record<string, InheritedContextEntry>,
  isMergeNode: boolean = false
): Conversation {
  const now = new Date();
  const firstMessageTime = messages[0]?.timestamp || now;
  
  return {
    id: nanoid(),
    canvasId: 'main',
    position,
    content: messages,
    connections,
    // v4 card-level branching
    parentCardIds,
    branchPoint,
    inheritedContext: inheritedContext || {},
    isMergeNode,
    metadata: {
      title,
      createdAt: firstMessageTime,
      updatedAt: now,
      messageCount: messages.length,
      tags: [],
      isExpanded: false,
    },
  };
}

// =============================================================================
// CONVERSATION DATA
// =============================================================================

/**
 * 1. Project Kickoff — Root node
 */
const kickoffMessages: Message[] = [
  createMessage('user', `I want to build and ship a side project in 30 days. I've been sitting on ideas forever. How do I actually do this?`, 72),
  createMessage('assistant', `30 days is totally realistic if you constrain yourself ruthlessly. Here's the only framework that matters:

**Week 1 — Decide and validate**
Pick one idea. Talk to 5 potential users before writing a line of code. If you can't find 5 people who'd use it, pick a different idea.

**Week 2 — Build the core**
One feature done properly beats five features done halfway. Build only what you'd demo on day 14.

**Week 3 — Make it usable**
Auth, error states, mobile layout. The stuff that turns a prototype into something you're not embarrassed to share.

**Week 4 — Ship and tell people**
Vercel deploy, a real domain, and actually posting about it. The build is 20% of the work. Distribution is 80%.

What's the idea you keep coming back to?`, 71),
  createMessage('user', `A tool for developers to manage and replay their AI conversation history across different projects. Like git for AI chats.`, 70),
  createMessage('assistant', `That's a strong idea — you're clearly your own user zero, which is the best starting point.

A few things make this promising:
- Developers already feel the pain (context switching between tools, losing good prompts)
- The "git for AI chats" framing is immediately understandable
- BYOK means zero infrastructure cost to start

The risk: scope creep. "Replay" and "manage" and "across projects" is already three features. For week 1, pick the single most painful thing and solve only that.

What's the moment you personally felt most frustrated with your current AI workflow?`, 69),
];

/**
 * 2. Tech Stack — Branch from kickoff
 */
const techStackMessages: Message[] = [
  createMessage('user', `What tech stack should I use? I know React and Node. I want to ship fast without fighting the tools.`, 68),
  createMessage('assistant', `Stick with what you know for a 30-day project. Fighting unfamiliar tools kills momentum.

**Recommended stack:**
- **Next.js** — one repo, API routes included, Vercel deploy in minutes
- **TypeScript** — catches bugs before users do, worth the small overhead
- **Zustand** — simpler than Redux, great for client state
- **Vercel** — deploy on every push, free tier covers early traffic

What to skip right now:
- Don't add a DB until you know what you're storing
- Don't set up auth until you have something worth protecting
- Don't pick a UI library — just write CSS, it's faster for one person

The goal is a URL you can send to someone by day 14.`, 67),
];

/**
 * 3. Finding Your Users — Branch from kickoff
 */
const findingUsersMessages: Message[] = [
  createMessage('user', `Who are my first users and how do I actually find them? "post on social media" feels vague.`, 66),
  createMessage('assistant', `Forget broad social media for launch. You need 10 obsessed users, not 1,000 indifferent ones.

**Where developers with your exact problem hang out:**
- r/ChatGPT, r/LocalLLaMA, r/SideProject — post a "I'm solving X, anyone else feel this pain?"
- Hacker News "Who wants to be beta tested?" thread (posted Tuesdays)
- Dev Twitter/X — search "I wish my AI chat tool could..." and reply directly
- Discord servers for indie hackers (Buildspace, Indie Hackers)

**The opener that works:**
"I'm building [thing] because I personally needed it. Here's a short demo. Would you use this? Brutal honesty welcome."

Don't ask if it's a good idea. Ask if they'd pay for it, or better yet — ask them to try it and watch where they get confused.

Who specifically do you picture using this on day 1?`, 65),
  createMessage('user', `Developers who use Claude or ChatGPT daily for coding help and feel frustrated when they lose context or good prompts.`, 64),
  createMessage('assistant', `Perfect — that's specific enough to find them. They're on:

- r/ClaudeAI and r/ChatGPT (active daily)
- GitHub discussions on AI coding tools
- Cursor and Windsurf Discord servers (these users live in AI dev tools)

**Your outreach message:**
> "I built a canvas for organizing AI conversations — branching, merging threads, never losing context again. Made it for myself. If you've ever lost a great prompt or wished you could compare two AI approaches side by side, I'd love 10 minutes of your time."

One thing: before you post anywhere, have a 30-second video of the core interaction. Text posts get ignored. A GIF of the canvas in action gets clicks.`, 63),
];

/**
 * 4. Pricing Strategy — Branch from kickoff
 */
const pricingMessages: Message[] = [
  createMessage('user', `Should I charge from day one? Free tier with paid upgrade? I don't want to undersell but I also have zero users.`, 62),
  createMessage('assistant', `Charge from day one — but make the free tier genuinely useful so there's no friction to start.

**Model that works for indie developer tools:**

Free tier:
- Unlimited use, no time limit
- BYOK (they bring their own API keys — your infra cost is zero)
- Core features fully available

Paid tier ($8–12/mo):
- Sync across devices
- Hosted keys / usage included
- Priority support
- Export and integrations

Why this works:
- Free tier removes the "should I try this?" friction
- BYOK free tier costs you nothing, so free users aren't a liability
- The paid tier sells convenience, not access — much easier to justify

Don't do a 14-day trial. Trials create urgency that turns into churn. Give them the free tier forever and let them upgrade when they hit a real limit.`, 61),
];

/**
 * 5. Frontend Framework — Branch from tech stack
 */
const frontendMessages: Message[] = [
  createMessage('user', `Should I use Next.js App Router or stick with Pages Router? I've heard App Router has a learning curve.`, 60),
  createMessage('assistant', `App Router for a new project. The learning curve is real but it's worth it — and the curve is mostly unlearning patterns, not learning new ones.

The payoff for a tool like this:
- **Streaming** — AI responses stream natively without workarounds
- **Server components** — initial data loads fast, no loading spinners for static content
- **Route handlers** — clean API routes without Express overhead

The one thing that trips people up: client vs server boundary. Rule of thumb — if it needs \`useState\`, \`useEffect\`, or browser APIs, add \`'use client'\` at the top. Everything else defaults to server. That's 90% of what you need to know.

For your canvas specifically: the React Flow canvas will be a client component. API routes for AI calls will be server. Clean separation.`, 59),
];

/**
 * 6. Backend & Auth — Branch from frontend
 */
const backendMessages: Message[] = [
  createMessage('user', `What about backend and auth? Do I even need auth on day one if it's BYOK?`, 58),
  createMessage('assistant', `For a BYOK tool — skip auth on day one. 100%.

Here's why it's safe:
- Users bring their own API keys, stored in their own browser (localStorage or sessionStorage)
- You have zero sensitive data server-side
- No auth = no login friction = faster path to that first "aha" moment

What you do need:
- Client-side key storage (encrypted in localStorage is fine for MVP)
- A clear "your keys never leave your browser" message — it's a trust feature, not just a technical detail

Add auth when you have a reason: sync across devices, team features, or a hosted key tier. Until then, auth is a feature you're building for a problem you don't have yet.

For persistence right now: \`localStorage\` for canvas state, \`IndexedDB\` for anything larger than a few KB (conversation history). Both are free, offline-capable, and require zero backend.`, 57),
];

/**
 * 7. Deployment — Branch from backend
 */
const deploymentMessages: Message[] = [
  createMessage('user', `Deployment setup — what do I actually need to go live properly?`, 56),
  createMessage('assistant', `Lean setup that covers everything for an early-stage tool:

**Hosting: Vercel (free tier)**
Connect your GitHub repo, every push auto-deploys. Takes 5 minutes to set up, zero to maintain.

**Domain: buy it now**
$12/year on Namecheap. Don't launch with a \`.vercel.app\` URL — it signals side project energy when you want product energy.

**Analytics: Plausible or Fathom**
Lightweight, privacy-friendly, won't get blocked by ad blockers. You need to know if anyone is actually using it.

**Error tracking: Sentry (free tier)**
You will not be watching the console when users hit bugs. Sentry tells you what broke and where.

That's the full stack. No Docker, no AWS, no CI/CD pipeline — those are problems for when you have users to serve. Ship this weekend, optimize next month.`, 55),
];

/**
 * 8. Scaling Later — Branch from deployment
 */
const scalingMessages: Message[] = [
  createMessage('user', `When should I start thinking about scaling? I don't want to build something that collapses at 1000 users.`, 54),
  createMessage('assistant', `Don't think about scaling until you have a scaling problem. Seriously.

The math: Vercel's free tier handles millions of requests/month. Next.js static + edge functions scale automatically. A BYOK app with localStorage has essentially zero server load. You could get 10,000 users before you need to change anything.

The trap most indie hackers fall into: spending week 3 optimizing infrastructure for a user load they don't have instead of talking to the 8 users they do have.

**When to actually revisit:**
- You're getting charged on Vercel (good problem — means traffic)
- A specific feature is slow for a measurable reason
- You're adding a DB and need to think about queries

Until one of those is true, every hour on scaling is an hour not spent on growth. Your bottleneck right now is distribution, not architecture.`, 53),
];

/**
 * 9. Landing Page Copy — Branch from finding users
 */
const landingPageMessages: Message[] = [
  createMessage('user', `Help me write landing page copy. I want it to be direct, not full of buzzwords.`, 52),
  createMessage('assistant', `Good instinct. Here's a structure that converts for developer tools:

**Hero (above the fold)**
Headline: "Your AI conversations, organized like a project — not a chat log."
Sub: "Branch, merge, and navigate your AI work on an infinite canvas. BYOK, runs in your browser."
CTA: "Try it free →"

**One-liner pain acknowledgment**
"Every developer has a graveyard of good prompts they'll never find again."

**3 features, not 8**
Pick the three things that make it different. For this tool probably:
- Branch any conversation to explore two paths at once
- Merge multiple threads into a single synthesis
- Full context flows through the graph automatically

**Social proof placeholder**
Even if you have zero users: "Built by a developer who kept losing context. Now it's yours too."

**Footer CTA**
"BYOK — your API keys never leave your browser."

What's the one thing you want users to understand in 5 seconds?`, 51),
  createMessage('user', `That they can branch and merge AI conversations like code, and never lose context again.`, 50),
  createMessage('assistant', `Then lead with exactly that:

**Headline:** "Branch and merge AI conversations — like code, not chat."

**Sub:** "Explore multiple AI approaches in parallel, merge the best ideas, and carry full context through every thread. Your keys, your browser, your work."

The "like code" framing is instant for developers — they already know what branch and merge means. You're not explaining a new concept, you're applying a familiar mental model to a new problem.

One tip: show it, don't say it. A 15-second screen recording of someone branching a conversation and watching context flow to the child card will do more than any headline.`, 49),
];

/**
 * 10. Launch Checklist — Branch from deployment
 */
const launchChecklistMessages: Message[] = [
  createMessage('user', `What's my actual launch checklist? I want to make sure I'm not missing anything obvious.`, 4),
  createMessage('assistant', `**The day-before checklist:**

Product
- [ ] Core flow works end-to-end (create, branch, merge, persist)
- [ ] Error states don't show stack traces to users
- [ ] Mobile layout isn't broken
- [ ] Empty state guides new users (don't show a blank canvas with no hint)

Trust signals
- [ ] Custom domain live (not .vercel.app)
- [ ] "Your keys never leave your browser" visible on the API key screen
- [ ] Feedback link somewhere accessible

Launch posts (write them before you deploy, post simultaneously)
- [ ] HN Show HN post drafted
- [ ] r/SideProject post drafted
- [ ] Twitter/X thread drafted (3-4 tweets with a GIF)
- [ ] Personal network DMs to 5 people you think would genuinely use it

Day-of
- [ ] Sentry is live before you post anywhere
- [ ] You can see Plausible traffic in real time
- [ ] You're free for 2-3 hours to respond to comments

The most common launch mistake: shipping and walking away. The first hour of comments shapes everything. Be there.`, 3),
];

// =============================================================================
// MAIN GENERATOR
// =============================================================================

/**
 * Generate the complete mock data set
 *
 * Demonstrates ProjectLoom's core capabilities through a realistic
 * "shipping a side project in 30 days" planning canvas.
 *
 * Graph structure:
 *  Kickoff (root)
 *    ├── Tech Stack → Frontend → Backend → Deployment → Scaling
 *    │                                              └── Launch Checklist
 *    ├── Finding Users → Landing Page ──────────────────────────┐
 *    └── Pricing ──────────────────────────────── 🔀 Week 1 Plan ◄─┘
 */
export function generateMockData(): MockDataResult {
  const tempPosition: Position = { x: 0, y: 0 };

  const makeBranchPoint = (parentCardId: string, messageIndex: number): BranchPoint => ({
    parentCardId,
    messageIndex,
  });

  const makeInheritedContext = (
    messages: Message[],
    totalParentMessages: number
  ): InheritedContextEntry => ({
    mode: 'full',
    messages,
    timestamp: new Date(),
    totalParentMessages,
  });

  // 0 — root
  const kickoff = createConversation(
    'Ship a Side Project in 30 Days',
    kickoffMessages,
    tempPosition,
    [],
    [],
    undefined,
    {},
    false
  );

  // 1 — branch from kickoff
  const techStack = createConversation(
    'Tech Stack',
    techStackMessages,
    tempPosition,
    [],
    [kickoff.id],
    makeBranchPoint(kickoff.id, 1),
    { [kickoff.id]: makeInheritedContext(kickoffMessages.slice(0, 2), kickoffMessages.length) },
    false
  );

  // 2 — branch from kickoff
  const findingUsers = createConversation(
    'Finding Your Users',
    findingUsersMessages,
    tempPosition,
    [],
    [kickoff.id],
    makeBranchPoint(kickoff.id, 2),
    { [kickoff.id]: makeInheritedContext(kickoffMessages.slice(0, 3), kickoffMessages.length) },
    false
  );

  // 3 — branch from kickoff
  const pricing = createConversation(
    'Pricing Strategy',
    pricingMessages,
    tempPosition,
    [],
    [kickoff.id],
    makeBranchPoint(kickoff.id, 2),
    { [kickoff.id]: makeInheritedContext(kickoffMessages.slice(0, 3), kickoffMessages.length) },
    false
  );

  // 4 — branch from techStack
  const frontend = createConversation(
    'App Router vs Pages Router',
    frontendMessages,
    tempPosition,
    [],
    [techStack.id],
    makeBranchPoint(techStack.id, 1),
    { [techStack.id]: makeInheritedContext(techStackMessages.slice(0, 2), techStackMessages.length) },
    false
  );

  // 5 — branch from frontend
  const backend = createConversation(
    'Backend & Auth',
    backendMessages,
    tempPosition,
    [],
    [frontend.id],
    makeBranchPoint(frontend.id, 1),
    { [frontend.id]: makeInheritedContext(frontendMessages.slice(0, 2), frontendMessages.length) },
    false
  );

  // 6 — branch from backend
  const deployment = createConversation(
    'Deployment Setup',
    deploymentMessages,
    tempPosition,
    [],
    [backend.id],
    makeBranchPoint(backend.id, 1),
    { [backend.id]: makeInheritedContext(backendMessages.slice(0, 2), backendMessages.length) },
    false
  );

  // 7 — branch from deployment
  const scaling = createConversation(
    'Scaling Later',
    scalingMessages,
    tempPosition,
    [],
    [deployment.id],
    makeBranchPoint(deployment.id, 1),
    { [deployment.id]: makeInheritedContext(deploymentMessages.slice(0, 2), deploymentMessages.length) },
    false
  );

  // 8 — branch from findingUsers
  const landingPage = createConversation(
    'Landing Page Copy',
    landingPageMessages,
    tempPosition,
    [],
    [findingUsers.id],
    makeBranchPoint(findingUsers.id, 3),
    { [findingUsers.id]: makeInheritedContext(findingUsersMessages.slice(0, 4), findingUsersMessages.length) },
    false
  );

  // 9 — branch from deployment
  const launchChecklist = createConversation(
    'Launch Checklist',
    launchChecklistMessages,
    tempPosition,
    [],
    [deployment.id],
    makeBranchPoint(deployment.id, 1),
    { [deployment.id]: makeInheritedContext(deploymentMessages.slice(0, 2), deploymentMessages.length) },
    false
  );

  // 10 — MERGE NODE: findingUsers + pricing + landingPage
  const weekOnePlan = createConversation(
    '🔀 Week 1 Action Plan',
    [
      createMessage('user', 'Based on everything we explored about finding users, pricing, and the landing page — what should I actually do in week 1? Give me a concrete daily plan.', 2),
      createMessage('assistant', `## Week 1 — Concrete Daily Plan

**Day 1 (today)**
- Write down the single most painful moment in your current AI workflow
- Find 3 posts on Reddit/X from people describing that same pain
- Reply to them — not to pitch, just to ask one question

**Day 2**
- Set up your repo and deploy a "coming soon" page with your domain
- Write your landing page headline using the "branch and merge like code" framing
- DM 5 developer friends; ask if they've felt the context-loss problem

**Day 3–4**
- Build the core interaction: create a card, branch it, see context flow
- Nothing else. Resist adding auth, settings, or polish

**Day 5**
- Record a 30-second screen capture of the core flow
- Post it in one place (HN, r/SideProject, or your Twitter) with: "I built this because I needed it — does this resonate?"

**Day 6–7**
- Talk to anyone who replied. Don't pitch — ask what else they'd need
- Write down every friction point you noticed while building

**Pricing in week 1:** don't charge yet. Your goal is 10 users who use it twice. Revenue follows retention.

By day 7 you'll know if you have something worth week 2.`, 1),
    ],
    tempPosition,
    [],
    [findingUsers.id, pricing.id, landingPage.id],
    undefined,
    {
      [findingUsers.id]: makeInheritedContext(findingUsersMessages.slice(0, 4), findingUsersMessages.length),
      [pricing.id]: makeInheritedContext(pricingMessages.slice(0, 2), pricingMessages.length),
      [landingPage.id]: makeInheritedContext(landingPageMessages.slice(0, 4), landingPageMessages.length),
    },
    true
  );

  const conversations = [
    kickoff,        // 0
    techStack,      // 1
    findingUsers,   // 2
    pricing,        // 3
    frontend,       // 4
    backend,        // 5
    deployment,     // 6
    scaling,        // 7
    landingPage,    // 8
    launchChecklist,// 9
    weekOnePlan,    // 10 — merge node
  ];

  const edgeDefinitions: Array<{
    sourceIdx: number;
    targetIdx: number;
    relationType: EdgeRelationType;
  }> = [
    { sourceIdx: 0, targetIdx: 1, relationType: 'branch' },  // Kickoff → Tech Stack
    { sourceIdx: 0, targetIdx: 2, relationType: 'branch' },  // Kickoff → Finding Users
    { sourceIdx: 0, targetIdx: 3, relationType: 'branch' },  // Kickoff → Pricing
    { sourceIdx: 1, targetIdx: 4, relationType: 'branch' },  // Tech Stack → Frontend
    { sourceIdx: 4, targetIdx: 5, relationType: 'branch' },  // Frontend → Backend
    { sourceIdx: 5, targetIdx: 6, relationType: 'branch' },  // Backend → Deployment
    { sourceIdx: 6, targetIdx: 7, relationType: 'branch' },  // Deployment → Scaling
    { sourceIdx: 2, targetIdx: 8, relationType: 'branch' },  // Finding Users → Landing Page
    { sourceIdx: 6, targetIdx: 9, relationType: 'branch' },  // Deployment → Launch Checklist
    // Merge edges
    { sourceIdx: 2, targetIdx: 10, relationType: 'merge' },  // Finding Users → Week 1 Plan
    { sourceIdx: 3, targetIdx: 10, relationType: 'merge' },  // Pricing → Week 1 Plan
    { sourceIdx: 8, targetIdx: 10, relationType: 'merge' },  // Landing Page → Week 1 Plan
  ];

  const branchPairs = edgeDefinitions
    .filter(e => e.relationType === 'branch')
    .map(e => ({ source: e.sourceIdx, target: e.targetIdx }));

  const layout = generateTreeLayout(
    branchPairs,
    { count: conversations.length },
    42
  );

  conversations.forEach((conv, index) => {
    conv.position = layout.positions[index] || { x: 1400, y: 300 };
  });

  // Position merge node to the right of its parents
  const mergeParentPositions = [2, 3, 8].map(i => conversations[i].position);
  const avgY = mergeParentPositions.reduce((sum, p) => sum + p.y, 0) / mergeParentPositions.length;
  const maxX = Math.max(...mergeParentPositions.map(p => p.x));
  conversations[10].position = { x: maxX + 400, y: avgY };

  const edges: EdgeConnection[] = edgeDefinitions.map(({ sourceIdx, targetIdx, relationType }) => ({
    id: `edge-${conversations[sourceIdx].id}-${conversations[targetIdx].id}`,
    source: conversations[sourceIdx].id,
    target: conversations[targetIdx].id,
    curveType: 'bezier' as const,
    relationType,
    animated: relationType === 'merge',
  }));

  edgeDefinitions.forEach(({ sourceIdx, targetIdx }) => {
    conversations[sourceIdx].connections.push(conversations[targetIdx].id);
  });

  return { conversations, edges };
}

/**
 * Get a single conversation by index (for testing)
 */
export function getMockConversation(index: number): Conversation | undefined {
  const { conversations } = generateMockData();
  return conversations[index];
}

/**
 * Get conversations count
 */
export function getMockConversationCount(): number {
  return 11; // Includes merge node
}

export default generateMockData;
