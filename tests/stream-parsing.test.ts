import { describe, it, expect, vi } from "vitest";

// Re-implement the SSE line parsing logic from stream-analysis.ts for unit testing
// This tests the core parsing without needing a real fetch/ReadableStream

function parseSSELine(line: string): { type: string; data: any } | null {
  if (!line.trim()) return null;
  if (!line.startsWith("data: ")) return null;

  const dataStr = line.slice(6).trim();
  if (dataStr === "[DONE]") return { type: "done_signal", data: null };

  try {
    const data = JSON.parse(dataStr);
    const eventType = data.type || data.event;
    return { type: eventType || "unknown", data };
  } catch {
    return null; // malformed JSON
  }
}

function processSSEBuffer(buffer: string): { lines: string[]; remaining: string } {
  const lines = buffer.split("\n");
  const remaining = lines.pop() || "";
  return { lines, remaining };
}

describe("SSE Line Parsing", () => {
  it("parses content event", () => {
    const result = parseSSELine('data: {"type":"content","content":"Hello"}');
    expect(result).toEqual({ type: "content", data: { type: "content", content: "Hello" } });
  });

  it("parses progress event", () => {
    const result = parseSSELine('data: {"type":"progress","progress":50,"message":"Analyzing..."}');
    expect(result?.type).toBe("progress");
    expect(result?.data.progress).toBe(50);
    expect(result?.data.message).toBe("Analyzing...");
  });

  it("parses recommendation event", () => {
    const result = parseSSELine('data: {"type":"recommendation","recommendation":{"action":"Buy","confidence":85}}');
    expect(result?.type).toBe("recommendation");
    expect(result?.data.recommendation.action).toBe("Buy");
    expect(result?.data.recommendation.confidence).toBe(85);
  });

  it("parses done event", () => {
    const result = parseSSELine('data: {"type":"done"}');
    expect(result?.type).toBe("done");
  });

  it("parses error event", () => {
    const result = parseSSELine('data: {"type":"error","message":"Rate limited"}');
    expect(result?.type).toBe("error");
    expect(result?.data.message).toBe("Rate limited");
  });

  it("parses [DONE] signal", () => {
    const result = parseSSELine("data: [DONE]");
    expect(result).toEqual({ type: "done_signal", data: null });
  });

  it("parses mode event", () => {
    const result = parseSSELine('data: {"type":"mode","mode":"deep_dive"}');
    expect(result?.type).toBe("mode");
    expect(result?.data.mode).toBe("deep_dive");
  });

  it("handles fallback content without type field", () => {
    const result = parseSSELine('data: {"content":"Some text"}');
    expect(result?.type).toBe("unknown");
    expect(result?.data.content).toBe("Some text");
  });

  it("handles event field instead of type", () => {
    const result = parseSSELine('data: {"event":"content","text":"chunk"}');
    expect(result?.type).toBe("content");
    expect(result?.data.text).toBe("chunk");
  });

  it("returns null for empty lines", () => {
    expect(parseSSELine("")).toBeNull();
    expect(parseSSELine("   ")).toBeNull();
  });

  it("returns null for non-data lines", () => {
    expect(parseSSELine("event: message")).toBeNull();
    expect(parseSSELine("id: 123")).toBeNull();
    expect(parseSSELine(": comment")).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    expect(parseSSELine("data: {invalid json}")).toBeNull();
    expect(parseSSELine("data: not-json-at-all")).toBeNull();
  });
});

describe("SSE Buffer Processing", () => {
  it("splits complete lines", () => {
    const { lines, remaining } = processSSEBuffer('data: {"type":"content","content":"a"}\ndata: {"type":"content","content":"b"}\n');
    // split("\n") gives [data_a, data_b, ""], pop() removes the trailing "" → 2 lines
    expect(lines).toHaveLength(2);
    expect(remaining).toBe("");
  });

  it("keeps incomplete line in remaining", () => {
    const { lines, remaining } = processSSEBuffer('data: {"type":"content","content":"a"}\ndata: {"type":"con');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe('data: {"type":"content","content":"a"}');
    expect(remaining).toBe('data: {"type":"con');
  });

  it("handles empty buffer", () => {
    const { lines, remaining } = processSSEBuffer("");
    expect(lines).toHaveLength(0);
    expect(remaining).toBe("");
  });

  it("accumulates content correctly across chunks", () => {
    let fullContent = "";
    const chunks = [
      'data: {"type":"content","content":"Hello "}\n',
      'data: {"type":"content","content":"world"}\n',
      'data: {"type":"content","content":"!"}\n',
    ];

    for (const chunk of chunks) {
      const { lines } = processSSEBuffer(chunk);
      for (const line of lines) {
        const parsed = parseSSELine(line);
        if (parsed?.type === "content" && parsed.data.content) {
          fullContent += parsed.data.content;
        }
      }
    }

    expect(fullContent).toBe("Hello world!");
  });
});
