import { useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, CreditCard, Crown, Zap, TrendingUp, Bot, BarChart3, Coins, AlertCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import logoImg from "@assets/image_1770296632105.png";

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

export default function SubscriptionPage() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const searchParams = new URLSearchParams(window.location.search);
  const success = searchParams.get("success");
  const canceled = searchParams.get("canceled");
  const credits = searchParams.get("credits");

  useEffect(() => {
    if (success === "true") {
      toast({
        title: "Welcome to Buy Side Bro Pro!",
        description: "Your subscription is now active. Enjoy full access to all features.",
      });
      window.history.replaceState({}, "", "/dashboard/subscription");
    } else if (canceled === "true") {
      toast({
        title: "Checkout canceled",
        description: "Your subscription checkout was canceled. You can try again anytime.",
        variant: "destructive",
      });
      window.history.replaceState({}, "", "/dashboard/subscription");
    } else if (credits === "success") {
      toast({
        title: "Credits Added!",
        description: "Your AI credits have been added to your account.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/credits"] });
      window.history.replaceState({}, "", "/dashboard/subscription");
    } else if (credits === "cancelled") {
      toast({
        title: "Purchase canceled",
        description: "Your credit purchase was canceled.",
        variant: "destructive",
      });
      window.history.replaceState({}, "", "/dashboard/subscription");
    }
  }, [success, canceled, credits, toast]);

  const { data: subscriptionStatus, isLoading: statusLoading } = useQuery<SubscriptionStatus>({
    queryKey: ["/api/subscription/status"],
    enabled: isAuthenticated,
  });

  const { data: productsData, isLoading: productsLoading } = useQuery<{ products: Product[] }>({
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
    mutationFn: async (priceId: string) => {
      const response = await apiRequest("POST", "/api/subscription/checkout", { priceId });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error) => {
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
    onError: (error) => {
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
        <Loader2 className="w-8 h-8 animate-spin text-green-500" />
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
  const isTrialing = subscriptionStatus?.isTrialing;
  const product = productsData?.products?.[0];
  const price = product?.prices?.[0];

  const features = [
    { icon: TrendingUp, text: "Real-time market data & analysis" },
    { icon: BarChart3, text: "Interactive charts & visualizations" },
    { icon: Bot, text: "AI-powered stock analysis with Kimi K2.5" },
    { icon: Zap, text: "Deep dive earnings analysis" },
    { icon: CreditCard, text: "Portfolio tracking & performance" },
    { icon: Crown, text: "Priority support" },
  ];

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <img src={logoImg} alt="Buy Side Bro" className="w-16 h-16 mx-auto mb-6" />
          <h1 className="display-font text-3xl md:text-4xl neon-green mb-4">
            {isActive ? "Your Subscription" : "Go Pro with Buy Side Bro"}
          </h1>
          <p className="text-zinc-400 text-lg max-w-xl mx-auto">
            {isActive
              ? "Manage your subscription and billing details."
              : "Don't pay $30k USD for a terminal. You've got a buy side bro instead."}
          </p>
        </div>

        {isActive && (
          <>
          <Card className="mb-8 bg-zinc-900/50 border-green-900/30">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Crown className="w-5 h-5 text-green-500" />
                    Buy Side Bro Pro
                  </CardTitle>
                  <CardDescription className="text-zinc-400">
                    Your subscription is active
                  </CardDescription>
                </div>
                <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
                  {isTrialing ? "Trial" : "Active"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {isTrialing && subscriptionStatus?.trialEndsAt && (
                <p className="text-zinc-400 mb-4">
                  Your trial ends on{" "}
                  <span className="text-white">
                    {new Date(subscriptionStatus.trialEndsAt).toLocaleDateString()}
                  </span>
                </p>
              )}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {features.map((feature, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-zinc-300">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span>{feature.text}</span>
                  </div>
                ))}
              </div>
            </CardContent>
            <CardFooter>
              <Button
                variant="outline"
                className="border-green-500/50 text-green-500 hover:bg-green-500/10"
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

          {/* AI Credits Section */}
          <Card className="mb-8 bg-zinc-900/50 border-zinc-800">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Coins className="w-5 h-5 text-yellow-500" />
                    AI Credits
                  </CardTitle>
                  <CardDescription className="text-zinc-400">
                    Credits for AI-powered stock analysis and chat
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
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-zinc-800/50 rounded-lg p-4">
                  <div className="text-zinc-400 text-sm mb-1">Monthly Included</div>
                  <div className="text-white text-xl font-bold ticker-font">
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
                <div className="bg-zinc-800/50 rounded-lg p-4">
                  <div className="text-zinc-400 text-sm mb-1">Purchased Credits</div>
                  <div className="text-green-500 text-xl font-bold ticker-font">
                    ${((creditsData?.purchasedCreditsCents || 0) / 100).toFixed(2)}
                  </div>
                  <div className="text-zinc-500 text-xs mt-2">
                    Available for use
                  </div>
                </div>
              </div>
              
              <div className="bg-zinc-800/30 rounded-lg p-4 border border-zinc-700/50">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-zinc-400 text-sm">Total Available</span>
                  <span className={`text-lg font-bold ticker-font ${(creditsData?.availableCreditsCents || 0) > 0 ? 'text-green-500' : 'text-red-500'}`}>
                    ${((creditsData?.availableCreditsCents || 500) / 100).toFixed(2)}
                  </span>
                </div>
                <p className="text-zinc-500 text-xs">
                  Your subscription includes $5/month of AI credits. When exhausted, credits are deducted from purchased balance.
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
                        className="border-zinc-700 hover:border-green-500/50 hover:bg-green-500/10 flex flex-col py-3 h-auto"
                        onClick={() => creditPurchaseMutation.mutate(pack.priceId)}
                        disabled={creditPurchaseMutation.isPending}
                        data-testid={`button-buy-credits-${pack.amount / 100}`}
                      >
                        <span className="text-green-500 font-bold">${pack.amount / 100}</span>
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
          <div className="grid md:grid-cols-2 gap-8">
            <Card className="bg-zinc-900/50 border-green-900/30">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Crown className="w-5 h-5 text-green-500" />
                  Buy Side Bro Pro
                </CardTitle>
                <CardDescription className="text-zinc-400">
                  Full access to all features
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="text-center py-4">
                  <div className="display-font text-4xl neon-green">
                    ${price ? (price.unit_amount / 100).toFixed(0) : "10"}
                  </div>
                  <div className="text-zinc-400 text-sm mt-1">per month</div>
                  <Badge className="mt-3 bg-green-500/20 text-green-500 border-green-500/30">
                    2 weeks free trial
                  </Badge>
                </div>

                <div className="space-y-3">
                  {features.map((feature, i) => (
                    <div key={i} className="flex items-center gap-3 text-zinc-300">
                      <feature.icon className="w-5 h-5 text-green-500 flex-shrink-0" />
                      <span>{feature.text}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full neon-button"
                  onClick={() => price && checkoutMutation.mutate(price.id)}
                  disabled={checkoutMutation.isPending || !price || productsLoading}
                  data-testid="button-subscribe"
                >
                  {checkoutMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Zap className="w-4 h-4 mr-2" />
                  )}
                  Start Free Trial
                </Button>
              </CardFooter>
            </Card>

            <div className="space-y-6">
              <div className="bg-zinc-900/30 rounded-lg p-6 border border-zinc-800">
                <h3 className="display-font text-xl text-white mb-4">Why Choose Buy Side Bro?</h3>
                <ul className="space-y-3 text-zinc-400">
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Professional-grade market data at a fraction of the cost</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>AI-powered insights using advanced language models</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Cancel anytime - no long-term commitment</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>14-day free trial - try before you pay</span>
                  </li>
                </ul>
              </div>

              <div className="bg-zinc-900/30 rounded-lg p-6 border border-zinc-800">
                <h3 className="display-font text-lg text-white mb-2">Secure Payments</h3>
                <p className="text-zinc-400 text-sm">
                  All payments are securely processed by Stripe. Your payment information is never
                  stored on our servers.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
