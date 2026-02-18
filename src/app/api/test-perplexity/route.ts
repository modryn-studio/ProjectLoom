/**
 * Perplexity API Diagnostic Endpoint
 *
 * POST /api/test-perplexity
 * Body: { apiKey: string, model?: string }
 *
 * Makes a minimal non-streaming request to Perplexity and returns
 * the raw response (or error) so you can confirm your API key and
 * chosen model work end-to-end without any SDK layers.
 * Tests both with and without the web_search tool to isolate issues.
 */

export const runtime = 'nodejs';

export async function POST(req: Request) {
  let body: { apiKey?: string; model?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { apiKey, model = 'anthropic/claude-sonnet-4-5' } = body;
  if (!apiKey) {
    return Response.json({ error: 'apiKey is required in request body' }, { status: 400 });
  }

  const baseRequestBody = {
    model,
    input: [
      {
        type: 'message',
        role: 'user',
        content: 'Say exactly: "API test OK"',
      },
    ],
    max_output_tokens: 20,
    stream: false,
  };

  async function callPerplexity(extraFields: Record<string, unknown>) {
    const rb = { ...baseRequestBody, ...extraFields };
    console.log('[test-perplexity] Request:', JSON.stringify(rb, null, 2));
    const r = await fetch('https://api.perplexity.ai/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(rb),
    });
    const responseText = await r.text();
    let parsed: unknown;
    try { parsed = JSON.parse(responseText); } catch { parsed = responseText; }
    return { httpStatus: r.status, response: parsed };
  }

  const [withTools, withoutTools] = await Promise.allSettled([
    callPerplexity({ tools: [{ type: 'web_search' }] }),
    callPerplexity({}),
  ]);

  return Response.json({
    model,
    withTools: withTools.status === 'fulfilled' ? withTools.value : { error: String((withTools as PromiseRejectedResult).reason) },
    withoutTools: withoutTools.status === 'fulfilled' ? withoutTools.value : { error: String((withoutTools as PromiseRejectedResult).reason) },
  });
}
