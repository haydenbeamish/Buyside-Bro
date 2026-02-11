import { useEffect, useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, CreditCard, Crown, Zap, TrendingUp, Bot, BarChart3, Shield, Globe, LineChart, Newspaper, BriefcaseBusiness, X, Mail, Bell, Brain } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import logoImg from "@assets/image_1770442846290.png";
import { useDocumentTitle } from "@/hooks/use-document-title";

interface SubscriptionStatus {
  status: string;
  isActive: boolean;
  tier: string;
  isTrialing: boolean;
  trialEndsAt: string | null;
  subscriptionEndsAt: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}

interface Price {
  id: string;
  unit_amount: number;
  currency: string;
  recurring: { interval: string } | null;
}

interface Product {
  id: string;
  name: string;
  description: string;
  metadata: Record<string, string>;
  prices: Price[];
}

interface EmailPrefs {
  emailUsaMarketSummary: boolean;
  emailAsxMarketSummary: boolean;
  emailEuropeMarketSummary: boolean;
  emailAsiaMarketSummary: boolean;
}

function EmailPreferencesSection() {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();

  const { data: prefs, isLoading } = useQuery<EmailPrefs & Record<string, any>>({
    queryKey: ["/api/push/preferences"],
    enabled: isAuthenticated,
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<EmailPrefs>) => {
      const response = await apiRequest("PUT", "/api/push/preferences", updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/push/preferences"] });
    },
    onError: (error: any) => {
      if (error?.status === 403) {
        toast({
          title: "Subscription required",
          description: "Upgrade to Starter or Pro to enable market wrap emails.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to update email preferences.",
          variant: "destructive",
        });
      }
    },
  });

  const handleToggle = useCallback((field: keyof EmailPrefs, value: boolean) => {
    updateMutation.mutate({ [field]: value });
  }, [updateMutation]);

  if (!isAuthenticated) return null;

  const markets = [
    { key: "emailUsaMarketSummary" as keyof EmailPrefs, label: "US Markets", desc: "NYSE & NASDAQ close wrap" },
    { key: "emailAsxMarketSummary" as keyof EmailPrefs, label: "ASX (Australia)", desc: "ASX close wrap" },
    { key: "emailEuropeMarketSummary" as keyof EmailPrefs, label: "European Markets", desc: "European close wrap" },
    { key: "emailAsiaMarketSummary" as keyof EmailPrefs, label: "Asian Markets", desc: "Asia close wrap" },
  ];

  return (
    <Card className="mb-8 bg-zinc-900/50 border-zinc-800">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Mail className="w-5 h-5 text-amber-500" />
          Market Wrap Emails
        </CardTitle>
        <CardDescription className="text-zinc-400">
          Get daily market close summaries delivered to your inbox
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
          </div>
        ) : (
          markets.map((market) => (
            <div
              key={market.key}
              className="flex items-center justify-between gap-4 py-2"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm text-zinc-200 font-medium" data-testid={`text-email-pref-${market.key}`}>
                  {market.label}
                </div>
                <div className="text-xs text-zinc-500">{market.desc}</div>
              </div>
              <Switch
                checked={!!(prefs as any)?.[market.key]}
                onCheckedChange={(checked) => handleToggle(market.key, checked)}
                disabled={updateMutation.isPending}
                data-testid={`switch-email-${market.key}`}
              />
            </div>
          ))
        )}
        <p className="text-zinc-600 text-xs pt-2 border-t border-zinc-800">
          Emails are sent once per trading day after each market closes. You can unsubscribe anytime.
        </p>
      </CardContent>
    </Card>
  );
}

export default function SubscriptionPage() {
  useDocumentTitle("Subscription");
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const searchParams = new URLSearchParams(window.location.search);
  const success = searchParams.get("success");
  const canceled = searchParams.get("canceled");

  useEffect(() => {
    if (success === "true") {
      queryClient.invalidateQueries({ queryKey: ["/api/subscription/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bro/status"] });
      toast({
        title: "Welcome to Buy Side Bro!",
        description: "Your subscription is now active. Enjoy full access to all features.",
      });
      window.history.replaceState({}, "", "/subscription");
    } else if (canceled === "true") {
      toast({
        title: "Checkout canceled",
        description: "Your subscription checkout was canceled. You can try again anytime.",
        variant: "destructive",
      });
      window.history.replaceState({}, "", "/subscription");
    }
  }, [success, canceled, toast]);

  const { data: subscriptionStatus, isLoading: statusLoading } = useQuery<SubscriptionStatus>({
    queryKey: ["/api/subscription/status"],
    enabled: isAuthenticated,
  });

  const { data: productsData } = useQuery<{ products: Product[] }>({
    queryKey: ["/api/subscription/products"],
  });

  const checkoutMutation = useMutation({
    mutationFn: async (priceId?: string) => {
      const response = await apiRequest("POST", "/api/subscription/checkout", { priceId });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to start checkout. Please try again.",
        variant: "destructive",
      });
    },
  });

  const portalMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/subscription/portal");
      return response.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to open billing portal. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (authLoading || statusLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
        <div className="text-center max-w-md">
          <img src={logoImg} alt="Buy Side Bro" className="w-16 h-16 mx-auto mb-6" />
          <h1 className="display-font text-2xl neon-green mb-4">Sign In Required</h1>
          <p className="text-zinc-400 mb-6">Please sign in to manage your subscription.</p>
          <a href="/api/login">
            <Button className="neon-button w-full" data-testid="button-login-subscription">
              Sign In
            </Button>
          </a>
        </div>
      </div>
    );
  }

  const isActive = subscriptionStatus?.isActive;
  const currentTier = subscriptionStatus?.tier || "free";

  // Find starter and pro products/prices from Stripe
  const products = productsData?.products || [];
  const starterProduct = products.find(p => p.metadata?.tier === 'starter') || products.find(p => p.prices?.some(pr => pr.unit_amount === 1000));
  const proProduct = products.find(p => p.metadata?.tier === 'pro') || products.find(p => p.prices?.some(pr => pr.unit_amount === 10000));

  const starterPrice = starterProduct?.prices?.[0];
  const proPrice = proProduct?.prices?.[0];

  const starterDisplayPrice = starterPrice ? (starterPrice.unit_amount / 100).toFixed(0) : "10";
  const proDisplayPrice = proPrice ? (proPrice.unit_amount / 100).toFixed(0) : "100";

  const starterFeatures = [
    { icon: Globe, text: "Live global market data", desc: "100+ tickers: futures, commodities, forex, sectors, thematics" },
    { icon: Bot, text: "5 Bro queries per day", desc: "Chat with live data awareness and conversation memory" },
    { icon: Brain, text: "Deep Dive reports", desc: "Hedge fund quality research with BUY/HOLD/SELL and target prices" },
    { icon: LineChart, text: "Stock analysis", desc: "Quick snapshots with P&L tables, charts, and fundamentals" },
    { icon: BarChart3, text: "Earnings insights", desc: "Expert previews and reviews with consensus estimates" },
    { icon: BriefcaseBusiness, text: "Portfolio tracking", desc: "Holdings, exposure breakdown, and expert review" },
    { icon: Mail, text: "Market wrap emails", desc: "Daily close summaries for US, ASX, European, Asian markets" },
    { icon: Bell, text: "Push notifications", desc: "Price alerts and market summary notifications" },
  ];

  const proFeatures = [
    { icon: Globe, text: "Everything in Starter", desc: "All Starter features included" },
    { icon: Bot, text: "50 Bro queries per month", desc: "More queries with monthly rollover" },
    { icon: Shield, text: "Portfolio hedging strategies", desc: "Futures hedging, options pricing, VaR metrics" },
    { icon: TrendingUp, text: "Trade tracker & journal", desc: "Log trades, win rate, Sharpe ratio, analytics" },
    { icon: Newspaper, text: "NAV & performance reporting", desc: "Monthly returns, benchmark comparison, Bloomberg export" },
  ];

  const comparisonRows = [
    { feature: "Live market dashboard", free: true, starter: true, pro: true },
    { feature: "Global markets (100+ tickers)", free: true, starter: true, pro: true },
    { feature: "Ask Bro queries", free: "1/day", starter: "5/day", pro: "50/mo" },
    { feature: "Deep Dive reports", free: false, starter: true, pro: true },
    { feature: "Stock analysis & snapshots", free: false, starter: true, pro: true },
    { feature: "Earnings insights", free: false, starter: true, pro: true },
    { feature: "Portfolio tracking & analytics", free: false, starter: true, pro: true },
    { feature: "Daily market wrap emails", free: false, starter: true, pro: true },
    { feature: "Push notifications", free: false, starter: true, pro: true },
    { feature: "Custom watchlists", free: false, starter: true, pro: true },
    { feature: "Hedging strategies", free: false, starter: false, pro: true },
    { feature: "Trade tracker & journal", free: false, starter: "Demo", pro: true },
    { feature: "NAV & performance reporting", free: false, starter: false, pro: true },
  ];

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-5xl mx-auto px-3 sm:px-4 py-6 sm:py-12">
        <div className="text-center mb-8 sm:mb-12">
          <img src={logoImg} alt="Buy Side Bro" className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 sm:mb-6" />
          <h1 className="display-font text-2xl sm:text-3xl md:text-4xl neon-green mb-3">
            {isActive ? "Your Subscription" : "Choose Your Plan"}
          </h1>
          <p className="text-zinc-400 text-sm sm:text-lg max-w-2xl mx-auto">
            {isActive
              ? "Manage your subscription and billing details."
              : "Why pay $30,000/yr for a Bloomberg Terminal? Get hedge fund grade market intelligence starting at $10/month."}
          </p>
        </div>

        {isActive && (
          <>
          <Card className="mb-8 bg-zinc-900/50 border-zinc-800">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Crown className="w-5 h-5 text-amber-500" />
                    Buy Side Bro {currentTier === 'pro' ? 'Pro' : 'Starter'}
                  </CardTitle>
                  <CardDescription className="text-zinc-400">
                    Your subscription is active
                  </CardDescription>
                </div>
                <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30">
                  {currentTier === 'pro' ? 'Pro' : 'Starter'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(currentTier === 'pro' ? [...starterFeatures, ...proFeatures.slice(1)] : starterFeatures).map((feature, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-zinc-300">
                    <Check className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    <span>{feature.text}</span>
                  </div>
                ))}
              </div>
            </CardContent>
            <CardFooter className="flex gap-3">
              <Button
                variant="outline"
                className="border-amber-500/50 text-amber-500 hover:bg-amber-500/10"
                onClick={() => portalMutation.mutate()}
                disabled={portalMutation.isPending}
                data-testid="button-manage-billing"
              >
                {portalMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CreditCard className="w-4 h-4 mr-2" />
                )}
                Manage Billing
              </Button>
              {currentTier === 'starter' && proPrice && (
                <Button
                  className="neon-button"
                  onClick={() => checkoutMutation.mutate(proPrice.id)}
                  disabled={checkoutMutation.isPending}
                >
                  {checkoutMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Zap className="w-4 h-4 mr-2" />
                  )}
                  Upgrade to Pro
                </Button>
              )}
            </CardFooter>
          </Card>

          <EmailPreferencesSection />
          </>
        )}

        {!isActive && (
          <>
            {/* Two pricing cards side by side */}
            <div className="grid sm:grid-cols-2 gap-6 mb-8">
              {/* Starter Card */}
              <Card className="bg-gradient-to-b from-zinc-900/80 to-zinc-900/40 border-zinc-700 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-zinc-600" />
                <CardHeader className="text-center pb-2">
                  <CardTitle className="text-white text-xl">
                    Starter
                  </CardTitle>
                  <CardDescription className="text-zinc-400">
                    Essential tools to trade smarter
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="text-center py-4">
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-zinc-500 text-lg">$</span>
                      <span className="display-font text-5xl neon-green">{starterDisplayPrice}</span>
                      <span className="text-zinc-500 text-lg">/mo</span>
                    </div>
                    <p className="text-zinc-500 text-xs mt-2">5 Bro queries per day</p>
                  </div>

                  <div className="grid gap-3">
                    {starterFeatures.map((feature, i) => (
                      <div key={i} className="flex items-start gap-3 text-zinc-300">
                        <feature.icon className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <span className="font-medium text-sm">{feature.text}</span>
                          <p className="text-zinc-500 text-xs">{feature.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
                <CardFooter className="flex-col gap-3 pt-2">
                  <Button
                    className="w-full border border-amber-500 text-amber-500 hover:bg-amber-500/10 bg-transparent py-5"
                    onClick={() => checkoutMutation.mutate(starterPrice?.id)}
                    disabled={checkoutMutation.isPending}
                    data-testid="button-subscribe-starter"
                  >
                    {checkoutMutation.isPending ? (
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    ) : null}
                    Get Starter
                  </Button>
                </CardFooter>
              </Card>

              {/* Pro Card */}
              <Card className="bg-gradient-to-b from-zinc-900/80 to-zinc-900/40 border-amber-500/30 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-green-500 to-amber-500" />
                <CardHeader className="text-center pb-2">
                  <Badge className="mx-auto mb-2 bg-amber-500/20 text-amber-500 border-amber-500/30 text-xs">
                    MOST POPULAR
                  </Badge>
                  <CardTitle className="text-white flex items-center justify-center gap-2 text-xl">
                    <Crown className="w-5 h-5 text-amber-500" />
                    Pro
                  </CardTitle>
                  <CardDescription className="text-zinc-400">
                    Full suite for serious traders
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="text-center py-4">
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-zinc-500 text-lg">$</span>
                      <span className="display-font text-5xl neon-green">{proDisplayPrice}</span>
                      <span className="text-zinc-500 text-lg">/mo</span>
                    </div>
                    <p className="text-zinc-500 text-xs mt-2">50 Bro queries per month</p>
                  </div>

                  <div className="grid gap-3">
                    {proFeatures.map((feature, i) => (
                      <div key={i} className="flex items-start gap-3 text-zinc-300">
                        <feature.icon className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <span className="font-medium text-sm">{feature.text}</span>
                          <p className="text-zinc-500 text-xs">{feature.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
                <CardFooter className="flex-col gap-3 pt-2">
                  <Button
                    className="w-full neon-button text-base py-5"
                    onClick={() => checkoutMutation.mutate(proPrice?.id)}
                    disabled={checkoutMutation.isPending}
                    data-testid="button-subscribe-pro"
                  >
                    {checkoutMutation.isPending ? (
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    ) : (
                      <Zap className="w-5 h-5 mr-2" />
                    )}
                    Go Pro Now
                  </Button>
                  <div className="flex items-center gap-2 text-zinc-500 text-xs">
                    <Shield className="w-3.5 h-3.5" />
                    <span>Secured by Stripe. Cancel anytime.</span>
                  </div>
                </CardFooter>
              </Card>
            </div>

            {/* Free vs Starter vs Pro comparison */}
            <Card className="mb-8 bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white text-lg sm:text-xl">Compare Plans</CardTitle>
                <CardDescription className="text-zinc-400">See what each plan includes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-800">
                        <th className="text-left py-3 text-zinc-400 font-medium">Feature</th>
                        <th className="text-center py-3 text-zinc-400 font-medium w-16 sm:w-24">Free</th>
                        <th className="text-center py-3 text-zinc-300 font-medium w-16 sm:w-24">Starter</th>
                        <th className="text-center py-3 text-amber-500 font-medium w-16 sm:w-24">Pro</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparisonRows.map((row, i) => (
                        <tr key={i} className="border-b border-zinc-800/50">
                          <td className="py-3 text-zinc-300">{row.feature}</td>
                          <td className="py-3 text-center">
                            {row.free === true ? (
                              <Check className="w-4 h-4 text-green-500 mx-auto" />
                            ) : row.free === false ? (
                              <X className="w-4 h-4 text-zinc-600 mx-auto" />
                            ) : (
                              <span className="text-zinc-400 text-xs">{row.free}</span>
                            )}
                          </td>
                          <td className="py-3 text-center">
                            {row.starter === true ? (
                              <Check className="w-4 h-4 text-green-500 mx-auto" />
                            ) : row.starter === false ? (
                              <X className="w-4 h-4 text-zinc-600 mx-auto" />
                            ) : (
                              <span className="text-zinc-400 text-xs">{row.starter}</span>
                            )}
                          </td>
                          <td className="py-3 text-center">
                            {row.pro === true ? (
                              <Check className="w-4 h-4 text-amber-500 mx-auto" />
                            ) : (
                              <span className="text-amber-500 text-xs font-medium">{row.pro}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Value proposition */}
            <div className="grid sm:grid-cols-3 gap-4 mb-8">
              <div className="bg-zinc-900/30 rounded-lg p-5 border border-zinc-800 text-center">
                <div className="text-3xl sm:text-4xl font-bold neon-green display-font mb-1">$30k</div>
                <div className="text-zinc-500 text-sm">Bloomberg Terminal/yr</div>
                <div className="mt-3 h-px bg-zinc-800" />
                <div className="text-3xl sm:text-4xl font-bold text-amber-500 display-font mt-3 mb-1">${starterDisplayPrice}</div>
                <div className="text-zinc-500 text-sm">Buy Side Bro Starter/mo</div>
              </div>
              <div className="bg-zinc-900/30 rounded-lg p-5 border border-zinc-800 text-center">
                <div className="text-3xl sm:text-4xl font-bold text-amber-500 display-font mb-1">2</div>
                <div className="text-zinc-500 text-sm">Plans to choose from</div>
                <div className="mt-3 h-px bg-zinc-800" />
                <p className="text-zinc-400 text-xs mt-3">Starter at ${starterDisplayPrice}/mo for daily queries. Pro at ${proDisplayPrice}/mo for full trade tools and hedging.</p>
              </div>
              <div className="bg-zinc-900/30 rounded-lg p-5 border border-zinc-800 text-center">
                <div className="text-3xl sm:text-4xl font-bold text-amber-500 display-font mb-1">100+</div>
                <div className="text-zinc-500 text-sm">Live tickers tracked</div>
                <div className="mt-3 h-px bg-zinc-800" />
                <p className="text-zinc-400 text-xs mt-3">6+ analytical models including Claude, Gemini, DeepSeek, and more powering your research</p>
              </div>
            </div>

            {/* FAQ / Trust */}
            <div className="space-y-4">
              <div className="bg-zinc-900/30 rounded-lg p-5 border border-zinc-800">
                <h3 className="display-font text-lg text-white mb-3">Why Buy Side Bro is worth it</h3>
                <ul className="space-y-3 text-zinc-400 text-sm">
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                    <span><strong className="text-zinc-200">Save thousands.</strong> Professional-grade market data and hedge fund quality analysis that rivals tools costing 100x more.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                    <span><strong className="text-zinc-200">Your bro that actually delivers.</strong> Deep Dive reports powered by multiple analytical models, expert portfolio reviews, and Bro chat that pulls live market data into every answer.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                    <span><strong className="text-zinc-200">No commitment.</strong> Cancel anytime with one click. No annual contracts, no hidden fees, no questions asked.</span>
                  </li>
                </ul>
              </div>
            </div>

          </>
        )}
      </div>
    </div>
  );
}
