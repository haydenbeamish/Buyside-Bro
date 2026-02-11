import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp, BarChart3,
  Twitter, Menu, X, Briefcase, Bot,
  ArrowRight, CheckCircle2, LogOut, Shield, Zap, Clock, Eye, Brain, Sparkles,
  Bell, Newspaper
} from "lucide-react";
import { SiDiscord } from "react-icons/si";
import { useAuth } from "@/hooks/use-auth";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import logoImg from "@assets/image_1770442846290.png";
import heroImg from "@assets/image_1770442846290.png";
import screenshotWhatsUp from "@assets/image_1770367320606.png";
import screenshotMarkets from "@assets/image_1770353894237.png";
import screenshotPortfolio from "@assets/image_1770293388261.png";
import screenshotWatchlist from "@assets/IMG_0610_1770426137445.jpeg";
import screenshotDeepAnalysis from "@assets/image_1770353948671.png";
import screenshotEarnings from "@assets/image_1770367362870.png";
import screenshotAskBro from "@assets/image_1770353921106.png";

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
    <div className="fixed bottom-0 left-0 right-0 bg-black/90 border-t border-zinc-800 py-2 z-50 overflow-hidden">
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
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-sm" aria-label="Main navigation">
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
            {isAuthenticated && user ? (
              <div className="flex items-center gap-4">
                <Link href="/dashboard">
                  <Avatar className="w-8 h-8 cursor-pointer border border-amber-500/50">
                    <AvatarImage src={user.profileImageUrl || undefined} />
                    <AvatarFallback className="bg-amber-900/30 text-amber-400 text-xs">
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
                <button className="border border-amber-500 text-amber-500 hover:bg-amber-500/10 px-5 py-2 rounded text-sm uppercase tracking-wider font-medium transition-all" data-testid="button-member-login">
                  Login
                </button>
              </a>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button 
            className="md:hidden p-2 text-zinc-400 hover:text-amber-400 transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            data-testid="button-mobile-nav"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-zinc-800 py-4 space-y-4">
            {isAuthenticated && user ? (
              <div className="flex items-center gap-3 py-2">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={user.profileImageUrl || undefined} />
                  <AvatarFallback className="bg-amber-900/30 text-amber-400 text-xs">
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
                <button className="border border-amber-500 text-amber-500 w-full px-5 py-2 rounded text-sm uppercase tracking-wider font-medium mt-2" data-testid="button-member-login-mobile">
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
    "100+ live tickers — indices, futures, forex, commodities",
    "AI Deep Dive reports with BUY/HOLD/SELL recommendations",
    "Automated portfolio tracking & performance analytics",
    "Chat Bro — your AI-powered research assistant"
  ];

  return (
    <section className="relative min-h-screen flex items-center justify-center pt-20 pb-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="flex flex-col lg:flex-row items-center lg:items-end justify-between gap-8 lg:gap-16">
          <div className="lg:w-1/2 flex justify-center order-2 lg:order-1">
            <img
              src={heroImg}
              alt="Buy Side Bro terminal mascot - your AI-powered financial markets assistant"
              className="w-56 h-56 sm:w-72 sm:h-72 md:w-96 md:h-96 lg:w-[28rem] lg:h-[28rem] object-contain"
              width="448"
              height="448"
              data-testid="img-hero"
            />
          </div>

          <div className="lg:w-1/2 text-center lg:text-left order-1 lg:order-2">
            <h1 className="display-font text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold mb-4 leading-tight text-white">
              Markets. Stocks.<br />Portfolios. Sorted.
            </h1>
            <p className="text-amber-400 text-xl md:text-2xl mb-8 display-font italic">
              Your AI-Powered Investment Research Terminal.
            </p>

            <div className="space-y-3 mb-8">
              {valueProps.map((prop, i) => (
                <div key={i} className="flex items-center gap-3 justify-center lg:justify-start">
                  <CheckCircle2 className="w-5 h-5 text-amber-500 flex-shrink-0" />
                  <span className="text-zinc-300 text-sm md:text-base">{prop}</span>
                </div>
              ))}
            </div>

            <Link href={isAuthenticated ? "/whats-up" : "/dashboard"}>
              <button className="bg-amber-600 hover:bg-amber-400 text-black font-bold px-6 sm:px-10 py-3 sm:py-4 rounded text-base sm:text-lg uppercase tracking-wider transition-all duration-200 shadow-[0_0_20px_rgba(255,215,0,0.3)] hover:shadow-[0_0_30px_rgba(255,215,0,0.5)]" data-testid="button-launch-terminal">
                Launch Terminal
              </button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

const featureShowcase = [
  {
    image: screenshotWhatsUp,
    icon: Sparkles,
    title: "WHAT'S UP",
    subtitle: "AI-generated market wraps for every region",
    description: "Start every session with AI-generated regional wraps for US, ASX, European, and Asian markets — auto-triggered on each market close. Get top gainers and losers narratives, overnight recaps, and closing summaries all in one feed.",
  },
  {
    image: screenshotMarkets,
    icon: TrendingUp,
    title: "LIVE MARKETS",
    subtitle: "100+ tickers with TradingView charts",
    description: "Track 100+ tickers across indices, futures, commodities, forex, US sectors, ASX sectors, and thematics with integrated TradingView charts. View 1-day, 1-month, 3-month, and 1-year performance with 10/20/100/200-day moving average analysis.",
  },
  {
    image: screenshotPortfolio,
    icon: Briefcase,
    title: "PORTFOLIO TRACKER",
    subtitle: "Automated holdings with AI-powered insights",
    description: "Automatically import holdings from your NAV Portfolio Notebook via email. View net/gross exposure, long/short split, cash, futures, and options breakdowns. AI thematic classification of holdings, sector and market cap exposure analysis, plus an AI portfolio review that flags concentration risks.",
  },
  {
    image: screenshotWatchlist,
    icon: Eye,
    title: "WATCHLIST",
    subtitle: "Monitor stocks with push notification alerts",
    description: "Build a watchlist of any stock worldwide. Track price, day change, volume spikes, market cap, P/E ratios, and 52-week range at a glance. Set push notification price alerts when moves exceed your thresholds. Add inline notes, sort by any column, and export to CSV.",
  },
  {
    image: screenshotDeepAnalysis,
    icon: BarChart3,
    title: "COMPANY ANALYSIS",
    subtitle: "Deep Dive reports — hedge fund quality AI research",
    description: "Run Deep Dive reports that deliver hedge fund quality research in 3–5 minutes. Choose from multiple AI models including Claude, Gemini, and DeepSeek. Sources include SEC filings, ASX announcements, financials, and web search. Get structured BUY/HOLD/SELL recommendations with confidence scores and target prices. Plus Quick Snapshots with P&L tables, forward P/E charts, and Bloomberg-style fundamentals.",
  },
  {
    image: screenshotEarnings,
    icon: Brain,
    title: "EARNINGS ANALYSIS",
    subtitle: "AI-powered previews & reviews with multiple models",
    description: "Run Deep Analysis mode for comprehensive earnings breakdowns or quick preview/review summaries. See consensus expectations, beat/miss analysis, and guidance changes — all powered by your choice of AI models including Claude, Gemini, and DeepSeek.",
  },
  {
    image: screenshotAskBro,
    icon: Bot,
    title: "ASK BRO",
    subtitle: "Your AI research assistant with live data awareness",
    description: "Ask complex financial questions and get data-backed answers. Bro auto-detects tickers and pulls real-time market data into every response. Conversation memory retains up to 50 messages so you can drill deeper with natural follow-ups.",
  },
  {
    image: screenshotWhatsUp,
    icon: Newspaper,
    title: "NEWS & AI SUMMARIES",
    subtitle: "AI-curated news across your portfolio",
    description: "Company news sourced from ASX announcements, SEC EDGAR, and financial news feeds. AI reads and summarizes 72 hours of news for up to 10 stocks at once. Auto-generate portfolio news summaries across all your top holdings.",
  },
  {
    image: screenshotPortfolio,
    icon: TrendingUp,
    title: "NAV & PERFORMANCE",
    subtitle: "Automated performance tracking & benchmarking",
    description: "Automated NAV tracking from IRESS emails. View monthly performance with MTD, QTD, FY, annualized returns, and Sharpe ratio. Compare against MSCI ACWI in AUD benchmark. Export to Bloomberg format with SharePoint upload support.",
  },
  {
    image: screenshotWatchlist,
    icon: Bell,
    title: "PUSH NOTIFICATIONS",
    subtitle: "Real-time alerts when it matters",
    description: "Get price alerts on watchlist tickers when moves exceed your thresholds. Receive market summary notifications when AI wraps are ready so you never miss a beat.",
  },
];

function FeatureShowcase() {
  return (
    <section className="px-4 py-20">
      <div className="max-w-4xl mx-auto text-center mb-16">
        <h2 className="display-font text-3xl md:text-5xl font-bold text-white mb-4 uppercase tracking-wider leading-tight">
          Inside the Terminal
        </h2>
        <p className="text-zinc-400 text-lg md:text-xl max-w-2xl mx-auto mb-2">
          Professional-grade market intelligence. No Bloomberg terminal required.
        </p>
        <p className="text-amber-400 text-sm md:text-base display-font">
          10 powerful tools. Free to explore. No credit card.
        </p>
      </div>

      <div className="max-w-5xl mx-auto space-y-20">
        {featureShowcase.map((feature, i) => (
          <div
            key={i}
            className={`flex flex-col ${i % 2 === 1 ? "lg:flex-row-reverse" : "lg:flex-row"} items-center gap-8 lg:gap-12`}
          >
            <div className="lg:w-3/5 w-full">
              <div className="relative rounded-lg overflow-hidden border border-zinc-800 shadow-[0_0_30px_rgba(255,215,0,0.08)]">
                <img
                  src={feature.image}
                  alt={`${feature.title} - ${feature.subtitle}`}
                  className="w-full h-auto object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
              </div>
            </div>

            <div className="lg:w-2/5 w-full text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-amber-900/20 border border-zinc-800 mb-4">
                <feature.icon className="w-4 h-4 text-amber-500" />
                <span className="display-font text-xs neon-green-subtle tracking-widest">{feature.title}</span>
              </div>
              <h3 className="text-xl md:text-2xl font-semibold text-white mb-3">{feature.subtitle}</h3>
              <p className="text-zinc-400 text-sm md:text-base leading-relaxed">{feature.description}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function PricingBadges() {
  return (
    <section className="py-20 px-4 border-t border-zinc-800 bg-zinc-950/30">
      <div className="max-w-4xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="p-3 rounded-lg bg-amber-900/20 border border-zinc-800">
              <Clock className="w-6 h-6 text-amber-500" />
            </div>
            <h4 className="display-font text-sm neon-green-subtle tracking-wider">FREE TO EXPLORE</h4>
            <p className="text-zinc-400 text-sm">Browse live markets and get started. No credit card required.</p>
          </div>
          <div className="flex flex-col items-center gap-3">
            <div className="p-3 rounded-lg bg-amber-900/20 border border-zinc-800">
              <Shield className="w-6 h-6 text-amber-500" />
            </div>
            <h4 className="display-font text-sm neon-green-subtle tracking-wider">INSTANT ACCESS</h4>
            <p className="text-zinc-400 text-sm">Start exploring immediately. Sign in and go.</p>
          </div>
          <div className="flex flex-col items-center gap-3">
            <div className="p-3 rounded-lg bg-amber-900/20 border border-zinc-800">
              <Zap className="w-6 h-6 text-amber-500" />
            </div>
            <h4 className="display-font text-sm neon-green-subtle tracking-wider">$10/MONTH PRO</h4>
            <p className="text-zinc-400 text-sm">Unlock AI analysis, portfolio tracking, alerts, and $5 of Bro credits.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function CTASection() {
  return (
    <section className="py-20 px-4 border-t border-zinc-800">
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="display-font text-2xl md:text-4xl text-white mb-3 uppercase tracking-wider">
          Ready to see it in action?
        </h2>
        <p className="text-zinc-400 text-lg mb-2">
          Free to explore. No commitment required.
        </p>
        <p className="text-zinc-500 text-sm mb-8">
          Upgrade for just $10/month. Need more Bro power? Grab extra credit packs anytime.
        </p>
        <Link href="/dashboard">
          <button
            className="bg-amber-600 hover:bg-amber-400 text-black font-bold px-6 sm:px-10 py-3 sm:py-4 rounded text-base sm:text-lg uppercase tracking-wider transition-all duration-200 shadow-[0_0_20px_rgba(255,215,0,0.3)] hover:shadow-[0_0_30px_rgba(255,215,0,0.5)] inline-flex items-center gap-3"
            data-testid="button-cta"
          >
            Open Terminal <ArrowRight className="w-5 h-5" />
          </button>
        </Link>
        <p className="text-zinc-600 text-xs mt-4">
          Sign in with Google, Apple, GitHub, or email
        </p>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="py-12 px-4 border-t border-zinc-800 mb-12">
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
            <nav aria-label="Product links" className="space-y-2">
              <Link href="/dashboard"><span className="block text-zinc-400 hover:text-amber-400 transition-colors text-sm">Markets</span></Link>
              <Link href="/portfolio"><span className="block text-zinc-400 hover:text-amber-400 transition-colors text-sm">Portfolio</span></Link>
              <Link href="/watchlist"><span className="block text-zinc-400 hover:text-amber-400 transition-colors text-sm">Watchlist</span></Link>
              <Link href="/analysis"><span className="block text-zinc-400 hover:text-amber-400 transition-colors text-sm">Company Analysis</span></Link>
            </nav>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-white font-semibold mb-4 uppercase text-sm tracking-wide">Quick Links</h4>
            <nav aria-label="Quick links" className="space-y-2">
              <Link href="/whats-up"><span className="block text-zinc-400 hover:text-amber-400 transition-colors text-sm">What's Up</span></Link>
              <Link href="/earnings"><span className="block text-zinc-400 hover:text-amber-400 transition-colors text-sm">Earnings</span></Link>
              <Link href="/news"><span className="block text-zinc-400 hover:text-amber-400 transition-colors text-sm">News</span></Link>
              <Link href="/chat"><span className="block text-zinc-400 hover:text-amber-400 transition-colors text-sm">Ask Bro</span></Link>
            </nav>
          </div>

          {/* Info */}
          <div>
            <h4 className="text-white font-semibold mb-4 uppercase text-sm tracking-wide">Info</h4>
            <div className="space-y-2">
              <Link href="/subscription"><span className="block text-zinc-400 hover:text-amber-400 transition-colors text-sm">Pricing</span></Link>
              <a href="mailto:support@buysidebro.com" className="block text-zinc-400 hover:text-amber-400 transition-colors text-sm">Contact</a>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="pt-8 border-t border-zinc-800 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-zinc-500 text-sm">
            © 2026 Buy Side Bro. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <a href="https://x.com/buysidebro" target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-amber-400 transition-colors" data-testid="link-twitter">
              <Twitter className="w-5 h-5" />
            </a>
            <a href="https://discord.gg/buysidebro" target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-amber-400 transition-colors" data-testid="link-discord">
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
  const { isAuthenticated } = useAuth();
  useDocumentTitle();

  return (
    <div className="min-h-screen bg-black scanline pb-14">
      <TopNav />
      <main>
        <HeroSection />
        <FeatureShowcase />
        <PricingBadges />
        <CTASection />
      </main>
      <Footer />
      <TickerTape />
    </div>
  );
}
