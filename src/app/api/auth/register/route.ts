import { NextRequest } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import { hashPassword, createSession } from "@/lib/auth";
import { ok, fail } from "@/lib/api-response";

const schema = z.object({
  email: z.string().email("邮箱格式不正确"),
  password: z.string().min(6, "密码至少 6 位"),
  name: z.string().trim().min(1).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "参数不合法", 422);
    }
    const { email, password, name } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return fail("该邮箱已注册", 409);

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: { id: nanoid(), email, password: passwordHash, name },
      select: { id: true, email: true },
    });

    await createSession({ userId: user.id, email: user.email });
    return ok({ id: user.id, email: user.email });
  } catch (error) {
    console.error("register failed:", error);
    return fail("注册失败，请稍后重试", 500);
  }
}
