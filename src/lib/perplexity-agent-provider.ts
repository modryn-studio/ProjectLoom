/**
 * Custom Perplexity Agent API Provider for Vercel AI SDK
 * 
 * Wraps the Perplexity Agent API to work with Vercel AI SDK's streamText and generateText.
 * The Agent API supports third-party models (Claude, GPT, Gemini) unlike the regular
 * Perplexity API which only supports Sonar models.
 * 
 * API Endpoint: https://api.perplexity.ai/v1/responses
 * Docs: https://docs.perplexity.ai/docs/agent-api/models
 * 
 * @version 1.0.0
 */

import type { LanguageModelV3, LanguageModelV3CallOptions } from '@ai-sdk/provider';

interface PerplexityAgentMessage {
  type: 'message';
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{ type: string; text?: string; image?: string; mimeType?: string }>;
}

interface PerplexityAgentRequestBody {
  model: string;
  input: Array<PerplexityAgentMessage> | string;
  instructions?: string;
  max_output_tokens?: number;
  // Note: the /v1/responses endpoint does NOT support a temperature parameter.
  // Sending it causes in-stream 500 errors when forwarded to upstream providers.
  stream?: boolean;
  tools?: Array<{ type: string; user_location?: { latitude: number; longitude: number; country?: string; city?: string; region?: string } }>;
}

interface PerplexityAgentResponse {
  id: string;
  model: string;
  created_at: number;
  status: 'completed' | 'failed'  | 'in_progress';
  output: Array<{
    type: 'message';
    id: string;
    role: 'assistant';
    status: 'completed';
    content: Array<{
      type: 'output_text';
      text: string;
      annotations?: Array<{
        start_index: number;
        end_index: number;
        title: string;
        url: string;
        type?: string;
      }>;
    }>;
  } | {
    type: 'search_results';
    results: Array<{
      id: number;
      title: string;
      url: string;
      snippet?: string;
      date?: string;
      source?: string;
    }>;
  }>;
  usage?: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    cost?: {
      currency: string;
      input_cost: number;
      output_cost: number;
      total_cost: number;
      cache_creation_cost?: number;
      cache_read_cost?: number;
      tool_calls_cost?: number;
    };
    input_tokens_details?: {
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    };
  };
  error?: {
    message: string;
    code: string;
    type: string;
  };
}

/**
 * Create a Perplexity Agent API client for Vercel AI SDK
 */
export function createPerplexityAgent(config: { apiKey: string; baseURL?: string }) {
  const baseURL = config.baseURL || 'https://api.perplexity.ai';
  
  return (modelId: string, modelOptions?: { webSearch?: boolean }): LanguageModelV3 => {
    // Default to false — callers opt in explicitly.
    // The chat route passes { webSearch: true } for all models so the LLM can
    // invoke the tool when it needs current information (training cutoff coverage).
    // generate-title keeps it false since that is a simple deterministic task.
    const enableWebSearch = modelOptions?.webSearch ?? false;
    return {
      specificationVersion: 'v3',
      provider: 'perplexity-agent',
      modelId,
      supportedUrls: {},

      async doGenerate(options: LanguageModelV3CallOptions) {
        const { prompt, ...settings } = options;
        
        // Extract system messages for the instructions field
        // and convert remaining messages to Perplexity Agent API format
        const systemParts: string[] = [];
        const messages: PerplexityAgentMessage[] = [];
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const msg of prompt as any[]) {
          if (msg.role === 'system') {
            // Collect system messages for the top-level instructions field
            systemParts.push(typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content));
            continue;
          }

          // User/assistant messages have content as array
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const contentParts = msg.content.map((part: any) => {
            if (part.type === 'text') {
              return { _isText: true, text: part.text };
            } else if (part.type === 'image') {
              return {
                _isText: false,
                type: 'image',
                image: part.image.toString(),
                mimeType: part.mimeType,
              };
            }
            return null;
          }).filter(Boolean);

          // If only text parts, join into a single string. Otherwise, keep as array for multimodal.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const hasNonText = contentParts.some((p: any) => !p._isText);
          const content = hasNonText 
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ? contentParts.map((p: any) => {
                const { _isText, ...rest } = p;
                return _isText ? { type: 'text', text: rest.text } : rest;
              })
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            : contentParts.map((p: any) => p.text).join('');

          // Skip messages with empty content (API validation requires non-empty content)
          const isEmpty = Array.isArray(content) ? content.length === 0 : content === '';
          if (isEmpty) {
            console.warn('[perplexity-agent] Skipping message with empty content at index', messages.length);
            continue;
          }

          messages.push({
            type: 'message' as const,
            role: msg.role as 'user' | 'assistant',
            content,
          });
        }

        // Use the top-level instructions field for system content.
        // When web_search is enabled, append Perplexity-recommended tool usage guidance
        // so the model knows when and how to invoke the tool (per docs recommendation).
        const WEB_SEARCH_INSTRUCTIONS = `\n\n## Tool Usage\nYou have access to a web_search tool. Use it when the query requires current information, recent events, real-time data, or anything that may have changed since your training cutoff. Use 1 query for simple questions. Keep queries brief: 2-5 words. NEVER ask permission to search — just search when appropriate. After searching, provide a full, detailed response synthesizing the results.`;
        const baseInstructions = systemParts.length > 0 ? systemParts.join('\n\n') : undefined;
        const instructions = enableWebSearch && baseInstructions
          ? baseInstructions + WEB_SEARCH_INSTRUCTIONS
          : enableWebSearch
          ? WEB_SEARCH_INSTRUCTIONS.trim()
          : baseInstructions;

        const requestBody: PerplexityAgentRequestBody = {
          model: modelId,
          input: messages,
          ...(instructions ? { instructions } : {}),
          max_output_tokens: settings.maxOutputTokens,
          stream: false,
          ...(enableWebSearch ? { tools: [{ type: 'web_search' }] } : {}),
        };

        console.log('[perplexity-agent] Generate request:', {
          model: modelId,
          messageCount: messages.length,
          hasInstructions: !!instructions,
          instructionsPreview: instructions?.substring(0, 200),
        });

        const response = await fetch(`${baseURL}/v1/responses`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Perplexity Agent API error: ${response.status} - ${errorText}`);
        }

        const data: PerplexityAgentResponse = await response.json();

        if (data.status === 'failed') {
          throw new Error(data.error?.message || 'Unknown error from Perplexity Agent API');
        }

        if (!data.output || !Array.isArray(data.output)) {
          throw new Error('Invalid response format: missing output array');
        }

        const textContent = data.output
          .filter((item) => item.type === 'message')
          .flatMap((item) => item.content)
          .filter((content) => content.type === 'output_text')
          .map((content) => content.text)
          .join('');

        // Extract citations from output (both search_results and annotations)
        const citations: Array<{ title: string; url: string }> = [];
        const seenUrls = new Set<string>();
        
        for (const item of data.output) {
          // Extract from search_results items
          if (item.type === 'search_results') {
            for (const result of (item.results ?? [])) {
              if (!seenUrls.has(result.url)) {
                citations.push({ title: result.title, url: result.url });
                seenUrls.add(result.url);
              }
            }
          }
          // Extract from annotations within message content
          else if (item.type === 'message') {
            for (const content of item.content) {
              if (content.annotations) {
                for (const annotation of content.annotations) {
                  if (!seenUrls.has(annotation.url)) {
                    citations.push({ title: annotation.title, url: annotation.url });
                    seenUrls.add(annotation.url);
                  }
                }
              }
            }
          }
        }

        // Citations are appended as markdown. The chat API will extract them
        // and pass through metadata for dropdown UI display.
        let finalText = textContent;
        if (citations.length > 0) {
          const citationText = '\n\n---\n\n**Sources:**\n\n' + 
            citations.map((c, i) => `${i + 1}. [${c.title}](${c.url})`).join('\n');
          finalText += citationText;
        }

        return {
          content: [{ type: 'text', text: finalText }],
          finishReason: { unified: 'stop' as const, raw: 'stop' },
          usage: {
            inputTokens: { total: data.usage?.input_tokens || 0, noCache: undefined, cacheRead: undefined, cacheWrite: undefined },
            outputTokens: { total: data.usage?.output_tokens || 0, text: undefined, reasoning: undefined },
          },
          rawCall: {
            rawPrompt: messages,
            rawSettings: settings,
          },
          rawResponse: {
            headers: {},
          },
          warnings: [],
          request: {
            body: JSON.stringify(requestBody),
          },
          providerMetadata: {
            perplexity: {
              cost: data.usage?.cost ?? null,
              inputTokensDetails: data.usage?.input_tokens_details ?? null,
            },
          },
        };
      },

      async doStream(options: LanguageModelV3CallOptions) {
        const { prompt, ...settings } = options;
        
        // Extract system messages for the instructions field
        // and convert remaining messages to Perplexity Agent API format
        const systemParts: string[] = [];
        const messages: PerplexityAgentMessage[] = [];
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const msg of prompt as any[]) {
          if (msg.role === 'system') {
            // Collect system messages for the top-level instructions field
            systemParts.push(typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content));
            continue;
          }

          // User/assistant messages have content as array
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const contentParts = msg.content.map((part: any) => {
            if (part.type === 'text') {
              return { _isText: true, text: part.text };
            } else if (part.type === 'image') {
              return {
                _isText: false,
                type: 'image',
                image: part.image.toString(),
                mimeType: part.mimeType,
              };
            }
            return null;
          }).filter(Boolean);

          // If only text parts, join into a single string. Otherwise, keep as array for multimodal.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const hasNonText = contentParts.some((p: any) => !p._isText);
          const content = hasNonText 
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ? contentParts.map((p: any) => {
                const { _isText, ...rest } = p;
                return _isText ? { type: 'text', text: rest.text } : rest;
              })
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            : contentParts.map((p: any) => p.text).join('');

          // Skip messages with empty content (API validation requires non-empty content)
          const isEmpty = Array.isArray(content) ? content.length === 0 : content === '';
          if (isEmpty) {
            console.warn('[perplexity-agent] Skipping message with empty content at index', messages.length);
            continue;
          }

          messages.push({
            type: 'message' as const,
            role: msg.role as 'user' | 'assistant',
            content,
          });
        }

        // Use the top-level instructions field for system content.
        // When web_search is enabled, append Perplexity-recommended tool usage guidance
        // so the model knows when and how to invoke the tool (per docs recommendation).
        const WEB_SEARCH_INSTRUCTIONS = `\n\n## Tool Usage\nYou have access to a web_search tool. Use it when the query requires current information, recent events, real-time data, or anything that may have changed since your training cutoff. Use 1 query for simple questions. Keep queries brief: 2-5 words. NEVER ask permission to search — just search when appropriate. After searching, provide a full, detailed response synthesizing the results.`;
        const baseInstructions = systemParts.length > 0 ? systemParts.join('\n\n') : undefined;
        const instructions = enableWebSearch && baseInstructions
          ? baseInstructions + WEB_SEARCH_INSTRUCTIONS
          : enableWebSearch
          ? WEB_SEARCH_INSTRUCTIONS.trim()
          : baseInstructions;

        const requestBody: PerplexityAgentRequestBody = {
          model: modelId,
          input: messages,
          ...(instructions ? { instructions } : {}),
          max_output_tokens: settings.maxOutputTokens,
          stream: true,
          ...(enableWebSearch ? { tools: [{ type: 'web_search' }] } : {}),
        };

        console.log('[perplexity-agent] Stream request:', {
          model: modelId,
          messageCount: messages.length,
          hasInstructions: !!instructions,
          instructionsLength: instructions?.length || 0,
          instructionsPreview: instructions?.substring(0, 200),
        });

        const response = await fetch(`${baseURL}/v1/responses`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Perplexity Agent API error: ${response.status} - ${errorText}`);
        }

        if (!response.body) {
          throw new Error('No response body');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let totalInputTokens = 0;
        let totalOutputTokens = 0;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let costData: any = null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let inputTokensDetails: any = null;
        const citations: Array<{ id: number; title: string; url: string; snippet?: string }> = [];

        const textPartId = `text-${Date.now()}`;

        return {
          stream: new ReadableStream({
            async start(controller) {
              try {
                let textStartSent = false;
                let streamedText = ''; // track what's been sent as deltas

                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;

                  buffer += decoder.decode(value, { stream: true });
                  const lines = buffer.split('\n');
                  buffer = lines.pop() || '';

                  for (const line of lines) {
                    if (!line.trim() || !line.startsWith('data: ')) continue;
                    
                    const data = line.slice(6);
                    if (data === '[DONE]') continue;

                    try {
                      const parsed = JSON.parse(data);

                      // Check for errors — rethrow so the outer catch surfaces them
                      // rather than letting the stream silently terminate.
                      // Perplexity uses multiple error formats:
                      //   { error: { message, type, code } }
                      //   { message, type: "internal_error", code: 500 }
                      //   { type: "response.failed", response: { status: "failed", error: {...} } }
                      const isError =
                        parsed.error != null ||
                        parsed.type === 'error' ||
                        parsed.type === 'internal_error' ||
                        (parsed.type === 'response.failed') ||
                        (typeof parsed.code === 'number' && parsed.code >= 400);
                      if (isError) {
                        const errorDetail =
                          parsed.error?.message ||
                          parsed.response?.error?.message ||
                          parsed.message ||
                          JSON.stringify(parsed);
                        console.error('[perplexity-agent] API error in stream:', parsed);
                        throw new Error(`Perplexity Agent API error: ${errorDetail}`);
                      }

                      // Handle delta events - check multiple possible formats
                      if (parsed.type === 'response.output_text.delta' || parsed.type === 'content.delta' || parsed.delta) {
                        // V3 protocol requires text-start before any text-delta
                        if (!textStartSent) {
                          controller.enqueue({
                            type: 'text-start' as const,
                            id: textPartId,
                          });
                          textStartSent = true;
                        }

                        const deltaText = parsed.delta || parsed.text || '';
                        if (deltaText) {
                          streamedText += deltaText;
                          controller.enqueue({
                            type: 'text-delta' as const,
                            id: textPartId,
                            delta: deltaText,
                          });
                        }
                      }

                      // Handle output_text.done — fires per output item.
                      // The `text` field is the FINAL FRAGMENT not yet delivered
                      // as deltas (not the cumulative total). Always append it.
                      // For models that fully streamed all text as deltas (e.g. Claude
                      // when no web search), this event arrives with text:"" — harmless.
                      if (parsed.type === 'response.output_text.done') {
                        const doneText: string = parsed.text ?? '';
                        if (doneText.length > 0) {
                          if (!textStartSent) {
                            controller.enqueue({ type: 'text-start' as const, id: textPartId });
                            textStartSent = true;
                          }
                          controller.enqueue({
                            type: 'text-delta' as const,
                            id: textPartId,
                            delta: doneText,
                          });
                          streamedText += doneText;
                        }
                      }

                      // Handle completion event - check multiple possible formats
                      if (parsed.type === 'response.completed' || parsed.type === 'done' || parsed.finish_reason) {
                        totalInputTokens = parsed.response?.usage?.input_tokens || parsed.usage?.input_tokens || 0;
                        totalOutputTokens = parsed.response?.usage?.output_tokens || parsed.usage?.output_tokens || 0;
                        costData = parsed.response?.usage?.cost || parsed.usage?.cost || null;
                        inputTokensDetails = parsed.response?.usage?.input_tokens_details || parsed.usage?.input_tokens_details || null;

                        // After a web_search tool call, Perplexity does NOT stream
                        // the post-search synthesis as output_text.delta events —
                        // the full response arrives only in the response.completed payload.
                        // Structure: response.output[] -> { type: 'message', content: [{ type: 'output_text', text }] }
                        // Detect the gap between what was streamed and the full text, emit the remainder.
                        const fullOutputText: string =
                          parsed.response?.output
                            ?.filter((o: {type: string}) => o.type === 'message')
                            ?.flatMap((o: {content: Array<{type: string; text?: string}>}) =>
                              o.content
                                ?.filter(c => c.type === 'output_text' || c.type === 'text')
                                .map(c => c.text ?? '')
                            )
                            ?.join('') || '';

                        if (fullOutputText.length > streamedText.length) {
                          const missingText = fullOutputText.slice(streamedText.length);
                          if (!textStartSent) {
                            controller.enqueue({ type: 'text-start' as const, id: textPartId });
                            textStartSent = true;
                          }
                          controller.enqueue({
                            type: 'text-delta' as const,
                            id: textPartId,
                            delta: missingText,
                          });
                          streamedText = fullOutputText;
                          console.log(`[perplexity-agent] Emitted ${missingText.length} chars of post-search text from response.completed`);
                        }
                        
                        // Extract citations from output array (both search_results and annotations)
                        if (parsed.response?.output && Array.isArray(parsed.response.output)) {
                          const seenUrls = new Set<string>();
                          
                          for (const item of parsed.response.output) {
                            // Extract from search_results items
                            if (item.type === 'search_results' && item.results) {
                              for (const result of item.results) {
                                if (!seenUrls.has(result.url)) {
                                  citations.push({
                                    id: result.id,
                                    title: result.title,
                                    url: result.url,
                                    snippet: result.snippet,
                                  });
                                  seenUrls.add(result.url);
                                }
                              }
                            }
                            // Extract from annotations within message content
                            else if (item.type === 'message' && item.content) {
                              for (const content of item.content) {
                                if (content.annotations) {
                                  for (const annotation of content.annotations) {
                                    if (!seenUrls.has(annotation.url)) {
                                      citations.push({
                                        id: citations.length + 1,
                                        title: annotation.title,
                                        url: annotation.url,
                                      });
                                      seenUrls.add(annotation.url);
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    } catch (e) {
                      // Re-throw intentional API errors so they surface to the client.
                      // Only swallow benign JSON parse failures for malformed SSE lines.
                      if (e instanceof Error && e.message.includes('Perplexity Agent API error:')) {
                        throw e;
                      }
                      console.warn('[PerplexityAgent] Failed to parse SSE event:', e);
                    }
                  }
                }

                // Close the text part if we opened one
                if (textStartSent) {
                  // Append citations as markdown. The chat API will extract them
                  // and pass through metadata for dropdown UI display.
                  if (citations.length > 0) {
                    const citationText = '\n\n---\n\n**Sources:**\n\n' + 
                      citations.map((c, i) => `${i + 1}. [${c.title}](${c.url})`).join('\n');
                    
                    controller.enqueue({
                      type: 'text-delta' as const,
                      id: textPartId,
                      delta: citationText,
                    });
                  }
                  
                  controller.enqueue({
                    type: 'text-end' as const,
                    id: textPartId,
                  });
                }

                // Send final usage data
                controller.enqueue({
                  type: 'finish' as const,
                  finishReason: { unified: 'stop' as const, raw: 'stop' },
                  usage: {
                    inputTokens: { total: totalInputTokens, noCache: undefined, cacheRead: undefined, cacheWrite: undefined },
                    outputTokens: { total: totalOutputTokens, text: undefined, reasoning: undefined },
                  },
                  providerMetadata: {
                    perplexity: {
                      cost: costData,
                      inputTokensDetails: inputTokensDetails,
                    },
                  },
                });

                controller.close();
              } catch (error) {
                controller.error(error);
              }
            },
          }),
          rawCall: {
            rawPrompt: messages,
            rawSettings: settings,
          },
          rawResponse: {
            headers: {},
          },
          warnings: [],
          request: {
            body: JSON.stringify(requestBody),
          },
        };
      },
    };
  };
}
