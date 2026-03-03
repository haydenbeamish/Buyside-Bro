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
  onPartialResult?: (content: string) => void;
}

export class StreamError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "StreamError";
  }
}

const STALL_TIMEOUT_MS = 30_000;

export async function streamAnalysis(
  options: StreamAnalysisOptions,
  callbacks: StreamAnalysisCallbacks,
  abortSignal?: AbortSignal,
): Promise<void> {
  const doStream = async (isRetry: boolean): Promise<void> => {
    const apiKey = import.meta.env.VITE_API_KEY || "";
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey) headers["x-api-key"] = apiKey;

    if (isRetry) {
      callbacks.onProgress?.(0, "Retrying connection...");
    }

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
    let stallTimer: ReturnType<typeof setTimeout> | null = null;
    let finished = false;

    const clearStall = () => {
      if (stallTimer) {
        clearTimeout(stallTimer);
        stallTimer = null;
      }
    };

    const fireDone = () => {
      if (finished) return;
      finished = true;
      clearStall();
      callbacks.onDone?.(fullContent, recommendation);
    };

    const fireError = (msg: string) => {
      if (finished) return;
      finished = true;
      clearStall();
      callbacks.onError?.(msg);
    };

    const resetStallTimer = () => {
      clearStall();
      stallTimer = setTimeout(() => {
        if (finished) return;
        // Stream has stalled — deliver partial results if we have any
        if (fullContent.length > 0) {
          callbacks.onPartialResult?.(fullContent);
          fireDone();
        } else {
          fireError("Stream stalled — no data received for 30 seconds");
        }
        reader.cancel().catch(() => {});
      }, STALL_TIMEOUT_MS);
    };

    try {
      resetStallTimer();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (finished) return; // stall timer already resolved

        resetStallTimer();
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        // Keep the last incomplete line in the buffer
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (finished) return;
          if (!line.trim()) continue;

          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6).trim();
            if (dataStr === "[DONE]") {
              fireDone();
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
                  fireDone();
                  return;
                case "error":
                  fireError(data.message || data.error || "Stream error");
                  return;
                default: {
                  // If no type field, check for content directly
                  const fallbackChunk = data.content || data.text;
                  if (fallbackChunk) {
                    fullContent += fallbackChunk;
                    callbacks.onContent?.(fallbackChunk, fullContent);
                  }
                  if (data.done) {
                    fireDone();
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

      // Stream ended without explicit done event
      fireDone();
    } catch (error) {
      clearStall();
      // Deliver partial results if we have content
      if (fullContent.length > 0 && !finished) {
        callbacks.onPartialResult?.(fullContent);
        fireDone();
      } else if (!finished) {
        throw error;
      }
    } finally {
      reader.releaseLock();
    }
  };

  try {
    await doStream(false);
  } catch (error) {
    // Auto-retry once on network errors (not 4xx client errors)
    if (
      error instanceof StreamError &&
      (error.status >= 400 && error.status < 500)
    ) {
      throw error; // Don't retry client errors (429, 400, etc.)
    }

    try {
      await doStream(true);
    } catch (retryError) {
      throw retryError;
    }
  }
}
