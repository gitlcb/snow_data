import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api-response";
import { requireSuperadmin } from "@/lib/require-user";
import { logger } from "@/lib/logger";

// 超管查看单个平台用户的应用列表与数据统计
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ uid: string }> },
) {
  try {
    const admin = await requireSuperadmin();
    if (!admin) return fail("需要超级管理员权限", 403);

    const { uid } = await params;
    const user = await prisma.user.findUnique({
      where: { id: uid },
      select: { id: true, email: true, name: true, role: true, disabled: true },
    });
    if (!user) return fail("用户不存在", 404);

    const apps = await prisma.app.findMany({
      where: { userId: uid },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        _count: { select: { records: true, apiKeys: true, files: true } },
      },
    });
    const appIds = apps.map((a) => a.id);

    if (appIds.length === 0) {
      return ok({
        user,
        apps: [],
        totals: { apps: 0, records: 0, keys: 0, files: 0, endUsers: 0 },
        collectionDistribution: [],
      });
    }

    const [totalRecords, totalKeys, totalFiles, totalEndUsers, grouped] =
      await Promise.all([
        prisma.record.count({ where: { appId: { in: appIds } } }),
        prisma.apiKey.count({ where: { appId: { in: appIds } } }),
        prisma.fileAsset.count({ where: { appId: { in: appIds } } }),
        prisma.endUser.count({ where: { appId: { in: appIds } } }),
        prisma.record.groupBy({
          by: ["collection"],
          where: { appId: { in: appIds } },
          _count: { _all: true },
          orderBy: { _count: { collection: "desc" } },
          take: 10,
        }),
      ]);

    return ok({
      user,
      apps,
      totals: {
        apps: apps.length,
        records: totalRecords,
        keys: totalKeys,
        files: totalFiles,
        endUsers: totalEndUsers,
      },
      collectionDistribution: grouped.map((g) => ({
        collection: g.collection,
        count: g._count._all,
      })),
    });
  } catch (error) {
    logger.error("获取用户统计失败", error);
    return fail("获取用户统计失败", 500);
  }
}
