/**
 * Web Search API Route
 * 
 * Dedicated endpoint for web search using Tavily API.
 * Returns sources and summary before AI generation.
 * 
 * @version 1.0.0
 */

// =============================================================================
// TYPES
// =============================================================================

interface WebSearchRequest {
  query: string;
  maxResults?: number;
  tavilyKey: string;
}

interface WebSearchResponse {
  summary: string;
  sources: Array<{
    title: string;
    url: string;
  }>;
}

interface ErrorResponse {
  error: string;
  code: string;
}

// =============================================================================
// SEARCH HANDLER
// =============================================================================

export async function POST(req: Request): Promise<Response> {
  try {
    const body = await req.json() as WebSearchRequest;
    const { query, maxResults = 5, tavilyKey } = body;

    if (!query || query.trim().length < 3) {
      return Response.json(
        { error: 'Query must be at least 3 characters', code: 'INVALID_QUERY' } as ErrorResponse,
        { status: 400 }
      );
    }

    if (!tavilyKey || !tavilyKey.trim()) {
      return Response.json(
        { error: 'Tavily API key required', code: 'MISSING_API_KEY' } as ErrorResponse,
        { status: 400 }
      );
    }

    const cappedResults = Math.min(maxResults, 5);

    // 10 second timeout for web search
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      // Log what we're sending to Tavily (without exposing full key)
      console.log('[Web Search] Calling Tavily API:', {
        query,
        maxResults: cappedResults,
        keyPresent: !!tavilyKey,
        keyPrefix: tavilyKey.substring(0, 8) + '...',
      });

      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: tavilyKey,
          query,
          max_results: cappedResults,
          search_depth: 'advanced',
          include_answer: true,
          include_raw_content: false,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Try to get detailed error from Tavily
        let tavilyErrorDetails = '';
        try {
          const errorBody = await response.json();
          tavilyErrorDetails = JSON.stringify(errorBody);
          console.error('[Tavily Error Details]', errorBody);
        } catch {
          tavilyErrorDetails = await response.text();
          console.error('[Tavily Error Text]', tavilyErrorDetails);
        }

        const errorMsg = response.status === 401
          ? 'Invalid Tavily API key'
          : response.status === 400
          ? `Tavily rejected request: ${tavilyErrorDetails || 'Invalid request format'}`
          : `Tavily API error (status ${response.status})`;
        
        console.error('[Web Search] Tavily error:', response.status, errorMsg);
        
        return Response.json(
          { error: errorMsg, code: 'TAVILY_ERROR' } as ErrorResponse,
          { status: response.status }
        );
      }

      const data = await response.json() as {
        answer?: string;
        results?: Array<{ title?: string; url: string; content?: string }>;
      };

      const sources = (data.results ?? [])
        .filter((result) => result.url)
        .slice(0, cappedResults)
        .map((result) => ({
          title: result.title || result.url,
          url: result.url,
        }));

      const searchResponse: WebSearchResponse = {
        summary: data.answer || 'No results found.',
        sources,
      };

      return Response.json(searchResponse);
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        return Response.json(
          { error: 'Web search timed out after 10 seconds', code: 'TIMEOUT' } as ErrorResponse,
          { status: 408 }
        );
      }

      throw error;
    }
  } catch (error) {
    console.error('[Web Search API Error]', error);
    return Response.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' } as ErrorResponse,
      { status: 500 }
    );
  }
}

// =============================================================================
// OPTIONS HANDLER (CORS)
// =============================================================================

export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
