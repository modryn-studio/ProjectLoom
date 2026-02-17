/**
 * Client-Side Embeddings via Transformers.js
 *
 * Runs a small sentence-transformer model entirely in the browser
 * using ONNX Runtime (WASM). No external API keys needed.
 *
 * Model: Xenova/all-MiniLM-L6-v2 (quantized q8, ~17 MB, 384-dim)
 * - Downloads once, cached by the browser automatically
 * - Runs on CPU via WASM (fast enough for ≤200 chunks)
 *
 * @version 1.0.0
 */

// Lazy-loaded pipeline reference (singleton)
let pipelineInstance: EmbeddingPipeline | null = null;
let pipelineLoading: Promise<EmbeddingPipeline> | null = null;

/** Model to use for embeddings */
const EMBEDDING_MODEL_ID = 'Xenova/all-MiniLM-L6-v2';

/** Embedding dimensionality for this model */
export const EMBEDDING_DIMENSIONS = 384;

/** Human-readable model name for display */
export const EMBEDDING_MODEL_NAME = 'all-MiniLM-L6-v2';

// Typed subset of Transformers.js pipeline output
type EmbeddingPipeline = (
  texts: string[],
  options?: { pooling?: string; normalize?: boolean }
) => Promise<{ tolist: () => number[][] }>;

export type EmbeddingProgress = {
  status: 'initiate' | 'download' | 'progress' | 'done' | 'ready';
  name?: string;
  file?: string;
  progress?: number;
  loaded?: number;
  total?: number;
};

export type EmbeddingProgressCallback = (progress: EmbeddingProgress) => void;

/**
 * Get or initialize the embedding pipeline (singleton).
 * Downloads the model on first use (~17 MB), cached afterward.
 */
export async function getEmbeddingPipeline(
  onProgress?: EmbeddingProgressCallback
): Promise<EmbeddingPipeline> {
  // Return cached instance
  if (pipelineInstance) return pipelineInstance;

  // Return in-flight initialization
  if (pipelineLoading) return pipelineLoading;

  pipelineLoading = initializePipeline(onProgress);

  try {
    pipelineInstance = await pipelineLoading;
    return pipelineInstance;
  } catch (err) {
    // Reset so next call can retry
    pipelineLoading = null;
    throw err;
  }
}

async function initializePipeline(
  onProgress?: EmbeddingProgressCallback
): Promise<EmbeddingPipeline> {
  // Dynamic import to avoid SSR issues (this module is browser-only)
  const { pipeline, env } = await import('@huggingface/transformers');

  // Disable local model check — always fetch from HF Hub / browser cache
  env.allowLocalModels = false;

  const extractor = await pipeline(
    'feature-extraction',
    EMBEDDING_MODEL_ID,
    {
      dtype: 'q8' as never,          // quantized for smaller download + faster inference
      progress_callback: onProgress
        ? (data: EmbeddingProgress) => {
            onProgress(data);
          }
        : undefined,
    }
  );

  // Wrap the pipeline to match our typed API
  return async (
    texts: string[],
    options?: { pooling?: string; normalize?: boolean }
  ) => {
    const result = await extractor(texts, {
      pooling: (options?.pooling ?? 'mean') as never,
      normalize: options?.normalize ?? true,
    });
    return result as unknown as { tolist: () => number[][] };
  };
}

/**
 * Embed an array of texts and return their embedding vectors.
 */
export async function embedTexts(
  texts: string[],
  onProgress?: EmbeddingProgressCallback
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const pipe = await getEmbeddingPipeline(onProgress);

  // Process in batches to avoid memory issues with large chunk sets
  const BATCH_SIZE = 32;
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const output = await pipe(batch, { pooling: 'mean', normalize: true });
    const batchEmbeddings = output.tolist();
    allEmbeddings.push(...batchEmbeddings);
  }

  return allEmbeddings;
}

/**
 * Embed a single query text for similarity search.
 */
export async function embedQuery(
  query: string,
  onProgress?: EmbeddingProgressCallback
): Promise<number[]> {
  const embeddings = await embedTexts([query], onProgress);
  return embeddings[0] || [];
}

/**
 * Check if the embedding model is loaded in memory.
 */
export function isModelLoaded(): boolean {
  return pipelineInstance !== null;
}

/**
 * Dispose of the cached pipeline to free memory.
 */
export async function disposeEmbeddingPipeline(): Promise<void> {
  if (pipelineInstance) {
    // The pipeline doesn't have a formal dispose method,
    // so we just release the reference for GC.
    pipelineInstance = null;
  }
  pipelineLoading = null;
}
