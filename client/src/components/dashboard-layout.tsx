import { Link, useLocation } from "wouter";
import { ReactNode, useEffect, useRef } from "react";
import { LayoutGrid, Briefcase, Newspaper, MessageSquare, Menu, X, Sparkles, CreditCard, LogOut, User, Eye, Shield, Brain, Building2, Loader2, Bug, TrendingUp } from "lucide-react";
import { useState } from "react";
import * as Sentry from "@sentry/react";
import { useAuth } from "@/hooks/use-auth";
import { useBroStatus } from "@/hooks/use-bro-status";
import { useQuery } from "@tanstack/react-query";
import AnalysisNotificationBanner from "@/components/analysis-notification-banner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import logoImg from "@assets/image_1770442846290.png";

interface DashboardLayoutProps {
  children: ReactNode;
}

const navItems = [
  { path: "/whats-up", label: "What's Up?", icon: Sparkles },
  { path: "/dashboard", label: "Markets", icon: LayoutGrid },
  { path: "/analysis", label: "Company", icon: Building2 },
  { path: "/watchlist", label: "Watchlist", icon: Eye },
  { path: "/portfolio", label: "Portfolio", icon: Briefcase },
  { path: "/trades", label: "Trade Tools", icon: TrendingUp },
  { path: "/earnings", label: "Earnings", icon: Brain },
  { path: "/chat", label: "Ask Bro", icon: MessageSquare },
];

function BetaFeedbackWidget() {
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem("feedback-dismissed") === "1");
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [submitted, setSubmitted] = useState(false);

  if (dismissed) return null;

  const handleDismiss = () => {
    sessionStorage.setItem("feedback-dismissed", "1");
    setDismissed(true);
  };

  const handleSubmit = () => {
    if (!feedback.trim()) return;
    Sentry.captureFeedback({
      message: feedback.trim(),
    });
    setFeedback("");
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setOpen(false);
      handleDismiss();
    }, 2000);
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {open && (
        <div className="mb-2 w-72 max-w-[calc(100vw-2rem)] bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-200">Beta Feedback</span>
            <button onClick={() => setOpen(false)} className="text-zinc-500 hover:text-zinc-300">
              <X className="w-4 h-4" />
            </button>
          </div>
          {submitted ? (
            <p className="text-sm text-green-400">Thanks for the feedback!</p>
          ) : (
            <>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="What's broken or could be better?"
                className="w-full h-24 bg-zinc-800 border border-zinc-700 rounded-md p-2 text-sm text-zinc-200 placeholder:text-zinc-500 resize-none focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
              <button
                onClick={handleSubmit}
                disabled={!feedback.trim()}
                className="w-full py-1.5 text-sm font-medium rounded-md bg-amber-600 hover:bg-amber-500 text-black disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Send Feedback
              </button>
            </>
          )}
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-800/80 border border-zinc-700 text-zinc-400 hover:text-amber-400 hover:border-amber-500/50 transition-all text-xs backdrop-blur-sm"
      >
        <Bug className="w-3.5 h-3.5" />
        <span>Feedback</span>
      </button>
    </div>
  );
}

interface TickerMarketItem {
  name: string;
  price: number;
  change1D: number;
}

type TickerFlashCells = Record<string, "up" | "down">;

function TickerTape({ items, flashCells }: { items: TickerMarketItem[]; flashCells: TickerFlashCells }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<TickerMarketItem[]>(items);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) return;

    let animationId: number;
    let scrollPos = scrollContainer.scrollLeft || 0;

    const scroll = () => {
      scrollPos += 1.5;
      if (scrollPos >= scrollContainer.scrollWidth / 2) {
        scrollPos = 0;
      }
      scrollContainer.scrollLeft = scrollPos;
      animationId = requestAnimationFrame(scroll);
    };

    animationId = requestAnimationFrame(scroll);
    return () => cancelAnimationFrame(animationId);
  }, []);

  const duplicatedItems = [...items, ...items];

  return (
    <div className="bg-black border-b border-zinc-800 overflow-hidden">
      <div
        ref={scrollRef}
        className="flex whitespace-nowrap py-2 overflow-x-hidden"
        style={{ scrollBehavior: 'auto' }}
      >
        {duplicatedItems.map((item, idx) => (
          <div
            key={`${item.name}-${idx}`}
            className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 border-r border-zinc-800"
          >
            <span className="text-zinc-400 text-xs sm:text-sm ticker-font">{item.name}</span>
            <span className="text-zinc-200 text-xs sm:text-sm ticker-font">
              {item.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className={`text-xs sm:text-sm ticker-font ${item.change1D >= 0 ? 'text-gain' : 'text-loss'} ${flashCells[`${item.name}:change1D`] === 'up' ? 'cell-flash-up' : flashCells[`${item.name}:change1D`] === 'down' ? 'cell-flash-down' : ''}`}>
              {item.change1D >= 0 ? '+' : ''}{item.change1D.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, isLoading, isAuthenticated } = useAuth();
  const { broStatus } = useBroStatus();
  const { data: adminCheck } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["/api/admin/check"],
    enabled: isAuthenticated,
  });
  const isAdmin = adminCheck?.isAdmin ?? false;

  // Ticker tape data
  const { data: tickerData } = useQuery<{ globalMarkets: TickerMarketItem[] }>({
    queryKey: ["/api/markets/full"],
    refetchInterval: 30000,
  });
  const tickerItems = tickerData?.globalMarkets || [];
  const prevTickerRef = useRef<Record<string, number>>({});
  const tickerLoadedOnce = useRef(false);
  const [tickerFlash, setTickerFlash] = useState<TickerFlashCells>({});

  useEffect(() => {
    if (tickerItems.length === 0) return;
    if (tickerLoadedOnce.current) {
      const flashes: TickerFlashCells = {};
      for (const item of tickerItems) {
        const prev = prevTickerRef.current[item.name];
        if (prev !== undefined && prev !== item.change1D) {
          flashes[`${item.name}:change1D`] = item.change1D > prev ? 'up' : 'down';
        }
      }
      if (Object.keys(flashes).length > 0) {
        setTickerFlash(flashes);
      }
    } else {
      tickerLoadedOnce.current = true;
    }
    const newRef: Record<string, number> = {};
    for (const item of tickerItems) {
      newRef[item.name] = item.change1D;
    }
    prevTickerRef.current = newRef;
  }, [tickerItems]);

  useEffect(() => {
    if (Object.keys(tickerFlash).length === 0) return;
    const timer = setTimeout(() => setTickerFlash({}), 700);
    return () => clearTimeout(timer);
  }, [tickerFlash]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-amber-600 focus:text-black focus:rounded focus:font-semibold focus:outline-none"
      >
        Skip to content
      </a>
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:sticky inset-y-0 left-0 z-50 lg:top-0 lg:h-screen
        w-64 bg-black border-r border-zinc-800 flex-shrink-0
        transform transition-transform duration-200 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-4 border-b border-zinc-800">
            <Link href="/" className="flex items-center gap-3">
              <img src={logoImg} alt="Buy Side Bro" className="w-12 h-12 object-contain drop-shadow-[0_0_10px_rgba(255,215,0,0.4)]" />
              <div className="display-font text-sm tracking-wider neon-green-subtle">
                BUY SIDE BRO
              </div>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4 space-y-1">
            {navItems.map((item) => {
              const isActive = location === item.path;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  onClick={() => setSidebarOpen(false)}
                >
                  <div
                    className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-200
                      ${isActive
                        ? 'bg-amber-900/20 border border-zinc-800 text-amber-400'
                        : 'text-zinc-400 hover:text-amber-400 hover:bg-amber-900/10'
                      }
                    `}
                    data-testid={`nav-${item.label.toLowerCase()}`}
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="text-sm font-medium">{item.label}</span>
                  </div>
                </Link>
              );
            })}
          </nav>

          {/* Bottom section */}
          <div className="p-4 border-t border-zinc-800 space-y-3">
            {isAdmin && (
              <Link href="/admin" onClick={() => setSidebarOpen(false)}>
                <div
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-200
                    ${location === '/admin'
                      ? 'bg-amber-900/20 border border-zinc-800 text-amber-400'
                      : 'text-zinc-400 hover:text-amber-400 hover:bg-amber-900/10'
                    }
                  `}
                  data-testid="nav-admin"
                >
                  <Shield className="w-5 h-5" />
                  <span className="text-sm font-medium">Admin</span>
                </div>
              </Link>
            )}

            {/* Subscription Link - only for authenticated users */}
            {isAuthenticated && (
              <Link href="/subscription" onClick={() => setSidebarOpen(false)}>
                <div
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-200
                    ${location === '/subscription'
                      ? 'bg-amber-900/20 border border-zinc-800 text-amber-400'
                      : 'text-zinc-400 hover:text-amber-400 hover:bg-amber-900/10'
                    }
                  `}
                  data-testid="nav-subscription"
                >
                  <CreditCard className="w-5 h-5" />
                  <span className="text-sm font-medium">Subscription</span>
                </div>
              </Link>
            )}

            {/* User Profile */}
            {isAuthenticated && user ? (
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-md bg-zinc-900/50">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={user.profileImageUrl || undefined} />
                  <AvatarFallback className="bg-amber-900/30 text-amber-400">
                    {user.firstName?.[0] || user.email?.[0]?.toUpperCase() || <User className="w-4 h-4" />}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">
                    {user.firstName || user.email?.split("@")[0] || "User"}
                  </p>
                </div>
                <a href="/api/logout" className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-zinc-400 hover:text-red-400 transition-colors" data-testid="button-logout">
                  <LogOut className="w-4 h-4" />
                </a>
              </div>
            ) : (
              <a href="/api/login">
                <Button className="w-full neon-button" data-testid="button-login">
                  Sign In
                </Button>
              </a>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-black/80 backdrop-blur-sm border-b border-zinc-800">
          <div className="flex items-center justify-between px-4 h-14">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-zinc-400 hover:text-amber-400 transition-colors"
              data-testid="button-mobile-menu"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <div className="flex-1" />

            {/* Bro query status for logged-in users */}
            {isAuthenticated && broStatus && (
              <div className="flex items-center gap-2 sm:gap-3 mr-2 sm:mr-4 min-w-0 overflow-hidden">
                {broStatus.tier === 'pro' ? (
                  <span className="text-[11px] sm:text-xs text-zinc-400 truncate">
                    <span className="text-amber-400 font-mono">{broStatus.monthlyUsed ?? 0}/{broStatus.monthlyLimit ?? 50}</span> <span className="hidden xs:inline">monthly </span>queries
                  </span>
                ) : (
                  <span className="text-[11px] sm:text-xs text-zinc-400 truncate">
                    <span className="text-amber-400 font-mono">{broStatus.dailyUsed}/{broStatus.dailyLimit}</span> <span className="hidden xs:inline">Bro </span>queries
                  </span>
                )}
                {broStatus.tier && broStatus.tier !== 'free' && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium hidden sm:inline ${broStatus.tier === 'pro' ? 'bg-amber-500/20 text-amber-400' : 'bg-zinc-700/50 text-zinc-300'}`}>
                    {broStatus.tier === 'pro' ? 'PRO' : 'STARTER'}
                  </span>
                )}
              </div>
            )}

            <div className="display-font text-xs tracking-wider hidden sm:block">
              <span className="text-zinc-500">TERMINAL</span>
              <span className="mx-2 text-amber-500">●</span>
              <span className="text-amber-400">ONLINE</span>
            </div>
          </div>
        </header>

        {/* Scrolling ticker tape */}
        {tickerItems.length > 0 && (
          <TickerTape items={tickerItems} flashCells={tickerFlash} />
        )}

        {/* Page content */}
        <main id="main-content" className="flex-1 overflow-auto">
          {children}
        </main>
      </div>

      <AnalysisNotificationBanner />
      <BetaFeedbackWidget />
    </div>
  );
}
