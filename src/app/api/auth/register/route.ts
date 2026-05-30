import { NextRequest } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import { hashPassword, createSession } from "@/lib/auth";
import { ok, fail, tooMany } from "@/lib/api-response";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { getSystemConfig } from "@/lib/system-config";
import { logger } from "@/lib/logger";

const schema = z.object({
  email: z.string().email("邮箱格式不正确"),
  password: z.string().min(8, "密码至少 8 位").max(128, "密码过长"),
  name: z.string().trim().min(1).max(64).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req);
    const rl = rateLimit(`register:${ip}`, 5, 60_000);
    if (!rl.ok) return tooMany(rl.retryAfter);

    // 注册开关：关闭时拒绝新注册
    const cfg = await getSystemConfig();
    if (!cfg.registrationOpen) return fail("注册已关闭", 403);

    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "参数不合法", 400);
    }
    const { email, password, name } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return fail("该邮箱已注册", 409);

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: { id: nanoid(), email, password: passwordHash, name },
      select: { id: true, email: true, role: true },
    });

    await createSession({
      userId: user.id,
      email: user.email,
      role: user.role,
    });
    return ok({ id: user.id, email: user.email });
  } catch (error) {
    logger.error("register failed", error);
    return fail("注册失败，请稍后重试", 500);
  }
}
