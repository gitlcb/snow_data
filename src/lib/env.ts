import { z } from "zod";

const PLACEHOLDERS = new Set([
  "change-me-to-a-random-string-at-least-32-chars",
  "change-me-in-production-please-use-32-chars-min",
  "dev-secret-change-me-in-production-please-32chars",
  "snow-admin-dev-secret-key-change-in-prod-32chars",
]);

const schema = z.object({
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL 未设置")
    .refine((v) => v.startsWith("mysql://"), "DATABASE_URL 必须是 mysql:// 连接串"),
  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET 至少 32 个字符")
    .refine((v) => !PLACEHOLDERS.has(v), "JWT_SECRET 不能使用占位示例值，请用 openssl rand -hex 32 生成"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

function load() {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `  - ${i.message}`).join("\n");
    throw new Error(`环境变量校验失败：\n${msg}`);
  }
  return parsed.data;
}

export const env = load();
