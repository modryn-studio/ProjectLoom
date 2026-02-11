/**
 * Search Orchestration Layer
 *
 * Production-grade web search orchestration that runs BEFORE the LLM call.
 * Replaces the naive tool-calling pattern that caused token explosion and
 * empty responses.
 *
 * Architecture (mirrors ChatGPT / Perplexity):
 *   1. Detect whether the user message needs web search
 *   2. Generate 1–3 focused search queries via heuristics
 *   3. Execute Tavily searches in parallel with timeout
 *   4. Deduplicate, rank, and limit to ≤ MAX_SOURCES results
 *   5. Format a compact search-context block for the system prompt
 *
 * The LLM receives the search context as grounding and cites sources naturally.
 *
 * @version 1.0.0
 */

// =============================================================================
// CONSTANTS
// =============================================================================

/** Maximum distinct sources surfaced to the user & LLM */
const MAX_SOURCES = 8;

/** Maximum snippet length per source (chars) */
const MAX_SNIPPET_LENGTH = 300;

/** Hard timeout for ALL Tavily requests (ms) */
const SEARCH_TIMEOUT_MS = 8_000;

/** Maximum number of Tavily API calls per user message */
const MAX_QUERIES = 2;

/** Tavily results requested per query */
const TAVILY_MAX_RESULTS = 5;

// =============================================================================
// TYPES
// =============================================================================

export interface SearchSource {
  title: string;
  url: string;
  snippet: string;
}

export interface SearchResult {
  /** Formatted block to inject into the system prompt */
  searchContext: string;
  /** De-duplicated sources for the UI citation list */
  sources: SearchSource[];
  /** Queries that were actually sent to Tavily */
  queriesUsed: string[];
}

interface TavilyResult {
  title?: string;
  url: string;
  content?: string;
  score?: number;
}

interface TavilyResponse {
  answer?: string;
  results?: TavilyResult[];
}

// =============================================================================
// 1. INTENT DETECTION — should we search at all?
// =============================================================================

/**
 * Lightweight heuristic to decide if the user's message warrants a web search.
 *
 * Rules:
 *  - Messages shorter than 5 chars → no
 *  - Explicit search signals (keywords / question patterns) → yes
 *  - References to recency, news, current events → yes
 *  - Pure conversational / instructional prompts → no
 */
export function shouldSearch(message: string): boolean {
  const m = message.toLowerCase().trim();

  // Too short to be a real search query
  if (m.length < 5) return false;

  // Skip if the user is just saying thanks / greeting / etc.
  if (/^(thanks?|thank you|hi|hello|hey|ok|sure|yes|no|bye)\b/.test(m)) return false;

  // Direct search signals
  const searchSignals = [
    // Recency / currency
    /\b(latest|newest|recent|current|today|now|2024|2025|2026|this year|this month|this week|right now)\b/,
    // Explicit search requests
    /\b(search|look up|find|google|what is|what are|who is|who are|where is|how to|how do|how does|how can)\b/,
    // News / events
    /\b(news|update|release|announced|launched|version|pricing|price|cost|stock|weather)\b/,
    // Comparison / recommendation queries
    /\b(vs\.?|versus|compare|comparison|best|top|recommend|alternative)\b/,
    // Technical lookups
    /\b(documentation|docs|api|library|framework|package|install|error|bug|fix)\b/,
    // Question patterns
    /^(what|who|where|when|why|how|is|are|does|do|can|will|should|did)\b/,
  ];

  return searchSignals.some((re) => re.test(m));
}

// =============================================================================
// 2. QUERY GENERATION
// =============================================================================

/**
 * Extract 1–MAX_QUERIES focused search queries from the user's message.
 *
 * Strategy:
 *  - Use the message itself as the primary query (trimmed to 200 chars)
 *  - If the message contains multiple questions or a compound structure,
 *    split into sub-queries.
 */
export function generateSearchQueries(message: string): string[] {
  const trimmed = message.trim();
  if (!trimmed) return [];

  // Try to split on question marks for multi-question messages
  const questions = trimmed.split(/\?/).filter((q) => q.trim().length > 10);

  if (questions.length > 1) {
    // Multiple questions — take first MAX_QUERIES, add '?' back
    return questions
      .slice(0, MAX_QUERIES)
      .map((q) => q.trim().slice(0, 200) + '?');
  }

  // Single query — use the full message (truncated)
  return [trimmed.slice(0, 200)];
}

// =============================================================================
// 3. SEARCH EXECUTION
// =============================================================================

/**
 * Execute search queries against Tavily in parallel with a shared timeout.
 */
async function executeSearches(
  queries: string[],
  tavilyKey: string,
): Promise<{ results: TavilyResult[]; answer?: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

  try {
    const fetches = queries.map(async (query) => {
      try {
        const res = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: tavilyKey,
            query,
            max_results: TAVILY_MAX_RESULTS,
            search_depth: 'basic',
            include_answer: true,
            include_raw_content: false,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          console.error(`[SearchOrchestration] Tavily error ${res.status} for query: "${query}"`);
          return null;
        }

        return (await res.json()) as TavilyResponse;
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          console.warn(`[SearchOrchestration] Tavily search timed out for: "${query}"`);
        } else {
          console.error(`[SearchOrchestration] Tavily fetch error for: "${query}"`, err);
        }
        return null;
      }
    });

    const responses = await Promise.all(fetches);

    // Collect all results and pick the best answer
    const allResults: TavilyResult[] = [];
    let bestAnswer: string | undefined;

    for (const resp of responses) {
      if (!resp) continue;
      if (resp.answer && !bestAnswer) bestAnswer = resp.answer;
      if (resp.results) allResults.push(...resp.results);
    }

    return { results: allResults, answer: bestAnswer };
  } finally {
    clearTimeout(timeout);
  }
}

// =============================================================================
// 4. RESULT RANKING & DEDUP
// =============================================================================

/**
 * Deduplicate by domain+path, rank by Tavily score, cap at MAX_SOURCES.
 */
function rankAndDeduplicate(results: TavilyResult[]): SearchSource[] {
  // Deduplicate by URL (exact match) and by domain (keep best per domain, max 2 per domain)
  const seenUrls = new Set<string>();
  const domainCounts = new Map<string, number>();

  const unique: (TavilyResult & { _score: number })[] = [];

  for (const r of results) {
    if (!r.url) continue;
    const normalizedUrl = r.url.replace(/\/+$/, '').toLowerCase();
    if (seenUrls.has(normalizedUrl)) continue;
    seenUrls.add(normalizedUrl);

    // Limit per domain to ensure diversity
    let domain: string;
    try {
      domain = new URL(r.url).hostname.replace(/^www\./, '');
    } catch {
      domain = r.url;
    }

    const count = domainCounts.get(domain) ?? 0;
    if (count >= 2) continue; // max 2 results per domain
    domainCounts.set(domain, count + 1);

    unique.push({
      ...r,
      _score: r.score ?? 0,
    });
  }

  // Sort by Tavily relevance score (descending)
  unique.sort((a, b) => b._score - a._score);

  return unique.slice(0, MAX_SOURCES).map((r) => ({
    title: r.title || r.url,
    url: r.url,
    snippet: (r.content ?? '').slice(0, MAX_SNIPPET_LENGTH),
  }));
}

// =============================================================================
// 5. FORMAT SEARCH CONTEXT FOR SYSTEM PROMPT
// =============================================================================

/**
 * Build a compact, numbered search context block for injection into the
 * system prompt. The LLM should reference these naturally.
 */
function formatSearchContext(sources: SearchSource[], answer?: string): string {
  if (sources.length === 0) return '';

  const lines: string[] = [
    '[Web Search Results]',
    '',
  ];

  if (answer) {
    lines.push(`Summary: ${answer}`, '');
  }

  lines.push('Sources:');
  sources.forEach((s, i) => {
    lines.push(`[${i + 1}] ${s.title}`);
    lines.push(`    URL: ${s.url}`);
    if (s.snippet) {
      lines.push(`    ${s.snippet}`);
    }
    lines.push('');
  });

  lines.push(
    'Instructions: Use the above search results to inform your response. ' +
    'You may reference them naturally but do not list all sources at the end. ' +
    'Focus on providing a clear, helpful answer grounded in the search results.',
  );

  return lines.join('\n');
}

// =============================================================================
// 6. MAIN ENTRY POINT
// =============================================================================

/**
 * Orchestrate a web search for the given user message.
 *
 * Returns `null` if:
 *  - The message doesn't warrant a search
 *  - No tavilyKey is provided
 *  - All searches failed
 *
 * @param message   The latest user message text
 * @param tavilyKey The user's Tavily API key
 */
export async function orchestrateSearch(
  message: string,
  tavilyKey: string,
): Promise<SearchResult | null> {
  // Guard: no key → no search
  if (!tavilyKey?.trim()) return null;

  // 1. Intent detection
  if (!shouldSearch(message)) {
    console.log('[SearchOrchestration] Skipping search — no search intent detected');
    return null;
  }

  // 2. Generate queries
  const queries = generateSearchQueries(message);
  if (queries.length === 0) return null;

  console.log('[SearchOrchestration] Searching with queries:', queries);

  // 3. Execute searches
  const { results, answer } = await executeSearches(queries, tavilyKey);

  if (results.length === 0) {
    console.warn('[SearchOrchestration] No results returned from Tavily');
    return null;
  }

  // 4. Rank & deduplicate
  const sources = rankAndDeduplicate(results);

  if (sources.length === 0) {
    console.warn('[SearchOrchestration] No valid sources after dedup');
    return null;
  }

  console.log(`[SearchOrchestration] Found ${sources.length} sources`);

  // 5. Format context for system prompt
  const searchContext = formatSearchContext(sources, answer);

  return {
    searchContext,
    sources,
    queriesUsed: queries,
  };
}
