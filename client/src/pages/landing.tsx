import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { 
  TrendingUp, BarChart3, 
  Twitter, Menu, X, Calendar, Briefcase, Bot, Newspaper,
  ArrowRight, CheckCircle2, LogOut
} from "lucide-react";
import { SiDiscord } from "react-icons/si";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import logoImg from "@assets/image_1770296632105.png";
import heroImg from "@assets/image_1770297600939.png";

interface TickerItem {
  symbol: string;
  price: number;
  change: number;
}

function TickerTape() {
  const { data: markets } = useQuery<any>({
    queryKey: ["/api/markets/full"],
  });

  const tickerItems: TickerItem[] = (markets?.globalMarkets || []).slice(0, 20).map((m: any) => ({
    symbol: m.ticker || m.name.slice(0, 4).toUpperCase(),
    price: m.price,
    change: m.change1D,
  }));

  if (tickerItems.length === 0) {
    return null;
  }

  const duplicatedItems = [...tickerItems, ...tickerItems];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-black/90 border-t border-green-900/30 py-2 z-50 overflow-hidden">
      <div className="ticker-scroll flex whitespace-nowrap">
        {duplicatedItems.map((item, i) => (
          <span key={i} className="inline-flex items-center mx-6 ticker-font text-sm">
            <span className="text-zinc-400 mr-2">{item.symbol}</span>
            <span className={item.change >= 0 ? "price-up" : "price-down"}>
              {item.change >= 0 ? "+" : ""}{item.change.toFixed(2)}%
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

function TopNav() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, isLoading, isAuthenticated } = useAuth();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <img src={logoImg} alt="Buy Side Bro" className="w-8 h-8 object-contain" />
            <span className="display-font text-lg tracking-wider neon-green-subtle">
              BUY SIDE BRO
            </span>
          </div>
          
          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-10">
            <Link href="/preview" className="text-zinc-300 hover:text-white transition-colors uppercase text-sm tracking-widest font-medium">
              Features
            </Link>
            {isAuthenticated && user ? (
              <div className="flex items-center gap-4">
                <Link href="/dashboard">
                  <Avatar className="w-8 h-8 cursor-pointer border border-green-500/50">
                    <AvatarImage src={user.profileImageUrl || undefined} />
                    <AvatarFallback className="bg-green-900/30 text-green-400 text-xs">
                      {user.firstName?.[0] || user.email?.[0]?.toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                </Link>
                <a href="/api/logout" className="text-zinc-400 hover:text-red-400 transition-colors" data-testid="button-logout">
                  <LogOut className="w-5 h-5" />
                </a>
              </div>
            ) : (
              <a href="/api/login">
                <button className="border border-green-500 text-green-500 hover:bg-green-500/10 px-5 py-2 rounded text-sm uppercase tracking-wider font-medium transition-all" data-testid="button-member-login">
                  Login
                </button>
              </a>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button 
            className="md:hidden p-2 text-zinc-400 hover:text-green-400 transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            data-testid="button-mobile-nav"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-green-900/30 py-4 space-y-4">
            <Link href="/preview" onClick={() => setMobileMenuOpen(false)}>
              <div className="text-zinc-300 hover:text-white transition-colors uppercase text-sm tracking-widest font-medium py-2">
                Features
              </div>
            </Link>
            {isAuthenticated && user ? (
              <div className="flex items-center gap-3 py-2">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={user.profileImageUrl || undefined} />
                  <AvatarFallback className="bg-green-900/30 text-green-400 text-xs">
                    {user.firstName?.[0] || user.email?.[0]?.toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <span className="text-white text-sm">{user.firstName || user.email?.split("@")[0]}</span>
                <a href="/api/logout" className="ml-auto text-zinc-400 hover:text-red-400 transition-colors" data-testid="button-logout-mobile">
                  <LogOut className="w-5 h-5" />
                </a>
              </div>
            ) : (
              <a href="/api/login" onClick={() => setMobileMenuOpen(false)}>
                <button className="border border-green-500 text-green-500 w-full px-5 py-2 rounded text-sm uppercase tracking-wider font-medium mt-2" data-testid="button-member-login-mobile">
                  Login
                </button>
              </a>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}

function HeroSection() {
  const { isAuthenticated } = useAuth();
  const valueProps = [
    "Real time global market data",
    "Deep stock analysis",
    "Portfolio tracking & insights",
    "Ask your bro any question"
  ];

  return (
    <section className="relative min-h-screen flex items-center justify-center pt-20 pb-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="flex flex-col lg:flex-row items-center lg:items-end justify-between gap-8 lg:gap-16">
          <div className="lg:w-1/2 flex justify-center order-2 lg:order-1">
            <img
              src={heroImg}
              alt="Buy Side Bro"
              className="w-72 h-72 md:w-96 md:h-96 lg:w-[28rem] lg:h-[28rem] object-contain"
              data-testid="img-hero"
            />
          </div>

          <div className="lg:w-1/2 text-center lg:text-left order-1 lg:order-2">
            <h1 className="display-font text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold mb-4 leading-tight text-white">
              Markets. Stocks.<br />Portfolios. Sorted.
            </h1>
            <p className="text-green-400 text-xl md:text-2xl mb-8 display-font italic">
              The Buy Side Terminal. Rebuilt.
            </p>

            <div className="space-y-3 mb-8">
              {valueProps.map((prop, i) => (
                <div key={i} className="flex items-center gap-3 justify-center lg:justify-start">
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span className="text-zinc-300 text-sm md:text-base">{prop}</span>
                </div>
              ))}
            </div>

            <Link href={isAuthenticated ? "/whats-up" : "/preview"}>
              <button className="bg-green-500 hover:bg-green-400 text-black font-bold px-10 py-4 rounded text-lg uppercase tracking-wider transition-all duration-200 shadow-[0_0_20px_rgba(0,255,0,0.3)] hover:shadow-[0_0_30px_rgba(0,255,0,0.5)]" data-testid="button-launch-terminal">
                Launch Terminal
              </button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function StatsSection() {
  const stats = [
    { value: "50+", label: "Global Markets" },
    { value: "Real-Time", label: "Market Data" },
    { value: "AI", label: "Powered Insights" },
    { value: "14 Days", label: "Free Trial" },
  ];

  return (
    <section className="py-16 border-y border-green-900/30 bg-green-950/10">
      <div className="max-w-6xl mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, i) => (
            <div key={i} className="text-center">
              <div className="display-font text-3xl md:text-4xl neon-green-subtle mb-2">{stat.value}</div>
              <div className="text-zinc-400 text-sm uppercase tracking-wide">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  const features = [
    {
      icon: TrendingUp,
      title: "LIVE MARKETS",
      description: "Track global indices, futures, commodities, forex, and sector ETFs in real-time with professional-grade data.",
    },
    {
      icon: Briefcase,
      title: "PORTFOLIO TRACKER",
      description: "Manage your holdings, track cost basis, and monitor your portfolio performance with detailed analytics.",
    },
    {
      icon: Bot,
      title: "AI ASSISTANT",
      description: "Chat with our AI-powered assistant for market insights, stock analysis, and trading ideas.",
    },
    {
      icon: BarChart3,
      title: "STOCK ANALYSIS",
      description: "Deep fundamental analysis powered by AI. Get comprehensive reports on any stock instantly.",
    },
    {
      icon: Calendar,
      title: "EARNINGS CALENDAR",
      description: "Never miss an earnings report. Track upcoming announcements and historical results.",
    },
    {
      icon: Newspaper,
      title: "MARKET NEWS",
      description: "Curated financial news from top sources. Stay informed on what's moving markets.",
    },
  ];

  return (
    <section id="features" className="py-20 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="display-font text-3xl md:text-4xl text-white mb-4 uppercase tracking-wider">
            Everything You Need
          </h2>
          <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
            Professional trading tools without the professional price tag.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <div 
              key={i} 
              className="terminal-card rounded-lg p-6 hover:border-green-500/50 transition-all duration-300 group"
              data-testid={`card-feature-${i}`}
            >
              <div className="p-3 rounded-lg bg-green-900/20 border border-green-900/30 w-fit mb-4 group-hover:border-green-500/50 transition-colors">
                <feature.icon className="w-6 h-6 text-green-500" />
              </div>
              <h3 className="display-font text-lg neon-green-subtle mb-3">{feature.title}</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>

        <div className="text-center mt-12">
          <Link href="/preview">
            <button className="neon-button px-8 py-3 rounded-md text-lg flex items-center gap-2 mx-auto" data-testid="button-explore-features">
              See It In Action <ArrowRight className="w-5 h-5" />
            </button>
          </Link>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { step: "01", title: "Preview the Terminal", description: "See what's inside before you commit" },
    { step: "02", title: "Login", description: "14 days of full access, no credit card needed" },
    { step: "03", title: "Trade Smarter", description: "Use AI-powered tools for real-time market insights" },
  ];

  return (
    <section className="py-20 px-4 border-t border-green-900/30">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="display-font text-3xl md:text-4xl text-white mb-4 uppercase tracking-wider">
            How It Works
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((item, i) => (
            <div key={i} className="text-center">
              <div className="display-font text-5xl neon-green-subtle mb-4">{item.step}</div>
              <h3 className="display-font text-xl text-white mb-2">{item.title}</h3>
              <p className="text-zinc-400">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTASection() {
  return (
    <section className="py-20 px-4 border-t border-green-900/30 bg-gradient-to-b from-transparent to-green-950/20">
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="display-font text-3xl md:text-4xl text-white mb-4">
          Ready to level up your trading?
        </h2>
        <p className="text-zinc-400 text-lg mb-3">
          14 days free. No commitment. No credit card required.
        </p>
        <p className="text-zinc-500 text-sm mb-8">
          $10/month after trial. Extra AI credit packs available anytime.
        </p>
        <a href="/api/login">
          <button className="bg-green-500 hover:bg-green-400 text-black font-bold px-10 py-4 rounded text-lg uppercase tracking-wider transition-all duration-200 shadow-[0_0_20px_rgba(0,255,0,0.3)] hover:shadow-[0_0_30px_rgba(0,255,0,0.5)] inline-flex items-center gap-3 mx-auto" data-testid="button-cta">
            Login <ArrowRight className="w-6 h-6" />
          </button>
        </a>
        <p className="text-zinc-600 text-xs mt-4">
          Sign in with Google, Apple, GitHub, or email
        </p>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="py-12 px-4 border-t border-green-900/30 mb-12">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <img src={logoImg} alt="Buy Side Bro" className="w-10 h-10 object-contain" />
              <span className="display-font text-lg tracking-wider neon-green-subtle">
                BUY SIDE BRO
              </span>
            </div>
            <p className="text-zinc-500 text-sm">
              Professional trading tools for everyone. No Bloomberg terminal required.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-white font-semibold mb-4 uppercase text-sm tracking-wide">Product</h4>
            <div className="space-y-2">
              <Link href="/dashboard"><span className="block text-zinc-400 hover:text-green-400 transition-colors text-sm">Markets</span></Link>
              <Link href="/portfolio"><span className="block text-zinc-400 hover:text-green-400 transition-colors text-sm">Portfolio</span></Link>
              <Link href="/analysis"><span className="block text-zinc-400 hover:text-green-400 transition-colors text-sm">Analysis</span></Link>
              <Link href="/news"><span className="block text-zinc-400 hover:text-green-400 transition-colors text-sm">News</span></Link>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-white font-semibold mb-4 uppercase text-sm tracking-wide">Quick Links</h4>
            <div className="space-y-2">
              <Link href="/preview"><span className="block text-zinc-400 hover:text-green-400 transition-colors text-sm">Features</span></Link>
              <Link href="/chat"><span className="block text-zinc-400 hover:text-green-400 transition-colors text-sm">Ask Bro</span></Link>
              <Link href="/earnings"><span className="block text-zinc-400 hover:text-green-400 transition-colors text-sm">Earnings</span></Link>
              <Link href="/watchlist"><span className="block text-zinc-400 hover:text-green-400 transition-colors text-sm">Watchlist</span></Link>
            </div>
          </div>

          {/* Info */}
          <div>
            <h4 className="text-white font-semibold mb-4 uppercase text-sm tracking-wide">Info</h4>
            <div className="space-y-2">
              <Link href="/dashboard/subscription"><span className="block text-zinc-400 hover:text-green-400 transition-colors text-sm">Pricing</span></Link>
              <a href="mailto:support@buysidebro.com" className="block text-zinc-400 hover:text-green-400 transition-colors text-sm">Contact</a>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="pt-8 border-t border-green-900/30 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-zinc-500 text-sm">
            © 2026 Buy Side Bro. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <a href="https://x.com/buysidebro" target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-green-400 transition-colors" data-testid="link-twitter">
              <Twitter className="w-5 h-5" />
            </a>
            <a href="https://discord.gg/buysidebro" target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-green-400 transition-colors" data-testid="link-discord">
              <SiDiscord className="w-5 h-5" />
            </a>
          </div>
        </div>

        {/* Disclaimers */}
        <div className="mt-8 pt-6 border-t border-zinc-800">
          <p className="text-zinc-600 text-xs leading-relaxed text-center max-w-4xl mx-auto">
            <strong className="text-zinc-500">Disclaimer:</strong> Buy Side Bro is for informational purposes only and does not constitute financial, investment, trading, or other advice. 
            The information provided should not be relied upon for making investment decisions. Past performance is not indicative of future results. 
            Always conduct your own research and consult with a qualified financial advisor before making any investment decisions. 
            Trading stocks, options, and other securities involves risk and may result in substantial losses. You should only invest money you can afford to lose.
          </p>
          <p className="text-zinc-700 text-xs text-center mt-4">
            Buy Side Bro is not a registered broker-dealer or investment advisor. Market data may be delayed.
          </p>
        </div>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black scanline">
      <TopNav />
      <HeroSection />
      <StatsSection />
      <FeaturesSection />
      <HowItWorks />
      <CTASection />
      <Footer />
      <TickerTape />
    </div>
  );
}
