import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";

interface BroStatus {
  dailyUsed: number;
  dailyLimit: number;
  isPro: boolean;
  tier: string;
  monthlyUsed?: number;
  monthlyLimit?: number;
}

export function useBroStatus() {
  const { isAuthenticated } = useAuth();

  const { data: broStatus, refetch } = useQuery<BroStatus>({
    queryKey: ["/api/bro/status"],
    enabled: isAuthenticated,
    staleTime: 30_000,
  });

  const [viewAs, setViewAs] = useState(() => localStorage.getItem("admin_view_as"));

  useEffect(() => {
    const onStorage = () => setViewAs(localStorage.getItem("admin_view_as"));
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const isFreeOverride = viewAs === "free";
  const tier = isFreeOverride ? "free" : (broStatus?.tier ?? "free");

  return {
    broStatus,
    canQuery: broStatus ? broStatus.dailyUsed < broStatus.dailyLimit : false,
    isAtLimit: broStatus ? broStatus.dailyUsed >= broStatus.dailyLimit : false,
    isPro: isFreeOverride ? false : (broStatus?.isPro ?? false),
    isStarter: tier === "starter",
    isStarterOrAbove: tier === "starter" || tier === "pro",
    tier,
    refetch,
  };
}
