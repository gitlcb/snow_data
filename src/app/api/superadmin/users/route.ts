import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api-response";
import { requireSuperadmin } from "@/lib/require-user";
import { logger } from "@/lib/logger";

// 列出所有平台用户（超管视角，不按 userId 过滤）
export async function GET() {
  try {
    const admin = await requireSuperadmin();
    if (!admin) return fail("需要超级管理员权限", 403);

    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        disabled: true,
        oauthProvider: true,
        avatarUrl: true,
        createdAt: true,
        _count: { select: { apps: true } },
      },
    });

    return ok(users);
  } catch (error) {
    logger.error("列出平台用户失败", error);
    return fail("获取用户列表失败", 500);
  }
}
