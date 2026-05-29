import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export interface AuthedUser {
  userId: string;
  email: string;
}

/** 在 admin API 路由中校验登录，返回用户或 null */
export async function requireUser(): Promise<AuthedUser | null> {
  const session = await getSession();
  if (!session) return null;
  return session;
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
