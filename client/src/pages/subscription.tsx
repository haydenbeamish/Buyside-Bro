import { useEffect, useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, CreditCard, Crown, Zap, TrendingUp, Bot, BarChart3, Coins, AlertCircle, Shield, Globe, LineChart, Newspaper, BriefcaseBusiness, X, Mail } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import logoImg from "@assets/image_1770442846290.png";
import { useDocumentTitle } from "@/hooks/use-document-title";

interface SubscriptionStatus {
  status: string;
  isActive: boolean;
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
  prices: Price[];
}

interface CreditsStatus {
  monthlyUsedCents: number;
  monthlyLimitCents: number;
  purchasedCreditsCents: number;
  availableCreditsCents: number;
  isOverLimit: boolean;
}

interface CreditPack {
  id: string;
  name: string;
  description: string;
  priceId: string;
  amount: number;
  currency: string;
  credits: number;
}

interface EmailPrefs {
  emailUsaMarketSummary: boolean;
  emailAsxMarketSummary: boolean;
  emailEuropeMarketSummary: boolean;
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
          title: "Pro subscription required",
          description: "Upgrade to Pro to enable market wrap emails.",
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
  const credits = searchParams.get("credits");

  useEffect(() => {
    if (success === "true") {
      queryClient.invalidateQueries({ queryKey: ["/api/subscription/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bro/status"] });
      toast({
        title: "Welcome to Buy Side Bro Pro!",
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
    } else if (credits === "success") {
      toast({
        title: "Credits Added!",
        description: "Your Bro Credits have been added to your account.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/credits"] });
      window.history.replaceState({}, "", "/subscription");
    } else if (credits === "cancelled") {
      toast({
        title: "Purchase canceled",
        description: "Your credit purchase was canceled.",
        variant: "destructive",
      });
      window.history.replaceState({}, "", "/subscription");
    }
  }, [success, canceled, credits, toast]);

  const { data: subscriptionStatus, isLoading: statusLoading } = useQuery<SubscriptionStatus>({
    queryKey: ["/api/subscription/status"],
    enabled: isAuthenticated,
  });

  const { data: productsData } = useQuery<{ products: Product[] }>({
    queryKey: ["/api/subscription/products"],
  });

  const { data: creditsData } = useQuery<CreditsStatus>({
    queryKey: ["/api/credits"],
    enabled: isAuthenticated,
  });

  const { data: creditPacksData } = useQuery<{ packs: CreditPack[] }>({
    queryKey: ["/api/credits/packs"],
  });

  const creditPurchaseMutation = useMutation({
    mutationFn: async (priceId: string) => {
      const response = await apiRequest("POST", "/api/credits/purchase", { priceId });
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
        description: "Failed to start credit purchase. Please try again.",
        variant: "destructive",
      });
    },
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
  const product = productsData?.products?.[0];
  const price = product?.prices?.[0];

  // Use Stripe price if available, otherwise display the hardcoded $10
  const displayPrice = price ? (price.unit_amount / 100).toFixed(0) : "10";

  const proFeatures = [
    { icon: Globe, text: "Live global market data across 8 categories", desc: "Futures, commodities, forex, US sectors, ASX sectors, thematics and more" },
    { icon: Bot, text: "5 Bro AI queries per day", desc: "Ask Bro anything about stocks, markets, or your portfolio" },

    { icon: LineChart, text: "Advanced stock analysis", desc: "AI-powered company breakdowns with financial metrics" },
    { icon: BarChart3, text: "Full earnings insights", desc: "AI analysis of quarterly earnings with key takeaways" },
    { icon: BriefcaseBusiness, text: "Unlimited portfolio tracking", desc: "Track your holdings with real-time P&L and performance" },
    { icon: TrendingUp, text: "Custom watchlists", desc: "Build and monitor unlimited watchlists with live prices" },
    { icon: Newspaper, text: "Curated market news feed", desc: "Stay on top of what's moving the markets" },
    { icon: Mail, text: "Daily market wrap emails", desc: "Get the closing bell wrap delivered to your inbox after every US, ASX and European close" },
  ];

  const comparisonRows = [
    { feature: "Live market dashboard", free: true, pro: true },
    { feature: "Global markets data", free: true, pro: true },
    { feature: "Ask Bro AI queries", free: "1/day", pro: "5/day" },

    { feature: "Stock analysis", free: false, pro: true },
    { feature: "Earnings insights", free: false, pro: true },
    { feature: "Portfolio tracking", free: false, pro: true },
    { feature: "Custom watchlists", free: false, pro: true },
    { feature: "Priority support", free: false, pro: true },
    { feature: "Daily market wrap emails", free: false, pro: true },
  ];

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-6 sm:py-12">
        <div className="text-center mb-8 sm:mb-12">
          <img src={logoImg} alt="Buy Side Bro" className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 sm:mb-6" />
          <h1 className="display-font text-2xl sm:text-3xl md:text-4xl neon-green mb-3">
            {isActive ? "Your Subscription" : "Go Pro with Buy Side Bro"}
          </h1>
          <p className="text-zinc-400 text-sm sm:text-lg max-w-2xl mx-auto">
            {isActive
              ? "Manage your subscription and billing details."
              : "Why pay $30,000/yr for a Bloomberg Terminal? Get AI-powered market intelligence for less than a Netflix subscription."}
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
                    Buy Side Bro Pro
                  </CardTitle>
                  <CardDescription className="text-zinc-400">
                    Your subscription is active
                  </CardDescription>
                </div>
                <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30">
                  Active
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {proFeatures.map((feature, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-zinc-300">
                    <Check className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    <span>{feature.text}</span>
                  </div>
                ))}
              </div>
            </CardContent>
            <CardFooter>
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
            </CardFooter>
          </Card>

          <EmailPreferencesSection />

          {/* Bro Credits Section */}
          <Card className="mb-8 bg-zinc-900/50 border-zinc-800">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Coins className="w-5 h-5 text-yellow-500" />
                    Bro Credits
                  </CardTitle>
                  <CardDescription className="text-zinc-400">
                    Credits for Ask Bro chat and stock analysis
                  </CardDescription>
                </div>
                {creditsData?.isOverLimit && (
                  <Badge className="bg-red-500/20 text-red-500 border-red-500/30">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Out of Credits
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className="bg-zinc-800/50 rounded-lg p-3 sm:p-4">
                  <div className="text-zinc-400 text-xs sm:text-sm mb-1">Monthly Included</div>
                  <div className="text-white text-base sm:text-xl font-bold ticker-font">
                    ${((creditsData?.monthlyLimitCents || 500) / 100).toFixed(2)}
                  </div>
                  <Progress
                    value={Math.min(100, ((creditsData?.monthlyUsedCents || 0) / (creditsData?.monthlyLimitCents || 500)) * 100)}
                    className="mt-2 h-2"
                  />
                  <div className="text-zinc-500 text-xs mt-1">
                    ${((creditsData?.monthlyUsedCents || 0) / 100).toFixed(2)} used
                  </div>
                </div>
                <div className="bg-zinc-800/50 rounded-lg p-3 sm:p-4">
                  <div className="text-zinc-400 text-xs sm:text-sm mb-1">Purchased Credits</div>
                  <div className="text-green-500 text-base sm:text-xl font-bold ticker-font">
                    ${((creditsData?.purchasedCreditsCents || 0) / 100).toFixed(2)}
                  </div>
                  <div className="text-zinc-500 text-xs mt-2">
                    Available for use
                  </div>
                </div>
              </div>

              <div className="bg-zinc-800/30 rounded-lg p-3 sm:p-4 border border-zinc-700/50">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-zinc-400 text-sm">Total Available</span>
                  <span className={`text-lg font-bold ticker-font ${(creditsData?.availableCreditsCents || 0) > 0 ? 'text-green-500' : 'text-red-500'}`}>
                    ${((creditsData?.availableCreditsCents || 500) / 100).toFixed(2)}
                  </span>
                </div>
                <p className="text-zinc-500 text-xs">
                  Your subscription includes $5/month of Bro Credits. When exhausted, credits are deducted from purchased balance.
                </p>
              </div>

              {/* Credit Packs */}
              {(creditPacksData?.packs?.length || 0) > 0 && (
                <div>
                  <h4 className="text-zinc-300 font-semibold text-sm mb-3">Buy More Credits</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {creditPacksData?.packs.map((pack) => (
                      <Button
                        key={pack.id}
                        variant="outline"
                        className="border-zinc-700 hover:border-amber-500/50 hover:bg-amber-500/10 flex flex-col py-3 h-auto min-h-[44px]"
                        onClick={() => creditPurchaseMutation.mutate(pack.priceId)}
                        disabled={creditPurchaseMutation.isPending}
                        data-testid={`button-buy-credits-${pack.amount / 100}`}
                      >
                        <span className="text-amber-500 font-bold">${pack.amount / 100}</span>
                        <span className="text-zinc-500 text-xs">${(pack.credits / 100).toFixed(0)} credits</span>
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          </>
        )}

        {!isActive && (
          <>
            {/* Hero pricing card */}
            <Card className="mb-8 bg-gradient-to-b from-zinc-900/80 to-zinc-900/40 border-amber-500/30 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-green-500 to-amber-500" />
              <CardHeader className="text-center pb-2">
                <Badge className="mx-auto mb-3 bg-amber-500/20 text-amber-500 border-amber-500/30 text-xs">
                  MOST POPULAR
                </Badge>
                <CardTitle className="text-white flex items-center justify-center gap-2 text-xl sm:text-2xl">
                  <Crown className="w-6 h-6 text-amber-500" />
                  Buy Side Bro Pro
                </CardTitle>
                <CardDescription className="text-zinc-400">
                  Everything you need to trade smarter
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="text-center py-4">
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-zinc-500 text-lg">$</span>
                    <span className="display-font text-5xl sm:text-6xl neon-green">{displayPrice}</span>
                    <span className="text-zinc-500 text-lg">/mo</span>
                  </div>
                  <p className="text-zinc-500 text-sm mt-2">Cancel anytime. No lock-in contracts.</p>
                  <div className="flex items-center justify-center gap-4 mt-3">
                    <span className="text-amber-500/80 text-xs font-medium">Less than a coffee a week</span>
                  </div>
                </div>

                <div className="grid gap-3 sm:gap-4">
                  {proFeatures.map((feature, i) => (
                    <div key={i} className="flex items-start gap-3 text-zinc-300">
                      <feature.icon className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="font-medium text-sm sm:text-base">{feature.text}</span>
                        <p className="text-zinc-500 text-xs sm:text-sm">{feature.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
              <CardFooter className="flex-col gap-3 pt-2">
                <Button
                  className="w-full neon-button text-base py-6"
                  onClick={() => checkoutMutation.mutate(price?.id)}
                  disabled={checkoutMutation.isPending}
                  data-testid="button-subscribe"
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
                  <span>Secured by Stripe. Your payment info never touches our servers.</span>
                </div>
              </CardFooter>
            </Card>

            {/* Free vs Pro comparison */}
            <Card className="mb-8 bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white text-lg sm:text-xl">Free vs Pro</CardTitle>
                <CardDescription className="text-zinc-400">See what you're missing out on</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-800">
                        <th className="text-left py-3 text-zinc-400 font-medium">Feature</th>
                        <th className="text-center py-3 text-zinc-400 font-medium w-20 sm:w-28">Free</th>
                        <th className="text-center py-3 text-amber-500 font-medium w-20 sm:w-28">Pro</th>
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
                <div className="text-3xl sm:text-4xl font-bold text-amber-500 display-font mt-3 mb-1">${displayPrice}</div>
                <div className="text-zinc-500 text-sm">Buy Side Bro/mo</div>
              </div>
              <div className="bg-zinc-900/30 rounded-lg p-5 border border-zinc-800 text-center">
                <div className="text-3xl sm:text-4xl font-bold text-amber-500 display-font mb-1">$5</div>
                <div className="text-zinc-500 text-sm">AI credits free every month</div>
                <div className="mt-3 h-px bg-zinc-800" />
                <p className="text-zinc-400 text-xs mt-3">Covers dozens of AI stock analyses and Bro queries each month at no extra cost</p>
              </div>
              <div className="bg-zinc-900/30 rounded-lg p-5 border border-zinc-800 text-center">
                <div className="text-3xl sm:text-4xl font-bold text-amber-500 display-font mb-1">8+</div>
                <div className="text-zinc-500 text-sm">Global market categories</div>
                <div className="mt-3 h-px bg-zinc-800" />
                <p className="text-zinc-400 text-xs mt-3">Futures, forex, commodities, US sectors, ASX sectors, thematics, and more</p>
              </div>
            </div>

            {/* FAQ / Trust */}
            <div className="space-y-4">
              <div className="bg-zinc-900/30 rounded-lg p-5 border border-zinc-800">
                <h3 className="display-font text-lg text-white mb-3">Why Buy Side Bro is worth it</h3>
                <ul className="space-y-3 text-zinc-400 text-sm">
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                    <span><strong className="text-zinc-200">Save thousands.</strong> Professional-grade market data and AI analysis that rivals tools costing 100x more.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                    <span><strong className="text-zinc-200">AI that actually helps.</strong> Ask Bro about any stock, get deep earnings analysis, or have it break down complex market moves in plain English.</span>
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
