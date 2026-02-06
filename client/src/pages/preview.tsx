import { Link } from "wouter";
import { ArrowRight, BarChart3, Bot, TrendingUp, Shield, Zap, Clock } from "lucide-react";
import logoImg from "@assets/image_1770296632105.png";
import screenshotMarkets from "@assets/image_1770353894237.png";
import screenshotAskBro from "@assets/image_1770353921106.png";
import screenshotDeepAnalysis from "@assets/image_1770353948671.png";

const features = [
  {
    image: screenshotMarkets,
    icon: TrendingUp,
    title: "THEMATIC MOVEMENTS",
    subtitle: "See what's moving — across sectors, themes, and global markets",
    description: "Track USA Thematics like Robots & AI, Clean Energy, Cyber Security and more. Real-time price data with 1-day, 1-month, and quarterly change percentages. Spot trends before the crowd.",
  },
  {
    image: screenshotAskBro,
    icon: Bot,
    title: "ASK BRO",
    subtitle: "Your autonomous financial research agent",
    description: "Ask complex questions and get data-backed answers. Compare revenue growth, analyze P/E ratios, break down operating margins — your bro thinks, plans, and researches using real-time market data.",
  },
  {
    image: screenshotDeepAnalysis,
    icon: BarChart3,
    title: "DEEP ANALYSIS",
    subtitle: "Hedge fund quality research at your fingertips",
    description: "AI-powered fundamental analysis that gathers data, analyzes financials, evaluates market position, and generates buy/hold/sell recommendations with target prices and confidence scores.",
  },
];

export default function PreviewPage() {
  return (
    <div className="min-h-screen bg-black scanline">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-sm border-b border-green-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/">
              <div className="flex items-center gap-2 cursor-pointer">
                <img src={logoImg} alt="Buy Side Bro" className="w-8 h-8 object-contain" />
                <span className="display-font text-lg tracking-wider neon-green-subtle">
                  BUY SIDE BRO
                </span>
              </div>
            </Link>
            <a href="/api/login">
              <button className="border border-green-500 text-green-500 hover:bg-green-500/10 px-5 py-2 rounded text-sm uppercase tracking-wider font-medium transition-all" data-testid="button-preview-signin">
                Start Free Trial
              </button>
            </a>
          </div>
        </div>
      </nav>

      <section className="pt-28 pb-12 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="display-font text-3xl md:text-5xl font-bold text-white mb-4 uppercase tracking-wider leading-tight">
            Inside the Terminal
          </h1>
          <p className="text-zinc-400 text-lg md:text-xl max-w-2xl mx-auto mb-2">
            Professional-grade market intelligence. No Bloomberg terminal required.
          </p>
          <p className="text-green-400 text-sm md:text-base display-font">
            14 days free. No commitment. No credit card.
          </p>
        </div>
      </section>

      <section className="px-4 pb-16" data-testid="section-preview-features">
        <div className="max-w-5xl mx-auto space-y-20">
          {features.map((feature, i) => (
            <div
              key={i}
              className={`flex flex-col ${i % 2 === 1 ? "lg:flex-row-reverse" : "lg:flex-row"} items-center gap-8 lg:gap-12`}
              data-testid={`card-preview-feature-${i}`}
            >
              <div className="lg:w-3/5 w-full">
                <div className="relative rounded-lg overflow-hidden border border-green-900/40 shadow-[0_0_30px_rgba(0,255,0,0.08)]">
                  <img
                    src={feature.image}
                    alt={feature.title}
                    className="w-full h-auto object-cover"
                    data-testid={`img-preview-${i}`}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
                </div>
              </div>

              <div className="lg:w-2/5 w-full text-center lg:text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-green-900/20 border border-green-900/40 mb-4">
                  <feature.icon className="w-4 h-4 text-green-500" />
                  <span className="display-font text-xs neon-green-subtle tracking-widest">{feature.title}</span>
                </div>
                <h3 className="text-xl md:text-2xl font-semibold text-white mb-3">{feature.subtitle}</h3>
                <p className="text-zinc-400 text-sm md:text-base leading-relaxed">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="py-16 px-4 border-t border-green-900/30 bg-green-950/10">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="p-3 rounded-lg bg-green-900/20 border border-green-900/30">
                <Clock className="w-6 h-6 text-green-500" />
              </div>
              <h4 className="display-font text-sm neon-green-subtle tracking-wider">14-DAY FREE TRIAL</h4>
              <p className="text-zinc-400 text-sm">Full access to every feature. No restrictions. Cancel anytime.</p>
            </div>
            <div className="flex flex-col items-center gap-3">
              <div className="p-3 rounded-lg bg-green-900/20 border border-green-900/30">
                <Shield className="w-6 h-6 text-green-500" />
              </div>
              <h4 className="display-font text-sm neon-green-subtle tracking-wider">NO CREDIT CARD</h4>
              <p className="text-zinc-400 text-sm">Start exploring immediately. No payment details needed upfront.</p>
            </div>
            <div className="flex flex-col items-center gap-3">
              <div className="p-3 rounded-lg bg-green-900/20 border border-green-900/30">
                <Zap className="w-6 h-6 text-green-500" />
              </div>
              <h4 className="display-font text-sm neon-green-subtle tracking-wider">$10/MONTH AFTER</h4>
              <p className="text-zinc-400 text-sm">Includes $5 of AI credits. Buy more as you need them.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-4 border-t border-green-900/30" data-testid="section-preview-cta">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="display-font text-2xl md:text-4xl text-white mb-3 uppercase tracking-wider">
            Ready to see it in action?
          </h2>
          <p className="text-zinc-400 text-lg mb-2">
            Sign in to start your free 14-day trial. No commitment required.
          </p>
          <p className="text-zinc-500 text-sm mb-8">
            After your trial, it's just $10/month. Need more AI power? Grab extra credit packs anytime.
          </p>
          <a href="/api/login">
            <button
              className="bg-green-500 hover:bg-green-400 text-black font-bold px-10 py-4 rounded text-lg uppercase tracking-wider transition-all duration-200 shadow-[0_0_20px_rgba(0,255,0,0.3)] hover:shadow-[0_0_30px_rgba(0,255,0,0.5)] inline-flex items-center gap-3"
              data-testid="button-start-trial"
            >
              Start Free Trial <ArrowRight className="w-5 h-5" />
            </button>
          </a>
          <p className="text-zinc-600 text-xs mt-4">
            Sign in with Google, Apple, GitHub, or email
          </p>
        </div>
      </section>

      <footer className="py-8 px-4 border-t border-green-900/30">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-zinc-600 text-xs leading-relaxed max-w-3xl mx-auto mb-4">
            <strong className="text-zinc-500">Disclaimer:</strong> Buy Side Bro is for informational purposes only and does not constitute financial advice.
            Past performance is not indicative of future results. Always consult a qualified financial advisor before making investment decisions.
          </p>
          <p className="text-zinc-700 text-xs">
            © 2026 Buy Side Bro. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
