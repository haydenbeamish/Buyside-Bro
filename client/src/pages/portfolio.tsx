import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PriceChange } from "@/components/price-change";
import { TableRowSkeleton } from "@/components/loading-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Briefcase,
  Plus,
  TrendingUp,
  TrendingDown,
  DollarSign,
  PieChart,
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
  Legend,
} from "recharts";

interface PortfolioStats {
  totalValue: number;
  totalGain: number;
  totalGainPercent: number;
  dayChange: number;
  dayChangePercent: number;
}

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

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

  const { data: analysis, isLoading: analysisLoading } = useQuery<{ analysis: string }>({
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
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
            <Briefcase className="h-7 w-7 text-primary" />
            Portfolio
          </h1>
          <p className="text-muted-foreground mt-1">
            Track your holdings and performance
          </p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-position">
              <Plus className="h-4 w-4 mr-2" />
              Add Position
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Position</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddHolding} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ticker">Ticker Symbol</Label>
                <Input
                  id="ticker"
                  placeholder="AAPL"
                  value={newHolding.ticker}
                  onChange={(e) =>
                    setNewHolding({ ...newHolding, ticker: e.target.value })
                  }
                  data-testid="input-ticker"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shares">Number of Shares</Label>
                <Input
                  id="shares"
                  type="number"
                  step="0.0001"
                  placeholder="100"
                  value={newHolding.shares}
                  onChange={(e) =>
                    setNewHolding({ ...newHolding, shares: e.target.value })
                  }
                  data-testid="input-shares"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="avgCost">Average Cost per Share</Label>
                <Input
                  id="avgCost"
                  type="number"
                  step="0.01"
                  placeholder="150.00"
                  value={newHolding.avgCost}
                  onChange={(e) =>
                    setNewHolding({ ...newHolding, avgCost: e.target.value })
                  }
                  data-testid="input-avg-cost"
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={addMutation.isPending}
                data-testid="button-submit-position"
              >
                {addMutation.isPending ? "Adding..." : "Add Position"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <DollarSign className="h-4 w-4" />
              <span className="text-xs font-medium">Total Value</span>
            </div>
            {statsLoading ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <p className="text-2xl font-bold font-mono">
                ${stats?.totalValue?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || "0.00"}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs font-medium">Total Gain</span>
            </div>
            {statsLoading ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-bold font-mono">
                  ${Math.abs(stats?.totalGain || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
                <PriceChange value={stats?.totalGainPercent || 0} size="sm" showIcon={false} />
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              {(stats?.dayChange || 0) >= 0 ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}
              <span className="text-xs font-medium">Day Change</span>
            </div>
            {statsLoading ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-bold font-mono">
                  ${Math.abs(stats?.dayChange || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
                <PriceChange value={stats?.dayChangePercent || 0} size="sm" showIcon={false} />
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <PieChart className="h-4 w-4" />
              <span className="text-xs font-medium">Positions</span>
            </div>
            {holdingsLoading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <p className="text-2xl font-bold font-mono">{holdings?.length || 0}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {analysis && (
        <Card className="bg-gradient-to-r from-accent/5 to-primary/5 border-accent/20">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10">
                <Sparkles className="h-5 w-5 text-accent" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground mb-2">AI Portfolio Analysis</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {analysis.analysis}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold">Holdings</CardTitle>
          </CardHeader>
          <CardContent>
            {holdingsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <TableRowSkeleton key={i} columns={6} />
                ))}
              </div>
            ) : holdings && holdings.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Symbol</TableHead>
                      <TableHead className="text-right">Shares</TableHead>
                      <TableHead className="text-right">Avg Cost</TableHead>
                      <TableHead className="text-right">Current</TableHead>
                      <TableHead className="text-right">Gain/Loss</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {holdings.map((holding) => {
                      const currentPrice = Number(holding.currentPrice || holding.avgCost);
                      const avgCost = Number(holding.avgCost);
                      const shares = Number(holding.shares);
                      const gainPercent = ((currentPrice - avgCost) / avgCost) * 100;
                      const gainValue = (currentPrice - avgCost) * shares;

                      return (
                        <TableRow key={holding.id}>
                          <TableCell>
                            <div>
                              <span className="font-mono font-semibold">
                                {holding.ticker}
                              </span>
                              {holding.name && (
                                <p className="text-xs text-muted-foreground truncate max-w-[120px]">
                                  {holding.name}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {shares.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            ${avgCost.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            ${currentPrice.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-col items-end">
                              <span
                                className={`font-mono text-sm ${
                                  gainValue >= 0
                                    ? "text-green-500 dark:text-green-400"
                                    : "text-red-500 dark:text-red-400"
                                }`}
                              >
                                {gainValue >= 0 ? "+" : ""}
                                ${Math.abs(gainValue).toFixed(2)}
                              </span>
                              <PriceChange
                                value={gainPercent}
                                size="sm"
                                showIcon={false}
                              />
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteMutation.mutate(holding.id)}
                              disabled={deleteMutation.isPending}
                              data-testid={`button-delete-${holding.ticker}`}
                            >
                              <Trash2 className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12">
                <Briefcase className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <h3 className="font-semibold text-foreground mb-1">No holdings yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Add your first position to start tracking your portfolio.
                </p>
                <Button onClick={() => setIsAddOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Position
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold">Allocation</CardTitle>
          </CardHeader>
          <CardContent>
            {holdingsLoading ? (
              <Skeleton className="h-48 w-full" />
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
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
                    {pieData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [
                      `$${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
                      "Value",
                    ]}
                  />
                </RechartsPie>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                Add holdings to see allocation
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
