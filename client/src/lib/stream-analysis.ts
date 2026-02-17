export interface StreamAnalysisOptions {
  ticker: string;
  mode?: string;
}

export interface StreamAnalysisCallbacks {
  onMode?: (mode: string) => void;
  onProgress?: (progress: number, message: string) => void;
  onContent?: (chunk: string, fullContent: string) => void;
  onRecommendation?: (recommendation: any) => void;
  onDone?: (fullContent: string, recommendation?: any) => void;
  onError?: (error: string) => void;
}

export class StreamError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "StreamError";
  }
}

export async function streamAnalysis(
  options: StreamAnalysisOptions,
  callbacks: StreamAnalysisCallbacks,
  abortSignal?: AbortSignal,
): Promise<void> {
  const apiKey = import.meta.env.VITE_API_KEY || "";
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["x-api-key"] = apiKey;
  const response = await fetch("/api/fundamental-analysis/analyze/stream", {
    method: "POST",
    headers,
    credentials: "include",
    body: JSON.stringify({
      ticker: options.ticker.toUpperCase(),
      mode: options.mode,
    }),
    signal: abortSignal,
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new StreamError(429, "Daily limit reached");
    }
    let message = "Stream request failed";
    try {
      const body = await response.json();
      message = body.message || body.error || message;
    } catch {
      // ignore parse errors
    }
    throw new StreamError(response.status, message);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new StreamError(0, "No response body");

  const decoder = new TextDecoder();
  let fullContent = "";
  let recommendation: any = null;
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      // Keep the last incomplete line in the buffer
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;

        if (line.startsWith("data: ")) {
          const dataStr = line.slice(6).trim();
          if (dataStr === "[DONE]") {
            callbacks.onDone?.(fullContent, recommendation);
            return;
          }

          try {
            const data = JSON.parse(dataStr);
            const eventType = data.type || data.event;

            switch (eventType) {
              case "mode":
                callbacks.onMode?.(data.mode);
                break;
              case "progress":
                callbacks.onProgress?.(data.progress ?? 0, data.message || data.step || "");
                break;
              case "content": {
                const chunk = data.content || data.text;
                if (chunk) {
                  fullContent += chunk;
                  callbacks.onContent?.(chunk, fullContent);
                }
                break;
              }
              case "recommendation":
                recommendation = data.recommendation || data.data || data;
                callbacks.onRecommendation?.(recommendation);
                break;
              case "done":
                callbacks.onDone?.(fullContent, recommendation);
                return;
              case "error":
                callbacks.onError?.(data.message || data.error || "Stream error");
                return;
              default: {
                // If no type field, check for content directly
                const fallbackChunk = data.content || data.text;
                if (fallbackChunk) {
                  fullContent += fallbackChunk;
                  callbacks.onContent?.(fallbackChunk, fullContent);
                }
                if (data.done) {
                  callbacks.onDone?.(fullContent, recommendation);
                  return;
                }
                break;
              }
            }
          } catch {
            // Ignore JSON parse errors for malformed lines
          }
        }
      }
    }

    // If stream ends without explicit done event, fire done callback
    callbacks.onDone?.(fullContent, recommendation);
  } finally {
    reader.releaseLock();
  }
}
