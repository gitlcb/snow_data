import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPassword, createSession } from "@/lib/auth";
import { ok, fail, tooMany } from "@/lib/api-response";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

const schema = z.object({
  email: z.string().email("邮箱格式不正确"),
  password: z.string().min(6, "密码至少 6 位"),
});

export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req);
    const rl = rateLimit(`login:${ip}`, 10, 60_000);
    if (!rl.ok) return tooMany(rl.retryAfter);

    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "参数不合法", 400);
    }
    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    // 不区分是邮箱还是密码错误，避免泄露账号是否存在
    if (!user || !user.password || !(await verifyPassword(password, user.password))) {
      return fail("邮箱或密码错误", 401);
    }
    if (user.disabled) return fail("账号已被禁用，请联系管理员", 403);

    await createSession({
      userId: user.id,
      email: user.email,
      role: user.role,
    });
    return ok({ id: user.id, email: user.email });
  } catch (error) {
    logger.error("login failed", error);
    return fail("登录失败，请稍后重试", 500);
  }
}
