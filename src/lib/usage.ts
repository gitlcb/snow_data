import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { nanoid } from "nanoid";

export type StatusClass = "2xx" | "4xx" | "5xx";

export function statusClassOf(status: number): StatusClass {
  if (status >= 500) return "5xx";
  if (status >= 400) return "4xx";
  return "2xx";
}

/** 把时间截断到整点，作为聚合桶。 */
function hourBucket(now: Date): Date {
  const d = new Date(now);
  d.setMinutes(0, 0, 0);
  return d;
}

/**
 * 记录一次 API 调用到 usage_stats（按 小时桶×app×key×method×状态类 聚合自增）。
 * 异步 fire-and-forget，绝不阻塞响应；失败仅记日志。
 * apiKeyId 为空（终端用户调用）时用空串占位，避免 MySQL 唯一索引把 NULL 视为相异而无法聚合。
 */
export function recordUsage(
  appId: string,
  apiKeyId: string | null,
  method: string,
  status: number,
): void {
  const bucket = hourBucket(new Date());
  const statusClass = statusClassOf(status);
  const keyId = apiKeyId ?? "";

  // INSERT ... ON DUPLICATE KEY UPDATE：原子自增，多实例安全
  prisma
    .$executeRaw`
      INSERT INTO usage_stats (id, app_id, api_key_id, bucket, method, status_class, count)
      VALUES (${nanoid()}, ${appId}, ${keyId}, ${bucket}, ${method}, ${statusClass}, 1)
      ON DUPLICATE KEY UPDATE count = count + 1
    `
    .catch((e) => logger.warn("记录用量失败", e));
}
