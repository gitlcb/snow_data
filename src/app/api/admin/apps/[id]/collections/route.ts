import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api-response";
import { requireUser, assertAppOwner } from "@/lib/require-user";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    if (!user) return fail("未登录", 401);

    const { id } = await params;
    if (!(await assertAppOwner(id, user.userId))) return fail("无权访问", 403);

    const groups = await prisma.record.groupBy({
      by: ["collection"],
      where: { appId: id },
      _count: true,
      orderBy: { collection: "asc" },
    });

    const result = groups.map((g) => ({
      collection: g.collection,
      count: g._count,
    }));

    return ok(result);
  } catch (error) {
    console.error("获取集合列表失败:", error);
    return fail("获取集合列表失败", 500);
  }
}
