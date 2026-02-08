import { Link, useLocation } from "wouter";
import { ReactNode } from "react";
import { LayoutGrid, Briefcase, Newspaper, MessageSquare, Menu, X, Sparkles, CreditCard, LogOut, User, Eye, Shield, Brain, Building2, Loader2 } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useBroStatus } from "@/hooks/use-bro-status";
import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import logoImg from "@assets/image_1770442846290.png";

interface DashboardLayoutProps {
  children: ReactNode;
}

const navItems = [
  { path: "/whats-up", label: "What's Up?", icon: Sparkles },
  { path: "/dashboard", label: "Markets", icon: LayoutGrid },
  { path: "/portfolio", label: "Portfolio", icon: Briefcase },
  { path: "/watchlist", label: "Watchlist", icon: Eye },
  { path: "/analysis", label: "Company", icon: Building2 },
  { path: "/earnings", label: "Earnings", icon: Brain },
  // { path: "/news", label: "News", icon: Newspaper },
  { path: "/chat", label: "Ask Bro", icon: MessageSquare },
];

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
        fixed lg:static inset-y-0 left-0 z-50
        w-64 bg-black border-r border-zinc-800
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
          <nav className="flex-1 p-4 space-y-1">
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
              <div className="flex items-center gap-2 sm:gap-3 mr-2 sm:mr-4">
                <span className="text-[11px] sm:text-xs text-zinc-400 whitespace-nowrap">
                  <span className="text-amber-400 font-mono">{broStatus.dailyUsed}/{broStatus.dailyLimit}</span> <span className="hidden xs:inline">Bro </span>queries
                </span>
                {broStatus.isPro && (
                  <span className="text-[11px] sm:text-xs text-zinc-500 hidden sm:inline">
                    <span className="text-amber-400 font-mono">${(broStatus.credits / 100).toFixed(2)}</span> credits
                  </span>
                )}
              </div>
            )}

            {!isAuthenticated && !isLoading && (
              <a href="/api/login" className="mr-3 hidden lg:block">
                <Button className="neon-button" data-testid="button-login-header">
                  Sign In
                </Button>
              </a>
            )}

            <div className="display-font text-xs tracking-wider hidden sm:block">
              <span className="text-zinc-500">TERMINAL</span>
              <span className="mx-2 text-amber-500">●</span>
              <span className="text-amber-400">ONLINE</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main id="main-content" className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
