"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
import { Activity, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { api, type ApiResponse } from "@/lib/api-client";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

interface DailyTrend {
  date: string;
  count: number;
}
interface Dist {
  statusClass?: string;
  method?: string;
  count: number;
}
interface UsageData {
  totalCalls: number;
  dailyTrend: DailyTrend[];
  statusDistribution: Dist[];
  methodDistribution: Dist[];
}

const CHART_COLOR = "hsl(217 91% 60%)";

function shortDate(iso: string): string {
  return iso.slice(5);
}

export default function UsagePage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["usage"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<UsageData>>("/admin/usage");
      if (!res.data.success || !res.data.data) {
        throw new Error(res.data.error ?? "加载失败");
      }
      return res.data.data;
    },
  });

  const statusCount = (cls: string) =>
    data?.statusDistribution.find((s) => s.statusClass === cls)?.count ?? 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">API 用量</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          对外 API 调用统计（按小时聚合）
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "总调用数", value: data?.totalCalls ?? 0, icon: Activity },
          { label: "成功 (2xx)", value: statusCount("2xx"), icon: CheckCircle2 },
          { label: "客户端错误 (4xx)", value: statusCount("4xx"), icon: AlertTriangle },
          { label: "服务端错误 (5xx)", value: statusCount("5xx"), icon: XCircle },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label} className="overflow-hidden">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <div className="text-2xl font-bold tabular-nums">
                  {isLoading ? (
                    <span className="inline-block h-7 w-12 animate-pulse rounded bg-muted" />
                  ) : (
                    value.toLocaleString()
                  )}
                </div>
                <div className="text-xs text-muted-foreground">{label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>调用趋势</CardTitle>
          <CardDescription>近 30 天 API 调用次数</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-72 w-full animate-pulse rounded-lg bg-muted" />
          ) : isError ? (
            <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
              加载失败
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={288}>
              <AreaChart
                data={data?.dailyTrend ?? []}
                margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="usageFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLOR} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={CHART_COLOR} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="var(--border)"
                  opacity={0.4}
                />
                <XAxis
                  dataKey="date"
                  tickFormatter={shortDate}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={24}
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  width={36}
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--popover)",
                    color: "var(--popover-foreground)",
                    fontSize: 12,
                  }}
                  labelFormatter={(l) => `日期 ${l}`}
                  formatter={(v: number) => [v, "次"]}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke={CHART_COLOR}
                  strokeWidth={2}
                  fill="url(#usageFill)"
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>按方法分布</CardTitle>
          <CardDescription>各 HTTP 方法的调用次数</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-64 w-full animate-pulse rounded-lg bg-muted" />
          ) : !data?.methodDistribution.length ? (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
              暂无数据
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={256}>
              <BarChart
                data={data.methodDistribution}
                margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
              >
                <CartesianGrid
                  vertical={false}
                  strokeDasharray="3 3"
                  stroke="var(--border)"
                  opacity={0.4}
                />
                <XAxis
                  dataKey="method"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  width={36}
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                />
                <Tooltip
                  cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--popover)",
                    color: "var(--popover-foreground)",
                    fontSize: 12,
                  }}
                  formatter={(v: number) => [v, "次"]}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={48}>
                  {data.methodDistribution.map((d) => (
                    <Cell key={d.method} fill={CHART_COLOR} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
