import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api-response";
import { requireUser } from "@/lib/require-user";
import { logger } from "@/lib/logger";

interface RawDaily {
  d: Date | string;
  c: bigint;
}
interface RawClass {
  status_class: string;
  c: bigint;
}
interface RawMethod {
  method: string;
  c: bigint;
}

function recentDates(days: number): string[] {
  const today = new Date();
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (days - 1 - i));
    return d.toISOString().slice(0, 10);
  });
}

export async function GET() {
  try {
    const user = await requireUser();
    if (!user) return fail("未登录", 401);

    const apps = await prisma.app.findMany({
      where: { userId: user.userId },
      select: { id: true },
    });
    const appIds = apps.map((a) => a.id);

    if (appIds.length === 0) {
      return ok({
        totalCalls: 0,
        dailyTrend: recentDates(30).map((date) => ({ date, count: 0 })),
        statusDistribution: [],
        methodDistribution: [],
      });
    }

    const placeholders = appIds.map(() => "?").join(",");
    const dailySql = `SELECT DATE(bucket) AS d, SUM(count) AS c
      FROM usage_stats
      WHERE app_id IN (${placeholders})
        AND bucket >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)
      GROUP BY DATE(bucket)`;
    const classSql = `SELECT status_class, SUM(count) AS c
      FROM usage_stats WHERE app_id IN (${placeholders}) GROUP BY status_class`;
    const methodSql = `SELECT method, SUM(count) AS c
      FROM usage_stats WHERE app_id IN (${placeholders}) GROUP BY method`;

    const [totalAgg, rawDaily, rawClass, rawMethod] = await Promise.all([
      prisma.usageStat.aggregate({
        where: { appId: { in: appIds } },
        _sum: { count: true },
      }),
      prisma.$queryRawUnsafe<RawDaily[]>(dailySql, ...appIds),
      prisma.$queryRawUnsafe<RawClass[]>(classSql, ...appIds),
      prisma.$queryRawUnsafe<RawMethod[]>(methodSql, ...appIds),
    ]);

    const dailyMap = new Map<string, number>();
    for (const row of rawDaily) {
      const date =
        row.d instanceof Date
          ? row.d.toISOString().slice(0, 10)
          : String(row.d).slice(0, 10);
      dailyMap.set(date, Number(row.c));
    }
    const dailyTrend = recentDates(30).map((date) => ({
      date,
      count: dailyMap.get(date) ?? 0,
    }));

    return ok({
      totalCalls: totalAgg._sum.count ?? 0,
      dailyTrend,
      statusDistribution: rawClass.map((r) => ({
        statusClass: r.status_class,
        count: Number(r.c),
      })),
      methodDistribution: rawMethod.map((r) => ({
        method: r.method,
        count: Number(r.c),
      })),
    });
  } catch (error) {
    logger.error("usage GET failed", error);
    return fail("获取用量数据失败", 500);
  }
}
