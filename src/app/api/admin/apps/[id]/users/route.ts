import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api-response";
import { requireUser, assertAppOwner } from "@/lib/require-user";
import { logger } from "@/lib/logger";

// 列出某 App 下的终端用户
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    if (!user) return fail("未登录", 401);

    const { id } = await params;
    if (!(await assertAppOwner(id, user.userId))) return fail("无权访问", 403);

    const users = await prisma.endUser.findMany({
      where: { appId: id },
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, createdAt: true },
    });

    // 各终端用户拥有的记录数（按 ownerId 聚合）
    const grouped = await prisma.record.groupBy({
      by: ["ownerId"],
      where: { appId: id, ownerId: { not: null } },
      _count: true,
    });
    const countMap = new Map(grouped.map((g) => [g.ownerId, g._count]));

    const result = users.map((u) => ({
      ...u,
      recordCount: countMap.get(u.id) ?? 0,
    }));

    return ok(result);
  } catch (error) {
    logger.error("列出终端用户失败", error);
    return fail("获取终端用户列表失败", 500);
  }
}
