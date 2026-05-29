import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPassword, createSession } from "@/lib/auth";
import { ok, fail } from "@/lib/api-response";

const schema = z.object({
  email: z.string().email("邮箱格式不正确"),
  password: z.string().min(6, "密码至少 6 位"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "参数不合法", 422);
    }
    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    // 不区分是邮箱还是密码错误，避免泄露账号是否存在
    if (!user || !(await verifyPassword(password, user.password))) {
      return fail("邮箱或密码错误", 401);
    }

    await createSession({ userId: user.id, email: user.email });
    return ok({ id: user.id, email: user.email });
  } catch (error) {
    console.error("login failed:", error);
    return fail("登录失败，请稍后重试", 500);
  }
}
