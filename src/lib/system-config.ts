import { prisma } from "@/lib/prisma";

export interface SystemConfigData {
  id: string;
  registrationOpen: boolean;
  linuxdoEnabled: boolean;
  linuxdoClientId: string | null;
  linuxdoClientSecret: string | null;
  uploadMaxBytes: number;
  uploadAllowedMime: string;
  updatedAt: Date;
}

const SINGLETON_ID = "singleton";
const CACHE_TTL_MS = 30_000;

let cache: { at: number; data: SystemConfigData } | null = null;

/** 读取全局系统配置（带 30s 进程内缓存）；首次无行时惰性创建默认行。 */
export async function getSystemConfig(): Promise<SystemConfigData> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) return cache.data;

  const data = await prisma.systemConfig.upsert({
    where: { id: SINGLETON_ID },
    update: {},
    create: { id: SINGLETON_ID },
  });
  cache = { at: now, data };
  return data;
}

/** 更新系统配置并失效缓存。只更新传入的字段。 */
export async function updateSystemConfig(
  patch: Partial<Omit<SystemConfigData, "id" | "updatedAt">>,
): Promise<SystemConfigData> {
  const data = await prisma.systemConfig.upsert({
    where: { id: SINGLETON_ID },
    update: patch,
    create: { id: SINGLETON_ID, ...patch },
  });
  cache = { at: Date.now(), data };
  return data;
}

/** 主动失效缓存（配置变更后调用，确保下次读取最新值）。 */
export function invalidateSystemConfigCache(): void {
  cache = null;
}
