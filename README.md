# ProjectLoom

<p align="center">
  <img src="assets/banner.png" alt="ProjectLoom" width="100%" />
</p>

**Branching AI conversations on an infinite canvas.** Split any AI conversation into different directions, explore them side by side, and combine the best parts — all on one visual canvas.

---

## What it is

ProjectLoom lets you explore every angle of an AI conversation without starting over. Branch from any point, explore multiple directions side by side, merge the best parts back together, and see your entire conversation history as a visual map — not a scroll bar.

- **Infinite canvas** — drag and position conversation cards freely in 2D space
- **Branching** — fork any conversation at any message to explore alternate paths
- **Merging** — pull multiple conversation threads into a single node (up to 5 parents)
- **Inherited context** — child cards automatically receive context from their ancestors
- **Knowledge base** — attach documents to a workspace; the AI has access to them in every conversation
- **Web search** — ground responses in live search results via Tavily
- **Canvas context** — the AI knows where in the DAG it sits and what surrounds it
- **Auto-titles** — cards name themselves based on conversation content
- **Light / dark theme** — instant switch, no flash

---

## Privacy & API access

ProjectLoom uses your own AI provider account. Your keys go directly from your browser to Anthropic or OpenAI — we never see or store them. You need at least one of:

- [Anthropic account](https://console.anthropic.com/) — for Claude models
- [OpenAI account](https://platform.openai.com/) — for GPT / o-series models

---

## Running locally

```bash
git clone https://github.com/modryn-studio/ProjectLoom.git
cd ProjectLoom
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), enter your API key(s) in Settings, and start building.

---

## Stack

- **Next.js 16** (App Router, Turbopack) + **React 19**
- **Vercel AI SDK v6** — streaming, tool calls, web search
- **React Flow** — canvas and edge rendering
- **Zustand** — all client state including undo/redo
- **TypeScript** strict mode throughout

---

## Feedback

Questions, bugs, or ideas — [share your thoughts](https://tally.so/r/zxq0Jk) or email [hello@modrynstudio.com](mailto:hello@modrynstudio.com)

Found a bug? [Open a bug report](https://tally.so/r/lby0Vv) or [file a GitHub issue](https://github.com/modryn-studio/ProjectLoom/issues)
