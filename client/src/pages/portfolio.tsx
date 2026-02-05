import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  TrendingUp,
  TrendingDown,
  Trash2,
  Sparkles,
} from "lucide-react";
import type { PortfolioHolding } from "@shared/schema";
import {
  PieChart as RechartsPie,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

interface PortfolioStats {
  totalValue: number;
  totalGain: number;
  totalGainPercent: number;
  dayChange: number;
  dayChangePercent: number;
}

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

function PercentDisplay({ value }: { value: number }) {
  const color = value >= 0 ? "text-green-500" : "text-red-500";
  return (
    <span className={`font-mono ${color}`}>
      {value >= 0 ? "+" : ""}{value.toFixed(2)}%
    </span>
  );
}

export default function PortfolioPage() {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newHolding, setNewHolding] = useState({
    ticker: "",
    shares: "",
    avgCost: "",
  });
  const { toast } = useToast();

  const { data: holdings, isLoading: holdingsLoading } = useQuery<PortfolioHolding[]>({
    queryKey: ["/api/portfolio"],
  });

  const { data: stats, isLoading: statsLoading } = useQuery<PortfolioStats>({
    queryKey: ["/api/portfolio/stats"],
  });

  const { data: analysis } = useQuery<{ analysis: string }>({
    queryKey: ["/api/portfolio/analysis"],
    enabled: !!holdings && holdings.length > 0,
  });

  const addMutation = useMutation({
    mutationFn: async (data: { ticker: string; shares: string; avgCost: string }) => {
      const res = await apiRequest("POST", "/api/portfolio", {
        ticker: data.ticker.toUpperCase(),
        shares: data.shares,
        avgCost: data.avgCost,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/stats"] });
      setIsAddOpen(false);
      setNewHolding({ ticker: "", shares: "", avgCost: "" });
      toast({
        title: "Position added",
        description: "Your holding has been added to the portfolio.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add position. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/portfolio/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/stats"] });
      toast({
        title: "Position removed",
        description: "The holding has been removed from your portfolio.",
      });
    },
  });

  const handleAddHolding = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHolding.ticker || !newHolding.shares || !newHolding.avgCost) return;
    addMutation.mutate(newHolding);
  };

  const pieData = holdings?.map((h) => ({
    name: h.ticker,
    value: Number(h.shares) * Number(h.currentPrice || h.avgCost),
  })) || [];

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-4xl font-bold tracking-tight" style={{ fontFamily: 'Montserrat, sans-serif' }}>
            PORTFOLIO
          </h1>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-zinc-700 bg-zinc-900 hover:bg-zinc-800" data-testid="button-add-position">
                <Plus className="h-4 w-4 mr-2" />
                Add Position
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
              <DialogHeader>
                <DialogTitle>Add New Position</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddHolding} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ticker" className="text-zinc-300">Ticker Symbol</Label>
                  <Input
                    id="ticker"
                    placeholder="AAPL"
                    value={newHolding.ticker}
                    onChange={(e) => setNewHolding({ ...newHolding, ticker: e.target.value })}
                    className="bg-zinc-800 border-zinc-700 text-white font-mono uppercase"
                    data-testid="input-ticker"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shares" className="text-zinc-300">Number of Shares</Label>
                  <Input
                    id="shares"
                    type="number"
                    step="0.0001"
                    placeholder="100"
                    value={newHolding.shares}
                    onChange={(e) => setNewHolding({ ...newHolding, shares: e.target.value })}
                    className="bg-zinc-800 border-zinc-700 text-white font-mono"
                    data-testid="input-shares"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="avgCost" className="text-zinc-300">Average Cost per Share</Label>
                  <Input
                    id="avgCost"
                    type="number"
                    step="0.01"
                    placeholder="150.00"
                    value={newHolding.avgCost}
                    onChange={(e) => setNewHolding({ ...newHolding, avgCost: e.target.value })}
                    className="bg-zinc-800 border-zinc-700 text-white font-mono"
                    data-testid="input-avg-cost"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-zinc-700 hover:bg-zinc-600"
                  disabled={addMutation.isPending}
                  data-testid="button-submit-position"
                >
                  {addMutation.isPending ? "Adding..." : "Add Position"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <p className="text-zinc-500 text-xs uppercase tracking-wide mb-1">Total Value</p>
            {statsLoading ? (
              <Skeleton className="h-8 w-28 bg-zinc-800" />
            ) : (
              <p className="text-2xl font-bold font-mono text-white">
                ${stats?.totalValue?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || "0.00"}
              </p>
            )}
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <p className="text-zinc-500 text-xs uppercase tracking-wide mb-1">Total Gain</p>
            {statsLoading ? (
              <Skeleton className="h-8 w-28 bg-zinc-800" />
            ) : (
              <div>
                <p className="text-2xl font-bold font-mono text-white">
                  ${Math.abs(stats?.totalGain || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
                <PercentDisplay value={stats?.totalGainPercent || 0} />
              </div>
            )}
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <p className="text-zinc-500 text-xs uppercase tracking-wide mb-1">Day Change</p>
            {statsLoading ? (
              <Skeleton className="h-8 w-28 bg-zinc-800" />
            ) : (
              <div className="flex items-center gap-2">
                {(stats?.dayChange || 0) >= 0 ? (
                  <TrendingUp className="h-5 w-5 text-green-500" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-red-500" />
                )}
                <div>
                  <p className="text-2xl font-bold font-mono text-white">
                    ${Math.abs(stats?.dayChange || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                  <PercentDisplay value={stats?.dayChangePercent || 0} />
                </div>
              </div>
            )}
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <p className="text-zinc-500 text-xs uppercase tracking-wide mb-1">Positions</p>
            {holdingsLoading ? (
              <Skeleton className="h-8 w-12 bg-zinc-800" />
            ) : (
              <p className="text-2xl font-bold font-mono text-white">{holdings?.length || 0}</p>
            )}
          </div>
        </div>

        {analysis && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 mb-8">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10">
                <Sparkles className="h-5 w-5 text-amber-500" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-white mb-2">AI Portfolio Analysis</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  {analysis.analysis}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-lg">
            <div className="p-4 border-b border-zinc-800">
              <h2 className="text-lg font-semibold">Holdings</h2>
            </div>
            <div className="overflow-x-auto">
              {holdingsLoading ? (
                <div className="p-4 space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full bg-zinc-800" />
                  ))}
                </div>
              ) : holdings && holdings.length > 0 ? (
                <table className="w-full text-sm" data-testid="holdings-table">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase">
                      <th className="px-4 py-3 text-left font-medium">Symbol</th>
                      <th className="px-4 py-3 text-right font-medium">Shares</th>
                      <th className="px-4 py-3 text-right font-medium">Avg Cost</th>
                      <th className="px-4 py-3 text-right font-medium">Current</th>
                      <th className="px-4 py-3 text-right font-medium">Gain/Loss</th>
                      <th className="px-4 py-3 w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {holdings.map((holding) => {
                      const currentPrice = Number(holding.currentPrice || holding.avgCost);
                      const avgCost = Number(holding.avgCost);
                      const shares = Number(holding.shares);
                      const gainPercent = ((currentPrice - avgCost) / avgCost) * 100;
                      const gainValue = (currentPrice - avgCost) * shares;

                      return (
                        <tr 
                          key={holding.id} 
                          className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors"
                          data-testid={`holding-row-${holding.ticker}`}
                        >
                          <td className="px-4 py-3">
                            <span className="font-mono font-semibold text-zinc-200">
                              {holding.ticker}
                            </span>
                            {holding.name && (
                              <p className="text-xs text-zinc-500 truncate max-w-[120px]">
                                {holding.name}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-zinc-300">
                            {shares.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-zinc-300">
                            ${avgCost.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-zinc-300">
                            ${currentPrice.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex flex-col items-end">
                              <span className={`font-mono text-sm ${gainValue >= 0 ? "text-green-500" : "text-red-500"}`}>
                                {gainValue >= 0 ? "+" : ""}${Math.abs(gainValue).toFixed(2)}
                              </span>
                              <PercentDisplay value={gainPercent} />
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteMutation.mutate(holding.id)}
                              disabled={deleteMutation.isPending}
                              className="text-zinc-500 hover:text-red-500"
                              data-testid={`button-delete-${holding.ticker}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-12">
                  <p className="text-zinc-500 mb-4">No holdings yet</p>
                  <Button 
                    onClick={() => setIsAddOpen(true)}
                    variant="outline"
                    className="border-zinc-700 bg-zinc-800 hover:bg-zinc-700"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Position
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-lg">
            <div className="p-4 border-b border-zinc-800">
              <h2 className="text-lg font-semibold">Allocation</h2>
            </div>
            <div className="p-4">
              {holdingsLoading ? (
                <Skeleton className="h-48 w-full bg-zinc-800" />
              ) : pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <RechartsPie>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {pieData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
                      labelStyle={{ color: '#fff' }}
                      formatter={(value: number) => [
                        `$${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
                        "Value",
                      ]}
                    />
                  </RechartsPie>
                </ResponsiveContainer>
              ) : (
                <div className="h-48 flex items-center justify-center text-zinc-500 text-sm">
                  Add holdings to see allocation
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
