import type { Express, Request, Response } from "express";
import { chatStorage } from "./storage";
import { checkAndDeductCredits, recordUsage, checkBroQueryAllowed } from "../../creditService";
import { isAuthenticated, authStorage } from "../auth";

const LASER_BEAM_API = "https://api.laserbeamcapital.com";
const ESTIMATED_COST_CENTS = 10;

async function proxySSEStream(
  upstreamResponse: globalThis.Response,
  res: Response
): Promise<string> {
  const reader = upstreamResponse.body!.getReader();
  const decoder = new TextDecoder();
  let fullResponse = "";
  let buffer = "";
  let streamDone = false;

  try {
    while (!streamDone) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const events = buffer.split("\n\n");
      buffer = events.pop() || "";

      for (const event of events) {
        const lines = event.split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          if (jsonStr === "[DONE]") {
            streamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            if (parsed.content) {
              fullResponse += parsed.content;
              res.write(`data: ${JSON.stringify({ content: parsed.content })}\n\n`);
            }
            if (parsed.done) {
              streamDone = true;
              break;
            }
          } catch {
            continue;
          }
        }
        if (streamDone) break;
      }
    }
  } finally {
    reader.cancel().catch(() => {});
  }

  return fullResponse;
}

export function registerChatRoutes(app: Express): void {
  app.get("/api/conversations", async (req: Request, res: Response) => {
    try {
      const conversations = await chatStorage.getAllConversations();
      res.json(conversations);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  app.get("/api/conversations/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string);
      const conversation = await chatStorage.getConversation(id);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      const messages = await chatStorage.getMessagesByConversation(id);
      res.json({ ...conversation, messages });
    } catch (error) {
      console.error("Error fetching conversation:", error);
      res.status(500).json({ error: "Failed to fetch conversation" });
    }
  });

  app.post("/api/conversations", async (req: Request, res: Response) => {
    try {
      const { title } = req.body;
      const conversation = await chatStorage.createConversation(title || "New Chat");
      res.status(201).json(conversation);
    } catch (error) {
      console.error("Error creating conversation:", error);
      res.status(500).json({ error: "Failed to create conversation" });
    }
  });

  app.delete("/api/conversations/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string);
      await chatStorage.deleteConversation(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting conversation:", error);
      res.status(500).json({ error: "Failed to delete conversation" });
    }
  });

  app.post("/api/conversations/:id/messages", isAuthenticated, async (req: any, res: Response) => {
    try {
      const conversationId = parseInt(req.params.id as string);
      const { content } = req.body;
      const model = "anthropic/claude-opus-4-20250514";
      const userId = req.user?.claims?.sub;

      if (!content || typeof content !== "string") {
        return res.status(400).json({ error: "Message content is required" });
      }

      if (userId) {
        const user = await authStorage.getUser(userId);
        const broCheck = await checkBroQueryAllowed(userId, user);
        if (!broCheck.allowed) {
          return res.status(429).json({
            error: "Daily limit reached",
            message: broCheck.message,
            requiresUpgrade: broCheck.requiresUpgrade,
          });
        }
        const creditCheck = await checkAndDeductCredits(userId, ESTIMATED_COST_CENTS);
        if (!creditCheck.allowed) {
          return res.status(402).json({
            error: "Out of credits",
            message: creditCheck.message,
            requiresCredits: true
          });
        }
      }

      await chatStorage.createMessage(conversationId, "user", content);

      const messages = await chatStorage.getMessagesByConversation(conversationId);
      const chatMessages = messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const response = await fetch(`${LASER_BEAM_API}/api/chat/bro`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content,
          history: chatMessages.slice(0, -1),
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Laser Beam API error: ${response.status}`);
      }

      const fullResponse = await proxySSEStream(response, res);

      await chatStorage.createMessage(conversationId, "assistant", fullResponse);

      if (userId) {
        const systemPromptLength = 350;
        const historyLength = chatMessages.reduce((sum, m) => sum + m.content.length, 0);
        const inputTokens = Math.ceil((systemPromptLength + historyLength) / 4);
        const outputTokens = Math.ceil(fullResponse.length / 4);
        await recordUsage(userId, 'chat_conversation', model, inputTokens, outputTokens);
      }

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error) {
      console.error("Error sending message:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: "Failed to send message" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: "Failed to send message" });
      }
    }
  });

  app.post("/api/chat/simple", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { message, history = [] } = req.body;
      const model = "anthropic/claude-opus-4-20250514";
      const userId = req.user?.claims?.sub;

      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "Message is required" });
      }

      if (userId) {
        const user = await authStorage.getUser(userId);
        const broCheck = await checkBroQueryAllowed(userId, user);
        if (!broCheck.allowed) {
          return res.status(429).json({
            error: "Daily limit reached",
            message: broCheck.message,
            requiresUpgrade: broCheck.requiresUpgrade,
          });
        }
        const creditCheck = await checkAndDeductCredits(userId, ESTIMATED_COST_CENTS);
        if (!creditCheck.allowed) {
          return res.status(402).json({
            error: "Out of credits",
            message: creditCheck.message,
            requiresCredits: true
          });
        }
      }

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const response = await fetch(`${LASER_BEAM_API}/api/chat/bro`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Laser Beam API error: ${response.status}`);
      }

      const fullResponse = await proxySSEStream(response, res);

      if (userId) {
        const systemPromptLength = 380;
        const historyLength = history.reduce((sum: number, m: { role: string; content: string }) => sum + m.content.length, 0);
        const inputTokens = Math.ceil((systemPromptLength + historyLength + message.length) / 4);
        const outputTokens = Math.ceil(fullResponse.length / 4);
        await recordUsage(userId, 'chat', model, inputTokens, outputTokens);
      }

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error) {
      console.error("Simple chat error:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: "Failed to get response" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: "Failed to get response" });
      }
    }
  });
}
