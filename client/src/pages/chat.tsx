import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import {
  Send,
  User,
  Loader2,
  TrendingUp,
  BarChart3,
  DollarSign,
  Sparkles,
  RefreshCw,
} from "lucide-react";

interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
}

function ThinkingLoader() {
  const [messageIndex, setMessageIndex] = useState(0);
  const loadingMessages = [
    "Researching financial data...",
    "Analyzing market trends...",
    "Crunching the numbers...",
    "Formulating insights...",
    "Preparing your answer...",
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % loadingMessages.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex gap-3">
      <Avatar className="h-8 w-8 flex-shrink-0">
        <AvatarFallback className="bg-green-500/10 border border-green-500/30">
          <span className="text-xs font-bold text-green-500 animate-pulse">AB</span>
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 max-w-[80%]">
        <div className="bg-zinc-900 border border-green-500/30 rounded-lg p-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="h-8 w-8 rounded-full border-2 border-green-500/30 border-t-green-500 animate-spin" />
              <Sparkles className="h-3 w-3 text-green-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">Bro is thinking...</p>
              <span className="text-sm text-green-400 font-mono animate-pulse">
                {loadingMessages[messageIndex]}
              </span>
            </div>
          </div>
          
          <div className="grid grid-cols-4 gap-2">
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
              className="h-full bg-gradient-to-r from-green-500 via-green-400 to-green-500 rounded-full"
              style={{
                width: '60%',
                animation: 'loading-bar 2s ease-in-out infinite',
              }}
            />
          </div>
        </div>
      </div>
      
      <style>{`
        @keyframes loading-bar {
          0% { width: 0%; opacity: 0.5; }
          50% { width: 70%; opacity: 1; }
          100% { width: 100%; opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [streamingMessage, setStreamingMessage] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const messageIdRef = useRef(0);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isStreaming) return;

    const userMessage = inputValue.trim();
    setInputValue("");
    
    // Add user message to local state
    const userMsgId = ++messageIdRef.current;
    setMessages(prev => [...prev, { id: userMsgId, role: "user", content: userMessage }]);
    
    setIsStreaming(true);
    setStreamingMessage("");

    try {
      // Use the simple chat endpoint without saving to database
      const response = await fetch("/api/chat/simple", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage, history: messages }),
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
                // Add assistant message to local state
                const assistantMsgId = ++messageIdRef.current;
                setMessages(prev => [...prev, { id: assistantMsgId, role: "assistant", content: fullResponse }]);
                setIsStreaming(false);
                setStreamingMessage("");
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (error) {
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

  const handleClearChat = () => {
    setMessages([]);
    setStreamingMessage("");
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
    <div className="flex h-[calc(100vh-64px)] max-h-[calc(100vh-64px)] bg-black">
      <div className="flex-1 flex flex-col bg-black">
        {messages.length === 0 && !isStreaming ? (
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
              <div className="space-y-2">
                <p className="text-xs text-zinc-500 uppercase tracking-wide">Try asking:</p>
                <div className="flex flex-col gap-2">
                  {suggestedQuestions.map((q, i) => (
                    <Button
                      key={i}
                      variant="outline"
                      size="sm"
                      className="text-xs border-green-900/50 bg-zinc-900 hover:bg-green-900/20 hover:border-green-500/50 text-zinc-300 text-left justify-start h-auto py-2 px-3"
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
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/10 border border-green-500/30">
                  <span className="text-sm font-bold text-green-500">AB</span>
                </div>
                <span className="text-sm font-medium text-white">Ask Bro</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearChat}
                className="text-zinc-400 hover:text-white"
                data-testid="button-clear-chat"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                New Chat
              </Button>
            </div>
            
            <ScrollArea className="flex-1 p-4">
              <div className="max-w-3xl mx-auto space-y-4">
                {messages.map((msg) => (
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
                            : "bg-green-500/10 border border-green-500/30"
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
                ))}

                {isStreaming && !streamingMessage && (
                  <ThinkingLoader />
                )}

                {streamingMessage && (
                  <div className="flex gap-3">
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarFallback className="bg-green-500/10 border border-green-500/30">
                        <span className="text-xs font-bold text-green-500">AB</span>
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
                  className="bg-green-500 hover:bg-green-400 text-black"
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

        {/* Input at bottom when no messages */}
        {messages.length === 0 && !isStreaming && (
          <div className="border-t border-zinc-800 p-4">
            <div className="max-w-3xl mx-auto flex gap-2">
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
                className="bg-green-500 hover:bg-green-400 text-black"
                data-testid="button-send-message-empty"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
