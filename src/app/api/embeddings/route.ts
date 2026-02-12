/**
 * Embeddings API Route
 *
 * Proxy for OpenAI embeddings using BYOK.
 */

interface EmbeddingsRequestBody {
  apiKey: string;
  texts: string[];
  model?: string;
}

interface EmbeddingsResponseBody {
  embeddings: number[][];
  model: string;
  usage?: {
    totalTokens: number;
  };
}

function createErrorResponse(message: string, code: string, status: number): Response {
  return Response.json({ error: message, code }, { status });
}

export async function POST(req: Request): Promise<Response> {
  try {
    const body = await req.json() as EmbeddingsRequestBody;
    const { apiKey, texts, model } = body;

    if (!apiKey) {
      return createErrorResponse('API key is required.', 'MISSING_API_KEY', 401);
    }

    if (!texts || texts.length === 0) {
      return createErrorResponse('Texts array is required.', 'INVALID_REQUEST', 400);
    }

    const embeddingModel = model || 'text-embedding-3-small';

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: embeddingModel,
        input: texts,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return createErrorResponse(
        `Embeddings request failed: ${errorText}`,
        'EMBEDDINGS_ERROR',
        response.status
      );
    }

    const data = await response.json() as {
      data?: Array<{ embedding?: number[] }>;
      usage?: { total_tokens?: number };
    };

    if (!data.data || !Array.isArray(data.data)) {
      return createErrorResponse(
        'Unexpected response format from OpenAI embeddings API.',
        'INVALID_RESPONSE',
        502
      );
    }

    // Safely extract embeddings with error handling
    let embeddings: number[][];
    try {
      embeddings = data.data.map((item, index) => {
        if (!item.embedding || !Array.isArray(item.embedding)) {
          console.error(`[Embeddings API] Missing embedding at index ${index}:`, item);
          throw new Error(`Missing embedding in response item at index ${index}`);
        }
        return item.embedding;
      });
    } catch (error) {
      console.error('[Embeddings API] Failed to extract embeddings:', error);
      return createErrorResponse(
        'Malformed embeddings in OpenAI response.',
        'INVALID_EMBEDDINGS',
        502
      );
    }

    const payload: EmbeddingsResponseBody = {
      embeddings,
      model: embeddingModel,
      usage: data.usage?.total_tokens ? { totalTokens: data.usage.total_tokens } : undefined,
    };

    return Response.json(payload);
  } catch (error) {
    console.error('[Embeddings API Error]', error);
    return createErrorResponse('Unexpected embeddings error.', 'UNKNOWN_ERROR', 500);
  }
}