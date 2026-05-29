import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

const PREFIX = "sk_live_";

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
}

/**
 * 从请求头解析 API Key，反推所属 App。
 * 返回 null 表示鉴权失败。
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
    select: { id: true, appId: true },
  });
  if (!record) return null;

  // 异步更新最后使用时间，不阻塞响应
  prisma.apiKey
    .update({ where: { id: record.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return { appId: record.appId, apiKeyId: record.id };
}
