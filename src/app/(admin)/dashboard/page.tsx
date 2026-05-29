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
import { Boxes, Database, KeyRound, FileImage } from "lucide-react";
import { api, type ApiResponse } from "@/lib/api-client";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface DailyTrend {
  date: string;
  count: number;
}
interface CollectionDist {
  collection: string;
  count: number;
}
interface RecentActivity {
  id: string;
  collection: string;
  appName: string;
  createdAt: string;
  data: unknown;
}
interface Stats {
  totalApps: number;
  totalRecords: number;
  totalKeys: number;
  totalFiles: number;
  recentActivity: RecentActivity[];
  collectionDistribution: CollectionDist[];
  dailyTrend: DailyTrend[];
}

const CHART_COLOR = "hsl(217 91% 60%)";
const BAR_COLORS = [
  "hsl(217 91% 60%)",
  "hsl(199 89% 56%)",
  "hsl(245 79% 67%)",
  "hsl(271 76% 63%)",
  "hsl(189 80% 50%)",
  "hsl(231 77% 66%)",
  "hsl(206 90% 54%)",
  "hsl(258 80% 66%)",
];

/** 相对时间格式化（x分钟前 / x小时前 / x天前） */
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "刚刚";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}分钟前`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}小时前`;
  const day = Math.floor(hour / 24);
  if (day < 30) return `${day}天前`;
  return new Date(iso).toLocaleDateString("zh-CN");
}

/** 把 record.data 转成一行摘要文本 */
function dataSummary(data: unknown): string {
  if (data == null) return "—";
  if (typeof data !== "object") return String(data);
  const entries = Object.entries(data as Record<string, unknown>);
  if (entries.length === 0) return "{}";
  return entries
    .slice(0, 3)
    .map(([k, v]) => `${k}: ${typeof v === "object" ? "…" : String(v)}`)
    .join(" · ");
}

function shortDate(iso: string): string {
  return iso.slice(5); // MM-DD
}

const STAT_CARDS = [
  { key: "totalApps", label: "应用数", icon: Boxes },
  { key: "totalRecords", label: "记录总数", icon: Database },
  { key: "totalKeys", label: "API Key 数", icon: KeyRound },
  { key: "totalFiles", label: "文件数", icon: FileImage },
] as const;

export default function DashboardPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["stats"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Stats>>("/admin/stats");
      if (!res.data.success || !res.data.data) {
        throw new Error(res.data.error ?? "加载失败");
      }
      return res.data.data;
    },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">仪表盘</h1>
        <p className="mt-1 text-sm text-muted-foreground">你的数据存储概览</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {STAT_CARDS.map(({ key, label, icon: Icon }) => (
          <Card key={key} className="overflow-hidden">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <div className="text-2xl font-bold tabular-nums">
                  {isLoading ? (
                    <span className="inline-block h-7 w-12 animate-pulse rounded bg-muted" />
                  ) : (
                    (data?.[key] ?? 0).toLocaleString()
                  )}
                </div>
                <div className="text-xs text-muted-foreground">{label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 写入趋势 */}
      <Card>
        <CardHeader>
          <CardTitle>写入趋势</CardTitle>
          <CardDescription>近 30 天记录写入数量</CardDescription>
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
                  <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor={CHART_COLOR}
                      stopOpacity={0.35}
                    />
                    <stop
                      offset="95%"
                      stopColor={CHART_COLOR}
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="hsl(var(--border))"
                  opacity={0.4}
                />
                <XAxis
                  dataKey="date"
                  tickFormatter={shortDate}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={24}
                  tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  width={36}
                  tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid hsl(var(--border))",
                    fontSize: 12,
                  }}
                  labelFormatter={(l) => `日期 ${l}`}
                  formatter={(v: number) => [v, "记录"]}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke={CHART_COLOR}
                  strokeWidth={2}
                  fill="url(#trendFill)"
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* 集合分布 + 最近活动 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>集合分布</CardTitle>
            <CardDescription>记录数最多的集合</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-72 w-full animate-pulse rounded-lg bg-muted" />
            ) : !data?.collectionDistribution.length ? (
              <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
                暂无数据
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={288}>
                <BarChart
                  layout="vertical"
                  data={data.collectionDistribution}
                  margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                >
                  <CartesianGrid
                    horizontal={false}
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                    opacity={0.4}
                  />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    tick={{
                      fontSize: 12,
                      fill: "hsl(var(--muted-foreground))",
                    }}
                  />
                  <YAxis
                    type="category"
                    dataKey="collection"
                    width={96}
                    tickLine={false}
                    axisLine={false}
                    tick={{
                      fontSize: 12,
                      fill: "hsl(var(--muted-foreground))",
                    }}
                  />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid hsl(var(--border))",
                      fontSize: 12,
                    }}
                    formatter={(v: number) => [v, "记录"]}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={18}>
                    {data.collectionDistribution.map((_, i) => (
                      <Cell
                        key={i}
                        fill={BAR_COLORS[i % BAR_COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>最近活动</CardTitle>
            <CardDescription>最新写入的记录</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-12 w-full animate-pulse rounded-lg bg-muted"
                  />
                ))}
              </div>
            ) : !data?.recentActivity.length ? (
              <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
                暂无活动
              </div>
            ) : (
              <ul className="divide-y">
                {data.recentActivity.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="shrink-0">
                          {item.appName}
                        </Badge>
                        <span
                          className={cn(
                            "truncate font-mono text-xs text-muted-foreground",
                          )}
                        >
                          {item.collection}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-sm text-foreground">
                        {dataSummary(item.data)}
                      </p>
                    </div>
                    <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
                      {relativeTime(item.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
