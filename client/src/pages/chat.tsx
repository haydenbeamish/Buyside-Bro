import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Send,
  User,
  Loader2,
  TrendingUp,
  BarChart3,
  DollarSign,
  Sparkles,
  RefreshCw,
  MessageSquare,
  Plus,
  Trash2,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { useLoginGate } from "@/hooks/use-login-gate";
import { LoginGateModal } from "@/components/login-gate-modal";
import { useBroStatus } from "@/hooks/use-bro-status";
import { BroLimitModal } from "@/components/bro-limit-modal";
import { useDocumentTitle } from "@/hooks/use-document-title";
import ReactMarkdown from "react-markdown";

function stripSources(text: string): string {
  let cleaned = text;
  const srcIdx = cleaned.search(/\n*Sources?:\s*\[/);
  if (srcIdx !== -1) cleaned = cleaned.substring(0, srcIdx).trimEnd();
  const refIdx = cleaned.search(/\n*\*?\*?References?\*?\*?:?\s*\n/i);
  if (refIdx !== -1) cleaned = cleaned.substring(0, refIdx).trimEnd();
  cleaned = cleaned.replace(/\[([^\]]*?)\]\(https?:\/\/[^)]+\)/g, "$1");
  cleaned = cleaned.replace(/\bhttps?:\/\/[^\s),]+/g, "");
  cleaned = cleaned.replace(/(?<![@#\/\w])(?:[a-zA-Z0-9-]+\.)+(?:com|org|net|io|co|gov|edu|info|biz|us|uk|au|app|dev|finance|news)\b(?:\/[^\s),]*)*/gi, "");
  cleaned = cleaned.replace(/ {2,}/g, " ");
  cleaned = cleaned.replace(/\. \./g, ".");
  return cleaned;
}

function FormattedMessage({ content }: { content: string }) {
  const cleaned = useMemo(() => stripSources(content), [content]);
  return (
    <div className="text-sm leading-relaxed break-words prose-chat">
      <ReactMarkdown
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
          ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
          li: ({ children }) => <li>{children}</li>,
          h1: ({ children }) => <h3 className="font-bold text-white text-base mb-1">{children}</h3>,
          h2: ({ children }) => <h3 className="font-bold text-white text-base mb-1">{children}</h3>,
          h3: ({ children }) => <h3 className="font-semibold text-white text-sm mb-1">{children}</h3>,
          a: ({ children }) => (
            <span>{children}</span>
          ),
          code: ({ children }) => (
            <code className="bg-zinc-800/80 border border-zinc-700 px-1 py-0.5 rounded text-xs text-amber-400">{children}</code>
          ),
        }}
      >
        {cleaned}
      </ReactMarkdown>
    </div>
  );
}

interface Conversation {
  id: number;
  title: string;
  userId: string;
  createdAt: string;
}

interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  conversationId?: number;
  createdAt?: string;
}

// Inject loading-bar keyframes once into document head
if (typeof document !== "undefined" && !document.getElementById("chat-loading-bar-style")) {
  const style = document.createElement("style");
  style.id = "chat-loading-bar-style";
  style.textContent = `@keyframes loading-bar { 0% { width: 0%; opacity: 0.5; } 50% { width: 70%; opacity: 1; } 100% { width: 100%; opacity: 0.5; } }`;
  document.head.appendChild(style);
}

function ThinkingLoader() {
  const [messageIndex, setMessageIndex] = useState(0);
  const loadingMessages = useMemo(() => [
    "Researching financial data...",
    "Analyzing market trends...",
    "Crunching the numbers...",
    "Formulating insights...",
    "Preparing your answer...",
  ], []);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % loadingMessages.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [loadingMessages]);

  return (
    <div className="flex gap-3">
      <Avatar className="h-8 w-8 flex-shrink-0">
        <AvatarFallback className="bg-amber-500/10 border border-amber-500/30">
          <span className="text-xs font-bold text-amber-500 animate-pulse">AB</span>
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 max-w-[90%] sm:max-w-[80%]">
        <div className="bg-zinc-900 border border-amber-500/30 rounded-lg p-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="h-8 w-8 rounded-full border-2 border-amber-500/30 border-t-amber-500 animate-spin" />
              <Sparkles className="h-3 w-3 text-amber-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">Bro is thinking...</p>
              <span className="text-sm text-amber-400 font-mono animate-pulse">
                {loadingMessages[messageIndex]}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { icon: TrendingUp, label: "Trends" },
              { icon: BarChart3, label: "Metrics" },
              { icon: DollarSign, label: "Value" },
              { icon: Sparkles, label: "Insights" },
            ].map((item, i) => (
              <div
                key={item.label}
                className="bg-zinc-800/50 rounded-lg p-2 flex flex-col items-center gap-1 border border-zinc-700/50"
                style={{
                  animation: 'pulse 2s ease-in-out infinite',
                  animationDelay: `${i * 200}ms`
                }}
              >
                <item.icon className="h-4 w-4 text-zinc-500" />
                <span className="text-xs text-zinc-600">{item.label}</span>
              </div>
            ))}
          </div>

          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 rounded-full"
              style={{
                width: '60%',
                animation: 'loading-bar 2s ease-in-out infinite',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ConversationSidebar({
  conversations,
  isLoading,
  activeId,
  onSelect,
  onNew,
  onDelete,
  isOpen,
  onToggle,
}: {
  conversations: Conversation[] | undefined;
  isLoading: boolean;
  activeId: number | null;
  onSelect: (id: number) => void;
  onNew: () => void;
  onDelete: (id: number) => void;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={onToggle}
        className="sm:hidden fixed top-[60px] left-2 z-30 bg-zinc-900 border border-zinc-700 rounded-lg p-1.5"
      >
        {isOpen ? <PanelLeftClose className="w-4 h-4 text-zinc-400" /> : <PanelLeft className="w-4 h-4 text-zinc-400" />}
      </button>

      <div className={`${isOpen ? "translate-x-0" : "-translate-x-full sm:translate-x-0"} transition-transform duration-200 fixed sm:relative z-20 sm:z-auto w-[240px] sm:w-[220px] h-full border-r border-zinc-800 bg-zinc-950 sm:bg-transparent flex flex-col`}>
        <div className="p-2 border-b border-zinc-800">
          <Button
            variant="outline"
            size="sm"
            onClick={onNew}
            className="w-full border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs"
          >
            <Plus className="w-3 h-3 mr-1.5" />
            New Chat
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-1.5 space-y-0.5">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full bg-zinc-800 rounded" />
              ))
            ) : conversations && conversations.length > 0 ? (
              conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={`group flex items-center gap-1.5 rounded px-2 py-1.5 cursor-pointer transition-colors ${
                    activeId === conv.id
                      ? "bg-amber-900/20 border border-amber-500/30"
                      : "hover:bg-zinc-800/50 border border-transparent"
                  }`}
                  onClick={() => onSelect(conv.id)}
                >
                  <MessageSquare className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                  <span className="text-xs text-zinc-300 truncate flex-1">{conv.title}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(conv.id); }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:text-red-400 text-zinc-600"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))
            ) : (
              <p className="text-xs text-zinc-600 text-center py-4">No conversations yet</p>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Mobile backdrop */}
      {isOpen && (
        <div className="sm:hidden fixed inset-0 z-10 bg-black/50" onClick={onToggle} />
      )}
    </>
  );
}

export default function ChatPage() {
  useDocumentTitle("Ask Bro", "Ask Bro is your bro on the buyside — a CFA-certified research analyst. Get data-backed answers to complex market questions with real-time ticker detection and live market data on Buy Side Bro.");
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [streamingMessage, setStreamingMessage] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const creatingConversationRef = useRef<Promise<any> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { gate, showLoginModal, closeLoginModal, isAuthenticated } = useLoginGate();
  const { isAtLimit, refetch: refetchBroStatus } = useBroStatus();
  const [showBroLimit, setShowBroLimit] = useState(false);

  // Fetch conversation list
  const { data: conversations, isLoading: conversationsLoading } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations"],
    enabled: isAuthenticated,
  });

  // Fetch active conversation messages
  const { data: conversationData } = useQuery<{ messages: ChatMessage[] }>({
    queryKey: [`/api/conversations/${activeConversationId}`],
    enabled: isAuthenticated && activeConversationId !== null,
  });

  // Use server messages when available, otherwise local state
  const displayMessages = activeConversationId && conversationData?.messages
    ? [...conversationData.messages, ...localMessages]
    : localMessages;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [displayMessages, streamingMessage]);

  const createConversation = useMutation({
    mutationFn: async (title: string) => {
      const res = await apiRequest("POST", "/api/conversations", { title });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    },
  });

  const deleteConversation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/conversations/${id}`);
    },
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      if (activeConversationId === deletedId) {
        setActiveConversationId(null);
        setLocalMessages([]);
      }
    },
  });

  const handleSelectConversation = (id: number) => {
    setActiveConversationId(id);
    setLocalMessages([]);
    setStreamingMessage("");
    setSidebarOpen(false);
  };

  const handleNewChat = () => {
    setActiveConversationId(null);
    setLocalMessages([]);
    setStreamingMessage("");
    setInputValue("");
    setSidebarOpen(false);
  };

  const handleSendMessage = async () => {
    if (!gate()) return;
    if (isAtLimit) {
      setShowBroLimit(true);
      return;
    }
    if (!inputValue.trim() || isStreaming) return;

    const userMessage = inputValue.trim();
    const optimisticId = Date.now();
    setInputValue("");
    setIsStreaming(true);
    setStreamingMessage("");

    // Optimistically add user message
    setLocalMessages(prev => [...prev, { id: optimisticId, role: "user", content: userMessage }]);

    try {
      let convId = activeConversationId;

      // Auto-create conversation if none active — deduplicate with ref
      if (!convId && isAuthenticated) {
        if (!creatingConversationRef.current) {
          const title = userMessage.length > 50
            ? userMessage.substring(0, 50) + "..."
            : userMessage;
          creatingConversationRef.current = createConversation.mutateAsync(title);
        }
        try {
          const newConv = await creatingConversationRef.current;
          convId = newConv.id;
          setActiveConversationId(convId);
        } finally {
          creatingConversationRef.current = null;
        }
      }

      if (convId && isAuthenticated) {
        // Use persisted conversation endpoint
        const response = await fetch(`/api/conversations/${convId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ content: userMessage }),
        });

        if (response.status === 429) {
          setShowBroLimit(true);
          setLocalMessages(prev => prev.filter(m => m.id !== optimisticId));
          setIsStreaming(false);
          return;
        }

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
                if (data.error) throw new Error(data.error);
                if (data.content) {
                  fullResponse += data.content;
                  setStreamingMessage(fullResponse);
                }
                if (data.done) {
                  setLocalMessages([]);
                  setIsStreaming(false);
                  setStreamingMessage("");
                  // Refetch conversation to get persisted messages
                  queryClient.invalidateQueries({ queryKey: [`/api/conversations/${convId}`] });
                  refetchBroStatus();
                  return;
                }
              } catch (parseErr) {
                if (parseErr instanceof Error && parseErr.message !== "Unexpected") throw parseErr;
              }
            }
          }
        }

        // Stream ended without data.done
        setLocalMessages([]);
        setIsStreaming(false);
        setStreamingMessage("");
        queryClient.invalidateQueries({ queryKey: [`/api/conversations/${convId}`] });
      } else {
        // Fallback: use simple endpoint for non-authenticated users
        const historySnapshot = localMessages.filter(m => m.id !== optimisticId);

        const response = await fetch("/api/chat/simple", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ message: userMessage, history: historySnapshot }),
        });

        if (response.status === 429) {
          setShowBroLimit(true);
          setLocalMessages(prev => prev.filter(m => m.id !== optimisticId));
          setIsStreaming(false);
          return;
        }

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
                if (data.error) throw new Error(data.error);
                if (data.content) {
                  fullResponse += data.content;
                  setStreamingMessage(fullResponse);
                }
                if (data.done) {
                  setLocalMessages(prev => [...prev, { id: Date.now() + 1, role: "assistant", content: fullResponse }]);
                  setIsStreaming(false);
                  setStreamingMessage("");
                  refetchBroStatus();
                  return;
                }
              } catch (parseErr) {
                if (parseErr instanceof Error && parseErr.message !== "Unexpected") throw parseErr;
              }
            }
          }
        }

        if (fullResponse) {
          setLocalMessages(prev => [...prev, { id: Date.now() + 1, role: "assistant", content: fullResponse }]);
        }
        setIsStreaming(false);
        setStreamingMessage("");
      }
    } catch (error) {
      // Roll back optimistic user message on error
      setLocalMessages(prev => prev.filter(m => m.id !== optimisticId));
      toast({
        title: "Error",
        description: "Failed to get response. Please try again.",
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

  const handleSuggestedQuestion = (question: string) => {
    setInputValue(question);
  };

  return (
    <div className="flex h-[calc(100dvh-56px)] sm:h-[calc(100vh-64px)] max-h-[calc(100dvh-56px)] sm:max-h-[calc(100vh-64px)] bg-black overflow-hidden">
      {/* Conversation sidebar */}
      {isAuthenticated && (
        <ConversationSidebar
          conversations={conversations}
          isLoading={conversationsLoading}
          activeId={activeConversationId}
          onSelect={handleSelectConversation}
          onNew={handleNewChat}
          onDelete={(id) => deleteConversation.mutate(id)}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
        />
      )}

      <div className="flex-1 flex flex-col bg-black overflow-hidden">
        {displayMessages.length === 0 && !isStreaming ? (
          <div className="flex-1 overflow-y-auto flex items-center justify-center">
            <div className="max-w-3xl w-full px-3 sm:px-4 py-4 sm:py-6">
              <div className="mb-4 sm:mb-6 text-center">
                <h1 className="display-font text-xl sm:text-3xl md:text-4xl font-bold tracking-wider text-white mb-1 sm:mb-2">
                  ASK BRO
                </h1>
                <p className="text-zinc-500 text-sm sm:text-base">
                  Autonomous Financial Research Agent — ask complex financial questions and get data-backed answers
                </p>
              </div>

              <div className="flex gap-2 mb-6 sm:mb-8">
                <Textarea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask me anything about finance..."
                  className="min-h-[44px] max-h-32 resize-none bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-500"
                  disabled={isStreaming}
                  data-testid="input-chat-message-empty"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim() || isStreaming}
                  size="icon"
                  className="bg-amber-500 hover:bg-amber-400 text-black min-h-[44px] min-w-[44px]"
                  data-testid="button-send-message-empty"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-zinc-500 uppercase tracking-wide text-center">Try asking:</p>
                <div className="flex flex-col gap-2">
                  {suggestedQuestions.map((q, i) => (
                    <Button
                      key={i}
                      variant="outline"
                      size="sm"
                      className="text-xs border-zinc-800 bg-zinc-900 hover:bg-amber-900/20 hover:border-amber-500/50 text-zinc-300 text-left justify-start h-auto py-2 px-3 whitespace-normal break-words"
                      onClick={() => handleSuggestedQuestion(q)}
                      data-testid={`suggested-question-${i}`}
                    >
                      {q}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/10 border border-amber-500/30">
                  <span className="text-sm font-bold text-amber-500">AB</span>
                </div>
                <span className="text-sm font-medium text-white">Ask Bro</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNewChat}
                className="text-zinc-400 hover:text-white"
                data-testid="button-clear-chat"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                New Chat
              </Button>
            </div>

            <ScrollArea className="flex-1 p-4">
              <div className="max-w-3xl mx-auto space-y-4">
                {displayMessages.map((msg, idx) => (
                  <div
                    key={msg.id || idx}
                    className={`flex gap-3 ${
                      msg.role === "user" ? "flex-row-reverse" : ""
                    }`}
                  >
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarFallback
                        className={
                          msg.role === "user"
                            ? "bg-zinc-700"
                            : "bg-amber-500/10 border border-amber-500/30"
                        }
                      >
                        {msg.role === "user" ? (
                          <User className="h-4 w-4 text-zinc-300" />
                        ) : (
                          <span className="text-xs font-bold text-amber-500">AB</span>
                        )}
                      </AvatarFallback>
                    </Avatar>
                    <div
                      className={`max-w-[90%] sm:max-w-[80%] rounded-lg p-3 ${
                        msg.role === "user"
                          ? "bg-zinc-800 text-white"
                          : "bg-zinc-900 border border-zinc-800 text-zinc-300"
                      }`}
                    >
                      {msg.role === "assistant" ? (
                        <FormattedMessage content={msg.content} />
                      ) : (
                        <p className="text-sm whitespace-pre-wrap leading-relaxed break-words">
                          {msg.content}
                        </p>
                      )}
                    </div>
                  </div>
                ))}

                {isStreaming && !streamingMessage && (
                  <ThinkingLoader />
                )}

                {streamingMessage && (
                  <div className="flex gap-3">
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarFallback className="bg-amber-500/10 border border-amber-500/30">
                        <span className="text-xs font-bold text-amber-500">AB</span>
                      </AvatarFallback>
                    </Avatar>
                    <div className="max-w-[90%] sm:max-w-[80%] rounded-lg p-3 bg-zinc-900 border border-zinc-800 text-zinc-300">
                      <FormattedMessage content={streamingMessage} />
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            <div className="border-t border-zinc-800 p-2.5 sm:p-4">
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
                  className="bg-amber-500 hover:bg-amber-400 text-black min-h-[44px] min-w-[44px]"
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
      <LoginGateModal open={showLoginModal} onClose={closeLoginModal} />
      <BroLimitModal open={showBroLimit} onClose={() => setShowBroLimit(false)} />
    </div>
  );
}
