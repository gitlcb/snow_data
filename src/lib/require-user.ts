import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export interface AuthedUser {
  userId: string;
  email: string;
  role: string;
}

// 用户存在性短缓存，避免每个 admin 请求都查库（10s TTL）
// 缓存值记录该用户当前是否有效（存在且未禁用）
const existsCache = new Map<string, number>();
const EXISTS_TTL_MS = 10_000;

/** 在 admin API 路由中校验登录，返回用户或 null。
 *  除验签外还确认用户仍存在于库中且未被禁用（已删除/禁用用户的有效 token 立即失效）。 */
export async function requireUser(): Promise<AuthedUser | null> {
  const session = await getSession();
  if (!session) return null;

  const now = Date.now();
  const cachedAt = existsCache.get(session.userId) ?? 0;
  if (now - cachedAt > EXISTS_TTL_MS) {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, disabled: true },
    });
    if (!user || user.disabled) {
      existsCache.delete(session.userId);
      return null;
    }
    existsCache.set(session.userId, now);
  }
  return session;
}

/** 要求超级管理员身份。非超管返回 null。 */
export async function requireSuperadmin(): Promise<AuthedUser | null> {
  const user = await requireUser();
  if (!user || user.role !== "superadmin") return null;
  return user;
}

/** 校验某 App 归属当前用户，是则返回 appId，否则 null */
export async function assertAppOwner(
  appId: string,
  userId: string,
): Promise<boolean> {
  const app = await prisma.app.findFirst({
    where: { id: appId, userId },
    select: { id: true },
  });
  return !!app;
}
