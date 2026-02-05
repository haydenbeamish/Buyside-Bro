import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { 
  Search, TrendingUp, MessageSquare, ChevronRight, BarChart3, Zap, 
  Users, Twitter, Menu, X, Calendar, Briefcase, Bot, Newspaper,
  CheckCircle2, ArrowRight
} from "lucide-react";
import { SiDiscord } from "react-icons/si";
import logoImg from "@assets/image_1770291732587.png";

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

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-sm border-b border-green-900/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <img src={logoImg} alt="Buy Side Bro" className="w-8 h-8 object-contain" />
            <span className="display-font text-xl tracking-wider neon-green-subtle">
              BUY SIDE BRO
            </span>
          </div>
          
          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <Link href="/dashboard" className="text-zinc-400 hover:text-green-400 transition-colors uppercase text-sm tracking-wide font-medium">
              Dashboard
            </Link>
            <Link href="#features" className="text-zinc-400 hover:text-green-400 transition-colors uppercase text-sm tracking-wide font-medium">
              Features
            </Link>
            <Link href="#community" className="text-zinc-400 hover:text-green-400 transition-colors uppercase text-sm tracking-wide font-medium">
              Community
            </Link>
            <Link href="/dashboard">
              <button className="neon-button px-4 py-2 rounded text-sm flex items-center gap-1" data-testid="button-get-access">
                Get Access <ChevronRight className="w-4 h-4" />
              </button>
            </Link>
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
            <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)}>
              <div className="text-zinc-400 hover:text-green-400 transition-colors uppercase text-sm tracking-wide font-medium py-2">
                Dashboard
              </div>
            </Link>
            <Link href="#features" onClick={() => setMobileMenuOpen(false)}>
              <div className="text-zinc-400 hover:text-green-400 transition-colors uppercase text-sm tracking-wide font-medium py-2">
                Features
              </div>
            </Link>
            <Link href="#community" onClick={() => setMobileMenuOpen(false)}>
              <div className="text-zinc-400 hover:text-green-400 transition-colors uppercase text-sm tracking-wide font-medium py-2">
                Community
              </div>
            </Link>
            <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)}>
              <button className="neon-button w-full px-4 py-2 rounded text-sm flex items-center justify-center gap-1 mt-2" data-testid="button-get-access-mobile">
                Get Access <ChevronRight className="w-4 h-4" />
              </button>
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}

function HeroSection() {
  const valueProps = [
    "Real-time global market data",
    "AI-powered stock analysis",
    "Portfolio tracking & insights",
    "Zero Bloomberg terminal fees"
  ];

  return (
    <section className="relative min-h-screen flex items-center justify-center pt-20 pb-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-8 lg:gap-12">
          <div className="lg:w-1/2 flex justify-center order-2 lg:order-1">
            <img 
              src={logoImg} 
              alt="Buy Side Bro" 
              className="w-64 h-64 md:w-80 md:h-80 lg:w-[26rem] lg:h-[26rem] object-contain drop-shadow-[0_0_30px_rgba(0,255,0,0.5)]"
              data-testid="img-logo"
            />
          </div>
          
          <div className="lg:w-1/2 text-center lg:text-left order-1 lg:order-2">
            <h1 className="display-font text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold mb-4 leading-tight">
              <span className="text-white">Don't get ripped off</span>
              <br />
              <span className="text-white">by Bloomberg.</span>
            </h1>
            <p className="text-green-400 text-xl md:text-2xl mb-6 display-font">
              I've got you bro.
            </p>
            
            {/* Value Props */}
            <div className="space-y-3 mb-8">
              {valueProps.map((prop, i) => (
                <div key={i} className="flex items-center gap-3 justify-center lg:justify-start">
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span className="text-zinc-300 text-sm md:text-base">{prop}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Link href="/dashboard">
                <button className="neon-button px-8 py-3 rounded-md text-lg flex items-center justify-center gap-2 w-full sm:w-auto" data-testid="button-launch-terminal">
                  Launch Terminal <ArrowRight className="w-5 h-5" />
                </button>
              </Link>
              <Link href="#features">
                <button className="px-8 py-3 rounded-md text-lg flex items-center justify-center gap-2 w-full sm:w-auto border border-zinc-700 text-zinc-300 hover:border-green-500/50 hover:text-green-400 transition-all" data-testid="button-learn-more">
                  Learn More
                </button>
              </Link>
            </div>
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
    { value: "Free", label: "To Use" },
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
          <Link href="/dashboard">
            <button className="neon-button px-8 py-3 rounded-md text-lg flex items-center gap-2 mx-auto" data-testid="button-explore-features">
              Explore All Features <ArrowRight className="w-5 h-5" />
            </button>
          </Link>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { step: "01", title: "Sign Up", description: "Create your free account in seconds" },
    { step: "02", title: "Explore Markets", description: "Access real-time data across all asset classes" },
    { step: "03", title: "Get Insights", description: "Use AI-powered tools to analyze and trade smarter" },
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

function CommunityFeed() {
  const messages = [
    { user: "HedgeKing_99", message: "$TSLA looking ripe for a bounce. Volume picking up.", time: "2m ago" },
    { user: "OptionPlayah", message: "Anybody seeing this unusual flow on $NVDA calls?", time: "5m ago" },
    { user: "MacroMike", message: "Fed minutes coming out tomorrow. Staying hedged.", time: "8m ago" },
    { user: "TechTrader", message: "Earnings season starting strong. $AAPL beat estimates.", time: "12m ago" },
    { user: "AlphaSeeker", message: "Energy sector looking interesting here. XLE breaking out.", time: "15m ago" },
  ];

  return (
    <section id="community" className="py-20 px-4 border-t border-green-900/30">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="display-font text-3xl md:text-4xl text-white mb-4 uppercase tracking-wider">
            Live Community Feed
          </h2>
          <p className="text-zinc-400 text-lg">
            Join the conversation with fellow traders.
          </p>
        </div>
        
        <div className="terminal-card rounded-lg p-6">
          <div className="space-y-4 mb-6">
            {messages.map((msg, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg hover:bg-green-900/10 transition-colors">
                <div className="w-8 h-8 rounded-full bg-green-900/30 border border-green-900/50 flex items-center justify-center flex-shrink-0">
                  <Users className="w-4 h-4 text-green-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="neon-green-subtle font-semibold text-sm">{msg.user}</span>
                    <span className="text-zinc-600 text-xs">{msg.time}</span>
                  </div>
                  <p className="text-zinc-300 text-sm">{msg.message}</p>
                </div>
              </div>
            ))}
          </div>
          
          <div className="flex items-center gap-3 pt-4 border-t border-green-900/30">
            <input
              type="text"
              placeholder="Join the conversation..."
              className="flex-1 bg-black/50 border border-green-900/30 rounded-lg px-4 py-3 text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-green-500/50 transition-colors"
              data-testid="input-community-message"
            />
            <button className="neon-button px-4 py-3 rounded-lg flex items-center gap-2" data-testid="button-send-message">
              <MessageSquare className="w-5 h-5" />
              <span className="hidden sm:inline">Send</span>
            </button>
          </div>
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
        <p className="text-zinc-400 text-lg mb-8">
          Join thousands of traders using Buy Side Bro to make smarter decisions.
        </p>
        <Link href="/dashboard">
          <button className="neon-button px-10 py-4 rounded-md text-xl flex items-center gap-3 mx-auto" data-testid="button-cta">
            Get Started Free <ArrowRight className="w-6 h-6" />
          </button>
        </Link>
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
              <Link href="/dashboard/markets"><span className="block text-zinc-400 hover:text-green-400 transition-colors text-sm">Markets</span></Link>
              <Link href="/dashboard/portfolio"><span className="block text-zinc-400 hover:text-green-400 transition-colors text-sm">Portfolio</span></Link>
              <Link href="/dashboard/analysis"><span className="block text-zinc-400 hover:text-green-400 transition-colors text-sm">Analysis</span></Link>
              <Link href="/dashboard/news"><span className="block text-zinc-400 hover:text-green-400 transition-colors text-sm">News</span></Link>
            </div>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-white font-semibold mb-4 uppercase text-sm tracking-wide">Resources</h4>
            <div className="space-y-2">
              <a href="#" className="block text-zinc-400 hover:text-green-400 transition-colors text-sm">Documentation</a>
              <a href="#" className="block text-zinc-400 hover:text-green-400 transition-colors text-sm">API</a>
              <a href="#" className="block text-zinc-400 hover:text-green-400 transition-colors text-sm">Blog</a>
              <a href="#" className="block text-zinc-400 hover:text-green-400 transition-colors text-sm">Support</a>
            </div>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-white font-semibold mb-4 uppercase text-sm tracking-wide">Legal</h4>
            <div className="space-y-2">
              <a href="#" className="block text-zinc-400 hover:text-green-400 transition-colors text-sm">Terms of Service</a>
              <a href="#" className="block text-zinc-400 hover:text-green-400 transition-colors text-sm">Privacy Policy</a>
              <a href="#" className="block text-zinc-400 hover:text-green-400 transition-colors text-sm">Disclaimer</a>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="pt-8 border-t border-green-900/30 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-zinc-500 text-sm">
            © 2025 Buy Side Bro. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <a href="#" className="text-zinc-500 hover:text-green-400 transition-colors" data-testid="link-twitter">
              <Twitter className="w-5 h-5" />
            </a>
            <a href="#" className="text-zinc-500 hover:text-green-400 transition-colors" data-testid="link-discord">
              <SiDiscord className="w-5 h-5" />
            </a>
          </div>
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
      <CommunityFeed />
      <CTASection />
      <Footer />
      <TickerTape />
    </div>
  );
}
