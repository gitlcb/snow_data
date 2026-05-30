import { z } from "zod";
import { getSystemConfig } from "@/lib/system-config";

export const MAX_BODY_BYTES = 1024 * 1024; // 1MB JSON 上限
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB 文件上限（静态兜底）

export const ALLOWED_UPLOAD_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "application/pdf",
  "text/plain",
  "application/json",
  "text/csv",
  "application/zip",
  "application/octet-stream",
]);

export interface UploadCheckResult {
  ok: boolean;
  status?: 413 | 415;
  error?: string;
}

/**
 * 按超管配置的系统级限制校验上传文件。
 * uploadAllowedMime 为空串表示不限制类型；非空为逗号分隔的允许 MIME 列表。
 */
export async function checkUpload(
  size: number,
  mime: string,
): Promise<UploadCheckResult> {
  const cfg = await getSystemConfig();
  if (size > cfg.uploadMaxBytes) {
    const mb = (cfg.uploadMaxBytes / (1024 * 1024)).toFixed(1);
    return { ok: false, status: 413, error: `文件过大（上限 ${mb}MB）` };
  }
  const allowed = cfg.uploadAllowedMime
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (allowed.length > 0 && !allowed.includes(mime)) {
    return { ok: false, status: 415, error: "不支持的文件类型" };
  }
  return { ok: true };
}

export const collectionSchema = z
  .string()
  .trim()
  .min(1, "集合名称不能为空")
  .max(64, "集合名称过长")
  .regex(/^[a-zA-Z0-9_-]+$/, "集合名只能含字母、数字、下划线、连字符");

export const recordIdSchema = z.string().trim().min(1).max(64);

// JSON 字段路径白名单（与 record-query 的 FIELD_RE 一致），用于聚合/投影
const FIELD_RE = /^[a-zA-Z0-9_.]+$/;
export function isValidField(field: string): boolean {
  return field.length > 0 && field.length <= 128 && FIELD_RE.test(field);
}

/** 解析 ?fields=a,b,c 为合法字段数组；非法项丢弃；空则返回 null（不投影）。 */
export function parseFields(raw: string | null): string[] | null {
  if (!raw) return null;
  const fields = raw
    .split(",")
    .map((f) => f.trim())
    .filter((f) => isValidField(f));
  return fields.length > 0 ? fields : null;
}

export const jsonObjectSchema = z
  .record(z.unknown())
  .refine((v) => v !== null && !Array.isArray(v), "必须是 JSON 对象");

// 终端用户注册/登录凭证（与 admin 一致：密码至少 8 位）
export const endUserCredsSchema = z.object({
  email: z.string().trim().email("邮箱格式不正确").max(254),
  password: z.string().min(8, "密码至少 8 位").max(128, "密码过长"),
});

/** 校验请求体大小（基于 Content-Length），超限返回 false。 */
export function bodyTooLarge(req: Request, max = MAX_BODY_BYTES): boolean {
  const len = req.headers.get("content-length");
  if (!len) return false;
  const n = Number(len);
  return Number.isFinite(n) && n > max;
}
