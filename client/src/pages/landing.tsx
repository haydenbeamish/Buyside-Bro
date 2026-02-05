import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Search, TrendingUp, MessageSquare, ChevronRight, BarChart3, Zap, Users, Twitter } from "lucide-react";
import { SiDiscord } from "react-icons/si";
import logoImg from "@assets/Gemini_Generated_Image_rwyizvrwyizvrwyi_1770290400995.png";

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
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-sm border-b border-green-900/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <span className="display-font text-xl tracking-wider neon-green-subtle">
              BUY SIDE BRO
            </span>
          </div>
          
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
            <Link href="/dashboard" className="text-zinc-400 hover:text-green-400 transition-colors uppercase text-sm tracking-wide font-medium">
              Login
            </Link>
            <Link href="/dashboard">
              <button className="neon-button px-4 py-2 rounded text-sm flex items-center gap-1" data-testid="button-get-access">
                Get Access <ChevronRight className="w-4 h-4" />
              </button>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}

function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center pt-16 pb-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-12">
          <div className="lg:w-1/2 flex justify-center">
            <img 
              src={logoImg} 
              alt="Buy Side Bro" 
              className="w-64 h-64 md:w-80 md:h-80 object-contain glow-pulse"
              data-testid="img-logo"
            />
          </div>
          
          <div className="lg:w-1/2 text-center lg:text-left">
            <h1 className="display-font text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
              <span className="text-white">Don't get ripped off</span>
              <br />
              <span className="text-white">by Bloomberg.</span>
            </h1>
            <p className="text-zinc-400 text-lg md:text-xl mb-8 max-w-lg">
              I've got you bro.
            </p>
            <Link href="/dashboard">
              <button className="neon-button px-8 py-3 rounded-md text-lg flex items-center gap-2 mx-auto lg:mx-0" data-testid="button-launch-terminal">
                Launch Terminal <ChevronRight className="w-5 h-5" />
              </button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  const features = [
    {
      icon: Search,
      title: "BRO INSIGHTS",
      description: "Actionable calls from the desk.",
    },
    {
      icon: BarChart3,
      title: "TERMINAL TOOLS",
      description: "Institutional-grade charts & data.",
    },
    {
      icon: Zap,
      title: "MARKET MOVES",
      description: "Catch the pumps before the crowd.",
    },
  ];

  return (
    <section id="features" className="py-20 px-4">
      <div className="max-w-5xl mx-auto">
        <h2 className="display-font text-2xl md:text-3xl text-white mb-12 uppercase tracking-wider">
          Features
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <div 
              key={i} 
              className="terminal-card rounded-lg p-6 hover:border-green-500/50 transition-all duration-300"
              data-testid={`card-feature-${i}`}
            >
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-green-900/20 border border-green-900/30">
                  <feature.icon className="w-6 h-6 text-green-500" />
                </div>
                <div>
                  <h3 className="display-font text-lg neon-green-subtle mb-2">{feature.title}</h3>
                  <p className="text-zinc-400 text-sm">{feature.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CommunityFeed() {
  const messages = [
    { user: "HedgeKing_99", message: "$TSLA looking ripe for a bounce." },
    { user: "OptionPlayah", message: "Anybody seeing this flow on $NVDA?" },
    { user: "HedgeKing_99", message: "$TSLA looking ripe for.." },
    { user: "OptionPlayah", message: "Anybody seeing this flow on $NVDA?" },
  ];

  return (
    <section id="community" className="py-20 px-4">
      <div className="max-w-5xl mx-auto">
        <h2 className="display-font text-2xl md:text-3xl text-white mb-8 uppercase tracking-wider">
          Community Feed
        </h2>
        
        <div className="terminal-card rounded-lg p-6">
          <div className="space-y-3 mb-6">
            {messages.map((msg, i) => (
              <div key={i} className="text-sm">
                <span className="neon-green-subtle font-semibold">{msg.user}:</span>
                <span className="text-zinc-300 ml-2">{msg.message}</span>
              </div>
            ))}
          </div>
          
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Type your message..."
              className="flex-1 bg-black/50 border border-green-900/30 rounded px-4 py-2 text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-green-500/50 transition-colors"
              data-testid="input-community-message"
            />
            <button className="p-2 text-green-500 hover:text-green-400 transition-colors">
              <MessageSquare className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="py-8 px-4 border-t border-green-900/30 mb-12">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="display-font text-lg tracking-wider neon-green-subtle">
          BUY SIDE BRO
        </div>
        
        <div className="flex items-center gap-6 text-sm text-zinc-500">
          <a href="#" className="hover:text-green-400 transition-colors">Contact</a>
          <a href="#" className="hover:text-green-400 transition-colors">Terms</a>
          <a href="#" className="hover:text-green-400 transition-colors">API</a>
        </div>
        
        <div className="flex items-center gap-4">
          <a href="#" className="text-zinc-500 hover:text-green-400 transition-colors">
            <Twitter className="w-5 h-5" />
          </a>
          <a href="#" className="text-zinc-500 hover:text-green-400 transition-colors">
            <SiDiscord className="w-5 h-5" />
          </a>
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
      <FeaturesSection />
      <CommunityFeed />
      <Footer />
      <TickerTape />
    </div>
  );
}
