import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api-response";
import { requireUser } from "@/lib/require-user";

interface DailyTrendRow {
  date: string;
  count: number;
}

interface RawDailyRow {
  d: Date | string;
  c: bigint;
}

/** 生成近 N 天的日期字符串（YYYY-MM-DD），从最早到今天 */
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

    // 没有任何应用时直接返回空统计，避免空 IN 子句
    if (appIds.length === 0) {
      return ok({
        totalApps: 0,
        totalRecords: 0,
        totalKeys: 0,
        totalFiles: 0,
        recentActivity: [],
        collectionDistribution: [],
        dailyTrend: recentDates(30).map((date) => ({ date, count: 0 })),
      });
    }

    const [
      totalRecords,
      totalKeys,
      totalFiles,
      recentRows,
      grouped,
      rawDaily,
    ] = await Promise.all([
      prisma.record.count({ where: { appId: { in: appIds } } }),
      prisma.apiKey.count({ where: { appId: { in: appIds } } }),
      prisma.fileAsset.count({ where: { appId: { in: appIds } } }),
      prisma.record.findMany({
        where: { appId: { in: appIds } },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          collection: true,
          data: true,
          createdAt: true,
          app: { select: { name: true } },
        },
      }),
      prisma.record.groupBy({
        by: ["collection"],
        where: { appId: { in: appIds } },
        _count: { _all: true },
        orderBy: { _count: { collection: "desc" } },
        take: 8,
      }),
      (() => {
        const placeholders = appIds.map(() => "?").join(",");
        const sql = `SELECT DATE(created_at) AS d, COUNT(*) AS c
          FROM records
          WHERE app_id IN (${placeholders})
            AND created_at >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)
          GROUP BY DATE(created_at)`;
        return prisma.$queryRawUnsafe<RawDailyRow[]>(sql, ...appIds);
      })(),
    ]);

    const recentActivity = recentRows.map((r) => ({
      id: r.id,
      collection: r.collection,
      appName: r.app.name,
      createdAt: r.createdAt.toISOString(),
      data: r.data,
    }));

    const collectionDistribution = grouped.map((g) => ({
      collection: g.collection,
      count: g._count._all,
    }));

    // 把 raw 结果按日期建索引，再补齐近 30 天缺失的日期为 0
    const dailyMap = new Map<string, number>();
    for (const row of rawDaily) {
      const date =
        row.d instanceof Date
          ? row.d.toISOString().slice(0, 10)
          : String(row.d).slice(0, 10);
      dailyMap.set(date, Number(row.c));
    }
    const dailyTrend: DailyTrendRow[] = recentDates(30).map((date) => ({
      date,
      count: dailyMap.get(date) ?? 0,
    }));

    return ok({
      totalApps: appIds.length,
      totalRecords,
      totalKeys,
      totalFiles,
      recentActivity,
      collectionDistribution,
      dailyTrend,
    });
  } catch (error) {
    console.error("stats GET failed:", error);
    return fail("获取统计数据失败", 500);
  }
}
