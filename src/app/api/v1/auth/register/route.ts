import { NextRequest } from "next/server";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import { resolveApiKey } from "@/lib/api-key";
import { hashPassword } from "@/lib/auth";
import { signEndUserToken } from "@/lib/end-user-auth";
import { ok, fail, tooMany } from "@/lib/api-response";
import { withCors } from "../../_lib/cors";
import { endUserCredsSchema, bodyTooLarge } from "../../_lib/validation";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

// 终端用户注册：用 App Key 标识所属 App，body 含 email/password
export async function POST(req: NextRequest) {
  try {
    const resolved = await resolveApiKey(req.headers.get("authorization"));
    if (!resolved) return withCors(fail("无效的 API Key", 401), req);
    const { appId } = resolved;

    const rl = rateLimit(`eu-register:${clientIp(req)}:${appId}`, 5, 60_000);
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

    const existing = await prisma.endUser.findUnique({
      where: { appId_email: { appId, email } },
      select: { id: true },
    });
    if (existing) return withCors(fail("该邮箱已注册", 409), req);

    const endUser = await prisma.endUser.create({
      data: {
        id: nanoid(),
        appId,
        email,
        password: await hashPassword(password),
      },
      select: { id: true, email: true },
    });

    const token = await signEndUserToken({
      endUserId: endUser.id,
      appId,
      email: endUser.email,
    });

    return withCors(
      ok({ id: endUser.id, email: endUser.email, token }, undefined, 201),
      req,
    );
  } catch (error) {
    logger.error("[v1] 终端用户注册失败", error);
    return withCors(fail("注册失败，请稍后重试", 500), req);
  }
}

export async function OPTIONS(req: NextRequest) {
  return withCors(new Response(null, { status: 204 }), req);
}
