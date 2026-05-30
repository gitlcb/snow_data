const PLACEHOLDERS = new Set([
  "change-me-to-a-random-string-at-least-32-chars",
  "change-me-in-production-please-use-32-chars-min",
  "dev-secret-change-me-in-production-please-32chars",
  "snow-admin-dev-secret-key-change-in-prod-32chars",
]);

export const COOKIE_NAME = "snow_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 天

let cached: Uint8Array | null = null;

/** 返回编码后的 JWT 签名密钥；缺失/过短/占位值一律抛错（fail-fast）。 */
export function getJwtSecret(): Uint8Array {
  if (cached) return cached;
  const raw = process.env.JWT_SECRET;
  if (!raw || raw.length < 32 || PLACEHOLDERS.has(raw)) {
    throw new Error(
      "JWT_SECRET 必须设置且至少 32 字符、非占位值（用 openssl rand -hex 32 生成）",
    );
  }
  cached = new TextEncoder().encode(raw);
  return cached;
}
