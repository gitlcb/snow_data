// 允许跨域调用 demo API 的源；默认 * 兼容公开 demo，可用 CORS_ALLOW_ORIGINS 收敛
const ALLOW = (process.env.CORS_ALLOW_ORIGINS ?? "*")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const BASE_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
};

function resolveOrigin(reqOrigin: string | null): string | null {
  if (ALLOW.includes("*")) return "*";
  if (reqOrigin && ALLOW.includes(reqOrigin)) return reqOrigin;
  return null;
}

/** 给响应追加 CORS 头。传入请求以按 allowlist 反射 Origin。 */
export function withCors(res: Response, req?: Request): Response {
  for (const [k, v] of Object.entries(BASE_HEADERS)) res.headers.set(k, v);
  const origin = resolveOrigin(req?.headers.get("origin") ?? null);
  if (origin) {
    res.headers.set("Access-Control-Allow-Origin", origin);
    if (origin !== "*") res.headers.set("Vary", "Origin");
  }
  return res;
}
