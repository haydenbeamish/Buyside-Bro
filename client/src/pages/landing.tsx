import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Menu, X, ArrowRight, Twitter } from "lucide-react";
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
            <Link href="/dashboard/markets" className="text-zinc-400 hover:text-green-400 transition-colors uppercase text-sm tracking-wide font-medium">
              Markets
            </Link>
            <Link href="/dashboard/portfolio" className="text-zinc-400 hover:text-green-400 transition-colors uppercase text-sm tracking-wide font-medium">
              Portfolio
            </Link>
            <Link href="/dashboard/chat" className="text-zinc-400 hover:text-green-400 transition-colors uppercase text-sm tracking-wide font-medium">
              Chat
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
            <Link href="/dashboard/markets" onClick={() => setMobileMenuOpen(false)}>
              <div className="text-zinc-400 hover:text-green-400 transition-colors uppercase text-sm tracking-wide font-medium py-2">
                Markets
              </div>
            </Link>
            <Link href="/dashboard/portfolio" onClick={() => setMobileMenuOpen(false)}>
              <div className="text-zinc-400 hover:text-green-400 transition-colors uppercase text-sm tracking-wide font-medium py-2">
                Portfolio
              </div>
            </Link>
            <Link href="/dashboard/chat" onClick={() => setMobileMenuOpen(false)}>
              <div className="text-zinc-400 hover:text-green-400 transition-colors uppercase text-sm tracking-wide font-medium py-2">
                Chat
              </div>
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}

function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center pt-16 pb-32">
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
            <p className="text-green-400 text-xl md:text-2xl mb-8 display-font">
              I've got you bro.
            </p>

            <Link href="/dashboard">
              <button className="neon-button px-8 py-3 rounded-md text-lg flex items-center justify-center gap-2 mx-auto lg:mx-0" data-testid="button-launch-terminal">
                Launch Terminal <ArrowRight className="w-5 h-5" />
              </button>
            </Link>
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
        <div className="flex items-center gap-2">
          <img src={logoImg} alt="Buy Side Bro" className="w-8 h-8 object-contain" />
          <span className="display-font text-lg tracking-wider neon-green-subtle">
            BUY SIDE BRO
          </span>
        </div>
        
        <p className="text-zinc-500 text-sm">
          © 2025 Buy Side Bro
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
    </footer>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black scanline">
      <TopNav />
      <HeroSection />
      <Footer />
      <TickerTape />
    </div>
  );
}
