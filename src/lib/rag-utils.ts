/**
 * Lightweight RAG utilities for Phase 3 retrieval.
 *
 * - Chunk KB files into manageable segments.
 * - Score chunks against a query with simple TF-IDF.
 * - Return top chunks as context payload.
 */

type RagFile = {
  id: string;
  name: string;
  content: string;
};

export type RagChunk = {
  id: string;
  fileId: string;
  fileName: string;
  content: string;
  tokenFreq: Map<string, number>;
  tokenCount: number;
};

export type RagIndex = {
  chunks: RagChunk[];
  idf: Map<string, number>;
  embeddings?: number[][];
  embeddingModel?: string;
};

type RagBuildOptions = {
  maxChars?: number;
  overlapChars?: number;
  maxTotalChunks?: number;
};

type RagQueryOptions = {
  maxChunks?: number;
  minScore?: number;
  maxChars?: number;
};

const DEFAULT_BUILD_OPTIONS: Required<RagBuildOptions> = {
  maxChars: 1400,
  overlapChars: 200,
  maxTotalChunks: 200,
};

const DEFAULT_QUERY_OPTIONS: Required<RagQueryOptions> = {
  maxChunks: 6,
  minScore: 0.15,
  maxChars: 5000,
};

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for', 'from', 'has',
  'have', 'if', 'in', 'is', 'it', 'its', 'of', 'on', 'or', 'that', 'the', 'to',
  'was', 'were', 'will', 'with', 'this', 'these', 'those', 'you', 'your', 'we',
]);

function tokenize(text: string): string[] {
  const normalized = text.toLowerCase();
  const tokens = normalized.match(/[a-z0-9]+/g) || [];
  return tokens.filter((token) => token.length > 1 && !STOPWORDS.has(token));
}

function buildTokenFreq(tokens: string[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const token of tokens) {
    freq.set(token, (freq.get(token) || 0) + 1);
  }
  return freq;
}

function chunkText(text: string, maxChars: number, overlapChars: number): string[] {
  const normalized = text.replace(/\r\n/g, '\n');
  if (normalized.length <= maxChars) return [normalized];

  const paragraphs = normalized.split(/\n{2,}/g);
  const chunks: string[] = [];
  let buffer = '';

  const flushBuffer = () => {
    const trimmed = buffer.trim();
    if (trimmed) chunks.push(trimmed);
    buffer = '';
  };

  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) continue;

    if (paragraph.length > maxChars) {
      if (buffer) flushBuffer();
      let start = 0;
      while (start < paragraph.length) {
        const end = Math.min(start + maxChars, paragraph.length);
        const slice = paragraph.slice(start, end).trim();
        if (slice) chunks.push(slice);
        start = end - overlapChars;
        if (start < 0) start = 0;
        if (start >= paragraph.length) break;
      }
      continue;
    }

    if ((buffer + '\n\n' + paragraph).length > maxChars) {
      flushBuffer();
    }

    buffer = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
  }

  flushBuffer();

  if (overlapChars > 0 && chunks.length > 1) {
    const overlapped: string[] = [];
    for (let i = 0; i < chunks.length; i += 1) {
      const chunk = chunks[i];
      if (i === 0) {
        overlapped.push(chunk);
        continue;
      }
      const prev = chunks[i - 1];
      const overlap = prev.slice(-overlapChars);
      overlapped.push(`${overlap}\n${chunk}`.trim());
    }
    return overlapped;
  }

  return chunks;
}

function buildIdf(chunks: RagChunk[]): Map<string, number> {
  const docCount = chunks.length;
  const docFreq = new Map<string, number>();

  for (const chunk of chunks) {
    for (const token of chunk.tokenFreq.keys()) {
      docFreq.set(token, (docFreq.get(token) || 0) + 1);
    }
  }

  const idf = new Map<string, number>();
  for (const [token, df] of docFreq.entries()) {
    const score = Math.log((1 + docCount) / (1 + df)) + 1;
    idf.set(token, score);
  }
  return idf;
}

export function buildRagIndex(files: RagFile[], options?: RagBuildOptions): RagIndex {
  const opts = { ...DEFAULT_BUILD_OPTIONS, ...options };
  const chunks: RagChunk[] = [];

  for (const file of files) {
    if (!file.content.trim()) continue;

    const pieces = chunkText(file.content, opts.maxChars, opts.overlapChars);
    for (let i = 0; i < pieces.length; i += 1) {
      if (chunks.length >= opts.maxTotalChunks) break;
      const content = pieces[i].trim();
      if (!content) continue;
      const tokens = tokenize(content);
      const tokenFreq = buildTokenFreq(tokens);
      chunks.push({
        id: `${file.id}-${i}`,
        fileId: file.id,
        fileName: file.name,
        content,
        tokenFreq,
        tokenCount: tokens.length,
      });
    }
    if (chunks.length >= opts.maxTotalChunks) break;
  }

  return {
    chunks,
    idf: buildIdf(chunks),
  };
}

export function attachEmbeddings(
  index: RagIndex,
  embeddings: number[][],
  modelId: string
): RagIndex {
  if (embeddings.length !== index.chunks.length) {
    return index;
  }

  return {
    ...index,
    embeddings,
    embeddingModel: modelId,
  };
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function scoreChunk(
  chunk: RagChunk,
  queryFreq: Map<string, number>,
  idf: Map<string, number>
): number {
  let score = 0;
  for (const [token, qtf] of queryFreq.entries()) {
    const tf = chunk.tokenFreq.get(token) || 0;
    if (!tf) continue;
    score += qtf * tf * (idf.get(token) || 1);
  }

  if (chunk.tokenCount > 0) {
    score = score / Math.sqrt(chunk.tokenCount);
  }

  return score;
}

export function buildKnowledgeBaseContext(
  index: RagIndex,
  query: string,
  options?: RagQueryOptions,
  queryEmbedding?: number[]
): { text: string; chunksUsed: number } | null {
  const opts = { ...DEFAULT_QUERY_OPTIONS, ...options };
  if (index.chunks.length === 0) return null;

  const useEmbeddings = Boolean(queryEmbedding && index.embeddings?.length);
  const queryTokens = useEmbeddings ? [] : tokenize(query);
  if (!useEmbeddings && queryTokens.length === 0) return null;

  const scored = index.chunks
    .map((chunk, idx) => {
      if (useEmbeddings && index.embeddings) {
        const embedding = index.embeddings[idx] || [];
        return {
          chunk,
          score: cosineSimilarity(queryEmbedding || [], embedding),
        };
      }

      const queryFreq = buildTokenFreq(queryTokens);
      return {
        chunk,
        score: scoreChunk(chunk, queryFreq, index.idf),
      };
    })
    .filter((entry) => entry.score >= opts.minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, opts.maxChunks);

  if (scored.length === 0) return null;

  const parts: string[] = [];
  let totalChars = 0;
  let usedCount = 0;

  for (let i = 0; i < scored.length; i += 1) {
    const { chunk } = scored[i];
    const nextText = `File: ${chunk.fileName}\nExcerpt ${i + 1}:\n${chunk.content}`;
    if (totalChars + nextText.length > opts.maxChars) break;
    parts.push(nextText);
    totalChars += nextText.length;
    usedCount += 1;
  }

  if (parts.length === 0) return null;

  const text = parts.join('\n\n');

  return {
    text,
    chunksUsed: usedCount,
  };
}
