import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveApiKey } from "@/lib/api-key";
import { verifyPassword } from "@/lib/auth";
import { signEndUserToken } from "@/lib/end-user-auth";
import { ok, fail, tooMany } from "@/lib/api-response";
import { withCors } from "../../_lib/cors";
import { endUserCredsSchema, bodyTooLarge } from "../../_lib/validation";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

// 终端用户登录：用 App Key 标识所属 App，验密码后签发终端用户 JWT
export async function POST(req: NextRequest) {
  try {
    const resolved = await resolveApiKey(req.headers.get("authorization"));
    if (!resolved) return withCors(fail("无效的 API Key", 401), req);
    const { appId } = resolved;

    const rl = rateLimit(`eu-login:${clientIp(req)}:${appId}`, 10, 60_000);
    if (!rl.ok) return withCors(tooMany(rl.retryAfter), req);

    if (bodyTooLarge(req)) return withCors(fail("请求体过大", 413), req);

    const body = await req.json().catch(() => null);
    const parsed = endUserCredsSchema.safeParse(body);
    if (!parsed.success) {
      return withCors(
        fail(parsed.error.issues[0]?.message ?? "参数不合法", 400),
        req,
      );
    }
    const { email, password } = parsed.data;

    const endUser = await prisma.endUser.findUnique({
      where: { appId_email: { appId, email } },
    });
    if (!endUser || !(await verifyPassword(password, endUser.password))) {
      return withCors(fail("邮箱或密码错误", 401), req);
    }

    const token = await signEndUserToken({
      endUserId: endUser.id,
      appId,
      email: endUser.email,
    });

    return withCors(ok({ id: endUser.id, email: endUser.email, token }), req);
  } catch (error) {
    logger.error("[v1] 终端用户登录失败", error);
    return withCors(fail("登录失败，请稍后重试", 500), req);
  }
}

export async function OPTIONS(req: NextRequest) {
  return withCors(new Response(null, { status: 204 }), req);
}
