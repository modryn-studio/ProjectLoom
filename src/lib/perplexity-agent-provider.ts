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
        
        // Convert Vercel AI SDK messages to Perplexity Agent API format
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const messages: PerplexityAgentMessage[] = prompt.map((msg: any) => {
          // System messages have content as string in V3, others have array
          if (msg.role === 'system') {
            return {
              type: 'message' as const,
              role: 'system' as const,
              content: msg.content,
            };
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
          const hasNonText = contentParts.some((p: any) => !p._isText);
          const content = hasNonText 
            ? contentParts.map((p: any) => {
                const { _isText, ...rest } = p;
                return _isText ? { type: 'text', text: rest.text } : rest;
              })
            : contentParts.map((p: any) => p.text).join('');

          return {
            type: 'message' as const,
            role: msg.role as 'user' | 'assistant',
            content,
          };
        });

        const requestBody: PerplexityAgentRequestBody = {
          model: modelId,
          input: messages,
          max_output_tokens: settings.maxOutputTokens,
          temperature: settings.temperature,
          stream: false,
        };

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

        const textContent = data.output
          .filter((item) => item.type === 'message')
          .flatMap((item) => item.content)
          .filter((content) => content.type === 'output_text')
          .map((content) => content.text)
          .join('');

        return {
          content: [{ type: 'text', text: textContent }],
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
        
        // Convert Vercel AI SDK messages to Perplexity Agent API format
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const messages: PerplexityAgentMessage[] = prompt.map((msg: any) => {
          // System messages have content as string in V3, others have array
          if (msg.role === 'system') {
            return {
              type: 'message' as const,
              role: 'system' as const,
              content: msg.content,
            };
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
          const hasNonText = contentParts.some((p: any) => !p._isText);
          const content = hasNonText 
            ? contentParts.map((p: any) => {
                const { _isText, ...rest } = p;
                return _isText ? { type: 'text', text: rest.text } : rest;
              })
            : contentParts.map((p: any) => p.text).join('');

          return {
            type: 'message' as const,
            role: msg.role as 'user' | 'assistant',
            content,
          };
        });

        const requestBody: PerplexityAgentRequestBody = {
          model: modelId,
          input: messages,
          max_output_tokens: settings.maxOutputTokens,
          temperature: settings.temperature,
          stream: true,
        };

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

                      // Handle delta events
                      if (parsed.type === 'response.output_text.delta') {
                        // V3 protocol requires text-start before any text-delta
                        if (!textStartSent) {
                          controller.enqueue({
                            type: 'text-start' as const,
                            id: textPartId,
                          });
                          textStartSent = true;
                        }

                        controller.enqueue({
                          type: 'text-delta' as const,
                          id: textPartId,
                          delta: parsed.delta || '',
                        });
                      }

                      // Handle completion event
                      if (parsed.type === 'response.completed') {
                        totalInputTokens = parsed.response?.usage?.input_tokens || 0;
                        totalOutputTokens = parsed.response?.usage?.output_tokens || 0;
                      }
                    } catch (e) {
                      console.warn('[PerplexityAgent] Failed to parse SSE event:', e);
                    }
                  }
                }

                // Close the text part if we opened one
                if (textStartSent) {
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
