import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api-response";
import { requireUser } from "@/lib/require-user";
import { logger } from "@/lib/logger";

// 任意登录管理员可读，仅返回已发布公告（供登录后弹窗展示）
export async function GET() {
  try {
    const user = await requireUser();
    if (!user) return fail("未登录", 401);

    const list = await prisma.announcement.findMany({
      where: { published: true },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        body: true,
        type: true,
        createdAt: true,
      },
    });

    return ok(list);
  } catch (error) {
    logger.error("获取公告失败", error);
    return fail("获取公告失败", 500);
  }
}
