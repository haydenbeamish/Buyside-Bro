import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";

interface BroStatus {
  dailyUsed: number;
  dailyLimit: number;
  isPro: boolean;
  credits: number;
}

export function useBroStatus() {
  const { isAuthenticated } = useAuth();

  const { data: broStatus, refetch } = useQuery<BroStatus>({
    queryKey: ["/api/bro/status"],
    enabled: isAuthenticated,
    staleTime: 30_000,
  });

  return {
    broStatus,
    canQuery: broStatus ? broStatus.dailyUsed < broStatus.dailyLimit : false,
    isAtLimit: broStatus ? broStatus.dailyUsed >= broStatus.dailyLimit : false,
    isPro: broStatus?.isPro ?? false,
    refetch,
  };
}
