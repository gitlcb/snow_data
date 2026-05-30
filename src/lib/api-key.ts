import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

const PREFIX = "sk_live_";
const LAST_USED_THROTTLE_MS = 60_000;
const lastUsedCache = new Map<string, number>();

export interface GeneratedKey {
  plain: string; // 仅生成时返回一次
  keyHash: string;
  keyPrefix: string;
}

export function generateApiKey(): GeneratedKey {
  const raw = randomBytes(24).toString("hex");
  const plain = `${PREFIX}${raw}`;
  return {
    plain,
    keyHash: hashKey(plain),
    keyPrefix: `${plain.slice(0, 12)}...`,
  };
}

export function hashKey(plain: string): string {
  return createHash("sha256").update(plain).digest("hex");
}

export interface ResolvedKey {
  appId: string;
  apiKeyId: string;
  scope: string; // readonly | readwrite
}

/**
 * 从请求头解析 API Key，反推所属 App。
 * 返回 null 表示鉴权失败（无效 Key 或已过期）。
 */
export async function resolveApiKey(
  authHeader: string | null,
): Promise<ResolvedKey | null> {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const plain = match[1].trim();
  if (!plain.startsWith(PREFIX)) return null;

  const keyHash = hashKey(plain);
  const record = await prisma.apiKey.findFirst({
    where: { keyHash },
    select: { id: true, appId: true, scope: true, expiresAt: true },
  });
  if (!record) return null;

  // 已过期的 Key 视为无效
  if (record.expiresAt && record.expiresAt.getTime() <= Date.now()) {
    return null;
  }

  // 节流写 lastUsedAt：同一 key 60s 内最多写一次，避免读 API 退化为写密集
  const now = Date.now();
  const prev = lastUsedCache.get(record.id) ?? 0;
  if (now - prev > LAST_USED_THROTTLE_MS) {
    lastUsedCache.set(record.id, now);
    prisma.apiKey
      .update({ where: { id: record.id }, data: { lastUsedAt: new Date() } })
      .catch((e) => logger.warn("更新 lastUsedAt 失败", e));
  }

  return { appId: record.appId, apiKeyId: record.id, scope: record.scope };
}

/** 写操作（POST/PATCH/DELETE）需要 readwrite scope。 */
export function canWrite(resolved: ResolvedKey): boolean {
  return resolved.scope === "readwrite";
}
