import { Link, useLocation } from "wouter";
import { ReactNode } from "react";
import { LayoutGrid, Briefcase, TrendingUp, Calendar, Newspaper, MessageSquare, ChevronRight, Menu, X, Sparkles } from "lucide-react";
import { useState } from "react";
import logoImg from "@assets/image_1770291732587.png";

interface DashboardLayoutProps {
  children: ReactNode;
}

const navItems = [
  { path: "/whats-up", label: "What's Up?", icon: Sparkles },
  { path: "/dashboard", label: "Markets", icon: LayoutGrid },
  { path: "/portfolio", label: "Portfolio", icon: Briefcase },
  { path: "/analysis", label: "Analysis", icon: TrendingUp },
  { path: "/earnings", label: "Earnings", icon: Calendar },
  { path: "/news", label: "News", icon: Newspaper },
  { path: "/chat", label: "Ask Bro", icon: MessageSquare },
];

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-black flex">
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
        w-64 bg-black border-r border-green-900/30
        transform transition-transform duration-200 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-4 border-b border-green-900/30">
            <Link href="/" className="flex items-center gap-3">
              <img src={logoImg} alt="Buy Side Bro" className="w-12 h-12 object-contain drop-shadow-[0_0_10px_rgba(0,255,0,0.4)]" />
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
                        ? 'bg-green-900/20 border border-green-900/40 text-green-400' 
                        : 'text-zinc-400 hover:text-green-400 hover:bg-green-900/10'
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
          <div className="p-4 border-t border-green-900/30">
            <Link href="/">
              <button className="w-full neon-button px-4 py-2 rounded text-sm flex items-center justify-center gap-1">
                Home <ChevronRight className="w-4 h-4" />
              </button>
            </Link>
          </div>
        </div>
      </aside>
      
      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-black/80 backdrop-blur-sm border-b border-green-900/30">
          <div className="flex items-center justify-between px-4 h-14">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 text-zinc-400 hover:text-green-400 transition-colors"
              data-testid="button-mobile-menu"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            
            <div className="flex-1" />
            
            <div className="display-font text-xs tracking-wider hidden sm:block">
              <span className="text-zinc-500">TERMINAL</span>
              <span className="mx-2 text-green-500">●</span>
              <span className="text-green-400">ONLINE</span>
            </div>
          </div>
        </header>
        
        {/* Page content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
