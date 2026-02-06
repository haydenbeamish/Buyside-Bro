import type { Express, Request, Response } from "express";
import OpenAI from "openai";
import { chatStorage } from "./storage";
import { checkAndDeductCredits, recordUsage, checkBroQueryAllowed } from "../../creditService";
import { isAuthenticated, authStorage } from "../auth";

const openrouter = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY || process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY || "",
});

const ESTIMATED_COST_CENTS = 10; // Estimated cost per AI request in cents

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

      // Check daily Bro query limit + credits
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

      const stream = await openrouter.chat.completions.create({
        model,
        messages: [
          {
            role: "system",
            content: "You are Buy Side Bro, a friendly and knowledgeable financial assistant. You help users understand markets, stocks, investing, and portfolio management. Be casual, approachable, and helpful - like a knowledgeable friend who happens to work in finance. Avoid jargon when possible, and explain complex concepts simply."
          },
          ...chatMessages,
        ],
        stream: true,
        max_tokens: 2048,
      });

      let fullResponse = "";

      for await (const chunk of stream) {
        const chunkContent = chunk.choices[0]?.delta?.content || "";
        if (chunkContent) {
          fullResponse += chunkContent;
          res.write(`data: ${JSON.stringify({ content: chunkContent })}\n\n`);
        }
      }

      await chatStorage.createMessage(conversationId, "assistant", fullResponse);

      // Record usage for authenticated users (estimate tokens from character count / 4)
      if (userId) {
        const systemPromptLength = 350; // Approximate length of system prompt
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

  // Simple chat endpoint - no database persistence (with credit check for authenticated users)
  app.post("/api/chat/simple", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { message, history = [] } = req.body;
      const model = "anthropic/claude-opus-4-20250514";
      const userId = req.user?.claims?.sub;

      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "Message is required" });
      }

      // Check daily Bro query limit + credits
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

      // Build chat history from client-side state
      const chatMessages = history.map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      // Add the new user message
      chatMessages.push({ role: "user" as const, content: message });

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const stream = await openrouter.chat.completions.create({
        model,
        messages: [
          {
            role: "system",
            content: "You are Buy Side Bro, a friendly and knowledgeable financial assistant. You help users understand markets, stocks, investing, and portfolio management. Be casual, approachable, and helpful - like a knowledgeable friend who happens to work in finance. Avoid jargon when possible, and explain complex concepts simply. Use data and specific numbers when discussing financial metrics."
          },
          ...chatMessages,
        ],
        stream: true,
        max_tokens: 2048,
      });

      let fullResponse = "";
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          fullResponse += content;
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }

      // Record usage for authenticated users (estimate tokens from character count / 4)
      if (userId) {
        const systemPromptLength = 380; // Approximate length of system prompt
        const historyLength = chatMessages.reduce((sum: number, m: { role: string; content: string }) => sum + m.content.length, 0);
        const inputTokens = Math.ceil((systemPromptLength + historyLength) / 4);
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
