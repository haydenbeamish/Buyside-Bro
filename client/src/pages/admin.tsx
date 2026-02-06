import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  Activity,
  DollarSign,
  Eye,
  Clock,
  BarChart3,
  Zap,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Shield,
  ShieldAlert,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";

interface AdminStats {
  totalUsers: number;
  totalApiCalls: number;
  apiCallsToday: number;
  apiCallsThisWeek: number;
  activeUsersToday: number;
  activeUsersThisWeek: number;
  totalAiCostCents: number;
}

interface UserStat {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  subscriptionStatus: string | null;
  creditBalanceCents: number;
  monthlyCreditsUsedCents: number;
  createdAt: string | null;
  totalAiCostCents: number;
  totalAiCalls: number;
  totalPageViews: number;
  lastActive: string | null;
}

interface ActivityLog {
  id: number;
  userId: string | null;
  action: string;
  path: string;
  method: string;
  createdAt: string;
}

interface ActivitySummary {
  actionCounts: { action: string; count: number }[];
  hourlyActivity: { hour: number; count: number }[];
  dailyActivity: { date: string; count: number }[];
}

interface AiUsage {
  perUserCost: {
    userId: string;
    feature: string;
    totalCostCents: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    callCount: number;
  }[];
  recentUsage: {
    id: number;
    userId: string;
    feature: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    costCents: number;
    createdAt: string;
  }[];
}

function StatCard({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-zinc-900/50 border border-green-900/30 rounded-md p-4" data-testid={`stat-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-green-400" />
        <span className="text-xs text-zinc-500 uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-bold text-white ticker-font">{value}</div>
      {sub && <div className="text-xs text-zinc-500 mt-1">{sub}</div>}
    </div>
  );
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays}d ago`;
}

function getStatusBadge(status: string | null) {
  if (!status || status === "none") return <Badge variant="outline" className="text-zinc-500 border-zinc-700">None</Badge>;
  if (status === "active") return <Badge className="bg-green-900/30 text-green-400 border-green-700">Active</Badge>;
  if (status === "trialing") return <Badge className="bg-blue-900/30 text-blue-400 border-blue-700">Trial</Badge>;
  return <Badge variant="outline" className="text-yellow-500 border-yellow-700">{status}</Badge>;
}

export default function AdminPage() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "activity" | "ai-usage">("overview");
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  const { data: adminCheck, isLoading: adminCheckLoading, isError: adminCheckError } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["/api/admin/check"],
    retry: false,
  });

  const isAdmin = adminCheck?.isAdmin === true;

  const { data: stats, isLoading: statsLoading } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
    enabled: isAdmin,
  });

  const { data: userList, isLoading: usersLoading } = useQuery<UserStat[]>({
    queryKey: ["/api/admin/users"],
    enabled: isAdmin && (activeTab === "users" || activeTab === "overview"),
  });

  const { data: activityLogs, isLoading: activityLoading } = useQuery<ActivityLog[]>({
    queryKey: ["/api/admin/activity"],
    enabled: isAdmin && activeTab === "activity",
  });

  const { data: activitySummary, isLoading: summaryLoading } = useQuery<ActivitySummary>({
    queryKey: ["/api/admin/activity-summary"],
    enabled: isAdmin && activeTab === "overview",
  });

  const { data: aiUsage, isLoading: aiLoading } = useQuery<AiUsage>({
    queryKey: ["/api/admin/ai-usage"],
    enabled: isAdmin && activeTab === "ai-usage",
  });

  if (adminCheckLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-black">
        <div className="text-center">
          <Shield className="h-8 w-8 text-green-400 animate-pulse mx-auto mb-3" />
          <p className="text-zinc-500 text-sm">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (adminCheckError || !isAdmin) {
    return (
      <div className="flex items-center justify-center h-full bg-black">
        <div className="text-center max-w-md" data-testid="admin-access-denied">
          <ShieldAlert className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white display-font mb-2">Access Denied</h2>
          <p className="text-zinc-500 text-sm mb-4">You don't have permission to view this page.</p>
          <Button
            onClick={() => navigate("/dashboard")}
            className="neon-button"
            data-testid="button-back-dashboard"
          >
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "overview" as const, label: "Overview", icon: BarChart3 },
    { id: "users" as const, label: "Users", icon: Users },
    { id: "activity" as const, label: "Activity Log", icon: Activity },
    { id: "ai-usage" as const, label: "Bro Usage", icon: Zap },
  ];

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-6 w-6 text-green-400" />
        <h1 className="display-font text-xl md:text-2xl tracking-wider neon-green">ADMIN DASHBOARD</h1>
      </div>
      <p className="text-sm text-zinc-500">Monitor user activity, Bro costs, and platform usage.</p>

      <div className="flex gap-2 border-b border-green-900/30 pb-2 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? "bg-green-900/20 text-green-400 border border-green-900/40"
                : "text-zinc-400 hover:text-green-400 hover:bg-green-900/10"
            }`}
            data-testid={`tab-${tab.id}`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div className="space-y-6">
          {statsLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-24 bg-zinc-800" />
              ))}
            </div>
          ) : stats ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard icon={Users} label="Total Users" value={stats.totalUsers} />
              <StatCard icon={Eye} label="Active Today" value={stats.activeUsersToday} />
              <StatCard icon={Activity} label="API Calls Today" value={stats.apiCallsToday} />
              <StatCard icon={TrendingUp} label="Calls This Week" value={stats.apiCallsThisWeek} />
              <StatCard icon={Users} label="Active This Week" value={stats.activeUsersThisWeek} />
              <StatCard icon={Activity} label="Total API Calls" value={stats.totalApiCalls} />
              <StatCard icon={DollarSign} label="Total Bro Cost" value={formatCents(stats.totalAiCostCents)} />
              <StatCard icon={Clock} label="Avg Cost/User" value={
                stats.totalUsers > 0 ? formatCents(Math.round(stats.totalAiCostCents / stats.totalUsers)) : "$0.00"
              } />
            </div>
          ) : null}

          {activitySummary && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-zinc-900/50 border border-green-900/30 rounded-md p-4">
                <h3 className="text-sm text-zinc-400 uppercase tracking-wider mb-4">Activity by Action</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={activitySummary.actionCounts.slice(0, 10)}>
                    <XAxis dataKey="action" tick={{ fill: "#a1a1aa", fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
                    <YAxis tick={{ fill: "#a1a1aa", fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#18181b", border: "1px solid #166534", borderRadius: "6px" }}
                      labelStyle={{ color: "#a1a1aa" }}
                      itemStyle={{ color: "#4ade80" }}
                    />
                    <Bar dataKey="count" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-zinc-900/50 border border-green-900/30 rounded-md p-4">
                <h3 className="text-sm text-zinc-400 uppercase tracking-wider mb-4">Daily Activity (30d)</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={activitySummary.dailyActivity}>
                    <XAxis dataKey="date" tick={{ fill: "#a1a1aa", fontSize: 10 }} tickFormatter={(v) => new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric" })} />
                    <YAxis tick={{ fill: "#a1a1aa", fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#18181b", border: "1px solid #166534", borderRadius: "6px" }}
                      labelStyle={{ color: "#a1a1aa" }}
                      itemStyle={{ color: "#4ade80" }}
                    />
                    <Area type="monotone" dataKey="count" stroke="#22c55e" fill="#22c55e" fillOpacity={0.15} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {userList && (
            <div className="bg-zinc-900/50 border border-green-900/30 rounded-md p-4">
              <h3 className="text-sm text-zinc-400 uppercase tracking-wider mb-4">Top Users by Bro Cost</h3>
              <div className="space-y-2">
                {[...userList].sort((a, b) => b.totalAiCostCents - a.totalAiCostCents).slice(0, 5).map((u) => (
                  <div key={u.id} className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-green-900/30 flex items-center justify-center text-green-400 text-xs font-bold">
                        {u.firstName?.[0] || u.email?.[0]?.toUpperCase() || "?"}
                      </div>
                      <div>
                        <span className="text-sm text-white">{u.email || u.firstName || "Unknown"}</span>
                        <span className="text-xs text-zinc-500 ml-2">{u.totalAiCalls} calls</span>
                      </div>
                    </div>
                    <span className="ticker-font text-sm text-green-400">{formatCents(u.totalAiCostCents)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "users" && (
        <div className="space-y-4">
          {usersLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 bg-zinc-800" />
            ))
          ) : userList ? (
            <div className="bg-zinc-900/50 border border-green-900/30 rounded-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="table-users">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase tracking-wider">
                      <th className="px-4 py-3 text-left">User</th>
                      <th className="px-3 py-3 text-center">Status</th>
                      <th className="px-3 py-3 text-right">Bro Cost</th>
                      <th className="px-3 py-3 text-right">Bro Calls</th>
                      <th className="px-3 py-3 text-right">Page Views</th>
                      <th className="px-3 py-3 text-right">Credits Used</th>
                      <th className="px-3 py-3 text-right">Last Active</th>
                      <th className="px-3 py-3 text-right">Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userList.map((u) => (
                      <tr
                        key={u.id}
                        className="border-b border-zinc-800/50 hover:bg-green-900/5 cursor-pointer transition-colors"
                        onClick={() => setExpandedUser(expandedUser === u.id ? null : u.id)}
                        data-testid={`row-user-${u.id}`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {expandedUser === u.id ? <ChevronUp className="h-3 w-3 text-zinc-500" /> : <ChevronDown className="h-3 w-3 text-zinc-500" />}
                            <div className="w-7 h-7 rounded-full bg-green-900/30 flex items-center justify-center text-green-400 text-xs font-bold flex-shrink-0">
                              {u.firstName?.[0] || u.email?.[0]?.toUpperCase() || "?"}
                            </div>
                            <div className="min-w-0">
                              <div className="text-white truncate text-xs">{u.email || "No email"}</div>
                              <div className="text-zinc-500 text-xs truncate">{u.firstName} {u.lastName}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center">{getStatusBadge(u.subscriptionStatus)}</td>
                        <td className="px-3 py-3 text-right ticker-font text-green-400">{formatCents(u.totalAiCostCents)}</td>
                        <td className="px-3 py-3 text-right ticker-font text-zinc-300">{u.totalAiCalls}</td>
                        <td className="px-3 py-3 text-right ticker-font text-zinc-300">{u.totalPageViews}</td>
                        <td className="px-3 py-3 text-right ticker-font text-zinc-300">{formatCents(u.monthlyCreditsUsedCents)}</td>
                        <td className="px-3 py-3 text-right text-zinc-400 text-xs">{timeAgo(u.lastActive)}</td>
                        <td className="px-3 py-3 text-right text-zinc-500 text-xs">
                          {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {activeTab === "activity" && (
        <div className="space-y-4">
          {activityLoading ? (
            Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-10 bg-zinc-800" />
            ))
          ) : activityLogs ? (
            <div className="bg-zinc-900/50 border border-green-900/30 rounded-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="table-activity">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase tracking-wider">
                      <th className="px-4 py-3 text-left">Time</th>
                      <th className="px-3 py-3 text-left">User</th>
                      <th className="px-3 py-3 text-left">Action</th>
                      <th className="px-3 py-3 text-left">Method</th>
                      <th className="px-3 py-3 text-left">Path</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activityLogs.map((log) => (
                      <tr key={log.id} className="border-b border-zinc-800/50 hover:bg-green-900/5 transition-colors">
                        <td className="px-4 py-2.5 text-zinc-400 text-xs whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="px-3 py-2.5 text-xs">
                          <span className="text-zinc-300 ticker-font">{log.userId ? log.userId.substring(0, 8) + "..." : "anon"}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge variant="outline" className="text-green-400 border-green-900/40 text-xs">{log.action}</Badge>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`ticker-font text-xs ${
                            log.method === "GET" ? "text-blue-400" : 
                            log.method === "POST" ? "text-green-400" : 
                            log.method === "DELETE" ? "text-red-400" : "text-yellow-400"
                          }`}>{log.method}</span>
                        </td>
                        <td className="px-3 py-2.5 text-zinc-400 text-xs ticker-font truncate max-w-xs">{log.path}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {activeTab === "ai-usage" && (
        <div className="space-y-6">
          {aiLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 bg-zinc-800" />
              ))}
            </div>
          ) : aiUsage ? (
            <>
              <div className="bg-zinc-900/50 border border-green-900/30 rounded-md p-4">
                <h3 className="text-sm text-zinc-400 uppercase tracking-wider mb-4">Cost by User & Feature</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="table-ai-cost">
                    <thead>
                      <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase tracking-wider">
                        <th className="px-4 py-3 text-left">User ID</th>
                        <th className="px-3 py-3 text-left">Feature</th>
                        <th className="px-3 py-3 text-right">Calls</th>
                        <th className="px-3 py-3 text-right">Input Tokens</th>
                        <th className="px-3 py-3 text-right">Output Tokens</th>
                        <th className="px-3 py-3 text-right">Total Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {aiUsage.perUserCost.map((row, i) => (
                        <tr key={i} className="border-b border-zinc-800/50 hover:bg-green-900/5 transition-colors">
                          <td className="px-4 py-2.5 text-xs ticker-font text-zinc-300">{row.userId.substring(0, 12)}...</td>
                          <td className="px-3 py-2.5">
                            <Badge variant="outline" className="text-green-400 border-green-900/40 text-xs">{row.feature}</Badge>
                          </td>
                          <td className="px-3 py-2.5 text-right ticker-font text-zinc-300">{row.callCount}</td>
                          <td className="px-3 py-2.5 text-right ticker-font text-zinc-400">{Number(row.totalInputTokens).toLocaleString()}</td>
                          <td className="px-3 py-2.5 text-right ticker-font text-zinc-400">{Number(row.totalOutputTokens).toLocaleString()}</td>
                          <td className="px-3 py-2.5 text-right ticker-font text-green-400">{formatCents(Number(row.totalCostCents))}</td>
                        </tr>
                      ))}
                      {aiUsage.perUserCost.length === 0 && (
                        <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-500">No Bro usage recorded yet</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-zinc-900/50 border border-green-900/30 rounded-md p-4">
                <h3 className="text-sm text-zinc-400 uppercase tracking-wider mb-4">Recent Bro Calls</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase tracking-wider">
                        <th className="px-4 py-3 text-left">Time</th>
                        <th className="px-3 py-3 text-left">Feature</th>
                        <th className="px-3 py-3 text-left">Model</th>
                        <th className="px-3 py-3 text-right">Tokens (In/Out)</th>
                        <th className="px-3 py-3 text-right">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {aiUsage.recentUsage.map((row) => (
                        <tr key={row.id} className="border-b border-zinc-800/50 hover:bg-green-900/5 transition-colors">
                          <td className="px-4 py-2.5 text-zinc-400 text-xs whitespace-nowrap">
                            {new Date(row.createdAt).toLocaleString()}
                          </td>
                          <td className="px-3 py-2.5">
                            <Badge variant="outline" className="text-green-400 border-green-900/40 text-xs">{row.feature}</Badge>
                          </td>
                          <td className="px-3 py-2.5 text-xs ticker-font text-zinc-400 truncate max-w-32">{row.model}</td>
                          <td className="px-3 py-2.5 text-right ticker-font text-zinc-300 text-xs">
                            {(row.inputTokens || 0).toLocaleString()} / {(row.outputTokens || 0).toLocaleString()}
                          </td>
                          <td className="px-3 py-2.5 text-right ticker-font text-green-400">{formatCents(row.costCents)}</td>
                        </tr>
                      ))}
                      {aiUsage.recentUsage.length === 0 && (
                        <tr><td colSpan={5} className="px-4 py-8 text-center text-zinc-500">No recent Bro calls</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
