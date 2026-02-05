import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  MessageSquare,
  Send,
  Plus,
  Trash2,
  Sparkles,
  User,
  Loader2,
} from "lucide-react";
import type { Conversation, Message } from "@shared/schema";

export default function ChatPage() {
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [streamingMessage, setStreamingMessage] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const { data: conversations, isLoading: conversationsLoading } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations"],
  });

  const { data: activeConversation, isLoading: messagesLoading } = useQuery<Conversation & { messages: Message[] }>({
    queryKey: ["/api/conversations", activeConversationId],
    enabled: !!activeConversationId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/conversations", {
        title: "New Chat",
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      setActiveConversationId(data.id);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/conversations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      if (activeConversationId === deleteMutation.variables) {
        setActiveConversationId(null);
      }
    },
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeConversation?.messages, streamingMessage]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || !activeConversationId || isStreaming) return;

    const message = inputValue.trim();
    setInputValue("");
    setIsStreaming(true);
    setStreamingMessage("");

    try {
      const response = await fetch(`/api/conversations/${activeConversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: message }),
        credentials: "include",
      });

      if (!response.ok) throw new Error("Failed to send message");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let fullResponse = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) {
                fullResponse += data.content;
                setStreamingMessage(fullResponse);
              }
              if (data.done) {
                setIsStreaming(false);
                setStreamingMessage("");
                queryClient.invalidateQueries({
                  queryKey: ["/api/conversations", activeConversationId],
                });
              }
            } catch {
            }
          }
        }
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
      setIsStreaming(false);
      setStreamingMessage("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const suggestedQuestions = [
    "Compare Apple and Microsoft's revenue growth over the last 3 years",
    "What is Tesla's current P/E ratio and how does it compare to the auto industry?",
    "Analyze NVIDIA's operating margins and free cash flow trends",
    "What are the key financial metrics for Amazon's cloud business?",
  ];

  return (
    <div className="flex h-[calc(100vh-64px)] max-h-[calc(100vh-64px)] bg-black">
      <div className="hidden md:flex w-64 flex-col border-r border-zinc-800 bg-zinc-950">
        <div className="p-4 border-b border-zinc-800">
          <Button
            onClick={() => createMutation.mutate()}
            className="w-full bg-zinc-800 hover:bg-zinc-700 text-white"
            disabled={createMutation.isPending}
            data-testid="button-new-chat"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Chat
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {conversationsLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full bg-zinc-800" />
              ))
            ) : conversations && conversations.length > 0 ? (
              conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={`flex items-center gap-2 p-2 rounded-md cursor-pointer group hover:bg-zinc-800 transition-colors ${
                    activeConversationId === conv.id
                      ? "bg-zinc-800"
                      : ""
                  }`}
                  onClick={() => setActiveConversationId(conv.id)}
                  data-testid={`conversation-${conv.id}`}
                >
                  <MessageSquare className="h-4 w-4 text-zinc-500 flex-shrink-0" />
                  <span className="text-sm text-zinc-300 truncate flex-1">{conv.title}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-500"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteMutation.mutate(conv.id);
                    }}
                    data-testid={`delete-conversation-${conv.id}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))
            ) : (
              <p className="text-sm text-zinc-500 p-2">
                No conversations yet
              </p>
            )}
          </div>
        </ScrollArea>
      </div>

      <div className="flex-1 flex flex-col bg-black">
        {!activeConversationId ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="max-w-md text-center space-y-6">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-500/10 border border-green-500/30 mx-auto">
                <span className="text-3xl font-bold text-green-500 display-font">AB</span>
              </div>
              <div>
                <h2 className="text-3xl font-bold text-white mb-2 display-font tracking-wide">
                  ASK BRO
                </h2>
                <p className="text-green-400 text-sm uppercase tracking-widest mb-3">
                  Autonomous Financial Research Agent
                </p>
                <p className="text-zinc-500 text-sm">
                  Ask complex financial questions. Your bro thinks, plans, and researches using real-time market data to give you data-backed answers.
                </p>
              </div>
              <Button
                onClick={() => createMutation.mutate()}
                size="lg"
                disabled={createMutation.isPending}
                className="bg-green-500 hover:bg-green-400 text-black font-bold uppercase tracking-wider"
                data-testid="button-start-chat"
              >
                <Plus className="h-4 w-4 mr-2" />
                Start Research
              </Button>
              <div className="space-y-2">
                <p className="text-xs text-zinc-500 uppercase tracking-wide">Example queries:</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {suggestedQuestions.slice(0, 2).map((q, i) => (
                    <Button
                      key={i}
                      variant="outline"
                      size="sm"
                      className="text-xs border-green-900/50 bg-zinc-900 hover:bg-green-900/20 hover:border-green-500/50 text-zinc-300"
                      onClick={() => {
                        createMutation.mutate();
                        setInputValue(q);
                      }}
                      data-testid={`suggested-question-${i}`}
                    >
                      {q.slice(0, 40)}...
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 p-4">
              <div className="max-w-3xl mx-auto space-y-4">
                {messagesLoading ? (
                  <div className="space-y-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="flex gap-3">
                        <Skeleton className="h-8 w-8 rounded-full bg-zinc-800" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-full bg-zinc-800" />
                          <Skeleton className="h-4 w-3/4 bg-zinc-800" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : activeConversation?.messages && activeConversation.messages.length > 0 ? (
                  activeConversation.messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex gap-3 ${
                        msg.role === "user" ? "flex-row-reverse" : ""
                      }`}
                    >
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarFallback
                          className={
                            msg.role === "user"
                              ? "bg-zinc-700"
                              : "bg-green-500/10"
                          }
                        >
                          {msg.role === "user" ? (
                            <User className="h-4 w-4 text-zinc-300" />
                          ) : (
                            <span className="text-xs font-bold text-green-500">AB</span>
                          )}
                        </AvatarFallback>
                      </Avatar>
                      <div
                        className={`max-w-[80%] rounded-lg p-3 ${
                          msg.role === "user"
                            ? "bg-zinc-800 text-white"
                            : "bg-zinc-900 border border-zinc-800 text-zinc-300"
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">
                          {msg.content}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <p className="text-zinc-500 text-sm">
                      Start the conversation by sending a message.
                    </p>
                  </div>
                )}

                {streamingMessage && (
                  <div className="flex gap-3">
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarFallback className="bg-green-500/10">
                        <span className="text-xs font-bold text-green-500 animate-pulse">AB</span>
                      </AvatarFallback>
                    </Avatar>
                    <div className="max-w-[80%] rounded-lg p-3 bg-zinc-900 border border-zinc-800">
                      <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">
                        {streamingMessage}
                      </p>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            <div className="border-t border-zinc-800 p-4">
              <div className="max-w-3xl mx-auto flex gap-2">
                <Textarea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask me anything about finance..."
                  className="min-h-[44px] max-h-32 resize-none bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-500"
                  disabled={isStreaming}
                  data-testid="input-chat-message"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim() || isStreaming}
                  size="icon"
                  className="bg-zinc-800 hover:bg-zinc-700"
                  data-testid="button-send-message"
                >
                  {isStreaming ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
