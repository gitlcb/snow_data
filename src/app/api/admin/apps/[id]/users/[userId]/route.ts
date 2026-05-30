import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api-response";
import { requireUser, assertAppOwner } from "@/lib/require-user";
import { logger } from "@/lib/logger";

// 删除终端用户：连带删除其拥有的记录（账号注销语义，避免遗留私有数据成为孤儿）
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  try {
    const user = await requireUser();
    if (!user) return fail("未登录", 401);

    const { id, userId } = await params;
    if (!(await assertAppOwner(id, user.userId))) return fail("无权访问", 403);

    const endUser = await prisma.endUser.findFirst({
      where: { id: userId, appId: id },
      select: { id: true },
    });
    if (!endUser) return fail("终端用户不存在", 404);

    const [{ count }] = await prisma.$transaction([
      prisma.record.deleteMany({ where: { appId: id, ownerId: userId } }),
      prisma.endUser.delete({ where: { id: userId } }),
    ]);

    return ok({ ok: true, deletedRecords: count });
  } catch (error) {
    logger.error("删除终端用户失败", error);
    return fail("删除终端用户失败", 500);
  }
}
