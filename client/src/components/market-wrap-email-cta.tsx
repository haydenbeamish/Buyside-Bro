import { useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useLoginGate } from "@/hooks/use-login-gate";
import { useBroStatus } from "@/hooks/use-bro-status";
import { LoginGateModal } from "@/components/login-gate-modal";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Mail, Loader2, Crown } from "lucide-react";

interface EmailPrefs {
  emailUsaMarketSummary: boolean;
  emailAsxMarketSummary: boolean;
  emailEuropeMarketSummary: boolean;
}

const markets = [
  { key: "emailUsaMarketSummary" as keyof EmailPrefs, label: "US Markets", desc: "NYSE & NASDAQ close wrap" },
  { key: "emailAsxMarketSummary" as keyof EmailPrefs, label: "ASX (Australia)", desc: "ASX close wrap" },
  { key: "emailEuropeMarketSummary" as keyof EmailPrefs, label: "European Markets", desc: "European close wrap" },
];

export function MarketWrapEmailCTA() {
  const { isAuthenticated } = useAuth();
  const { gate, showLoginModal, closeLoginModal } = useLoginGate();
  const { isStarterOrAbove } = useBroStatus();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: prefs, isLoading: prefsLoading } = useQuery<EmailPrefs & Record<string, any>>({
    queryKey: ["/api/push/preferences"],
    enabled: isAuthenticated && isStarterOrAbove,
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

  return (
    <>
      <LoginGateModal open={showLoginModal} onClose={closeLoginModal} />
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 sm:p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-amber-900/30 border border-amber-500/30 flex items-center justify-center">
            <Mail className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Market Wrap Emails</h3>
            <p className="text-zinc-500 text-xs">Get the daily market wrap in your inbox</p>
          </div>
        </div>

        {!isAuthenticated ? (
          <div>
            <p className="text-zinc-400 text-sm mb-4">
              Receive a closing bell summary after every US, ASX, and European market close — delivered straight to your inbox.
            </p>
            <Button
              className="neon-button"
              onClick={() => gate()}
            >
              Sign in to subscribe
            </Button>
          </div>
        ) : !isStarterOrAbove ? (
          <div>
            <p className="text-zinc-400 text-sm mb-4">
              Receive a closing bell summary after every US, ASX, and European market close — delivered straight to your inbox.
            </p>
            <Button
              className="neon-button"
              onClick={() => setLocation("/subscription")}
            >
              <Crown className="w-4 h-4 mr-2" />
              Upgrade to unlock
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {prefsLoading ? (
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
                    <div className="text-sm text-zinc-200 font-medium">{market.label}</div>
                    <div className="text-xs text-zinc-500">{market.desc}</div>
                  </div>
                  <Switch
                    checked={!!(prefs as any)?.[market.key]}
                    onCheckedChange={(checked) => handleToggle(market.key, checked)}
                    disabled={updateMutation.isPending}
                  />
                </div>
              ))
            )}
            <p className="text-zinc-600 text-xs pt-2 border-t border-zinc-800">
              Emails are sent once per trading day after each market closes.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
