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
  temperature?: number;
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
  
  return (modelId: string): LanguageModelV3 => {
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

        // Use the top-level instructions field for system content
        const instructions = systemParts.length > 0 ? systemParts.join('\n\n') : undefined;

        const requestBody: PerplexityAgentRequestBody = {
          model: modelId,
          input: messages,
          ...(instructions ? { instructions } : {}),
          max_output_tokens: settings.maxOutputTokens,
          temperature: settings.temperature,
          stream: false,
          tools: [{ type: 'web_search' }],
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
            for (const result of item.results) {
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

        // Use the top-level instructions field for system content
        const instructions = systemParts.length > 0 ? systemParts.join('\n\n') : undefined;

        const requestBody: PerplexityAgentRequestBody = {
          model: modelId,
          input: messages,
          ...(instructions ? { instructions } : {}),
          max_output_tokens: settings.maxOutputTokens,
          temperature: settings.temperature,
          stream: true,
          tools: [{ type: 'web_search' }],
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
        const citations: Array<{ id: number; title: string; url: string; snippet?: string }> = [];

        const textPartId = `text-${Date.now()}`;

        return {
          stream: new ReadableStream({
            async start(controller) {
              try {
                let textStartSent = false;

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

                      // Check for errors
                      if (parsed.error) {
                        console.error('[perplexity-agent] API error in stream:', parsed.error);
                        throw new Error(`Perplexity Agent API error: ${JSON.stringify(parsed.error)}`);
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
                          controller.enqueue({
                            type: 'text-delta' as const,
                            id: textPartId,
                            delta: deltaText,
                          });
                        }
                      }

                      // Handle completion event - check multiple possible formats
                      if (parsed.type === 'response.completed' || parsed.type === 'done' || parsed.finish_reason) {
                        totalInputTokens = parsed.response?.usage?.input_tokens || parsed.usage?.input_tokens || 0;
                        totalOutputTokens = parsed.response?.usage?.output_tokens || parsed.usage?.output_tokens || 0;
                        
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
