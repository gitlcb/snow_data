import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword, createSession } from "@/lib/auth";
import { ok, fail, tooMany } from "@/lib/api-response";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

// 首次部署引导：数据库无超级管理员时，让运维在网页上创建第一个超管账号。
// 与 /register 分离：本路由只受「超管数 === 0」约束，不受 registrationOpen 影响，
// 且一旦已存在超管即拒绝（防止被用来增设超管）。
//
// 并发安全：用固定主键 id 写入「引导超管」，使「至多一个引导超管」成为数据库硬约束——
// 并发下第二次插入会撞主键（P2002）而被拒，不依赖事务隔离级别或非加锁的 count 快照。
const SETUP_ADMIN_ID = "superadmin_root";

const schema = z
  .object({
    username: z.string().trim().min(1, "请输入用户名").max(64, "用户名过长"),
    password: z.string().min(8, "密码至少 8 位").max(128, "密码过长"),
    confirm: z.string().min(1, "请再次输入密码"),
  })
  .refine((d) => d.password === d.confirm, {
    message: "两次输入的密码不一致",
    path: ["confirm"],
  });

async function superadminCount(): Promise<number> {
  return prisma.user.count({ where: { role: "superadmin" } });
}

// GET：供 /setup 页面自检是否仍需初始化
export async function GET() {
  try {
    return ok({ needsSetup: (await superadminCount()) === 0 });
  } catch (error) {
    logger.error("setup status failed", error);
    return fail("读取初始化状态失败", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req);
    const rl = rateLimit(`setup:${ip}`, 5, 60_000);
    if (!rl.ok) return tooMany(rl.retryAfter);

    // 顺序场景的快速路径；并发安全最终由固定主键兜底
    if ((await superadminCount()) > 0) return fail("系统已初始化", 403);

    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "参数不合法", 400);
    }
    const { username, password } = parsed.data;
    const passwordHash = await hashPassword(password);

    // 用户名直接存入 email 列：登录用 findUnique({where:{email}}) 按该列匹配
    const user = await prisma.user.create({
      data: {
        id: SETUP_ADMIN_ID,
        email: username,
        password: passwordHash,
        name: username,
        role: "superadmin",
      },
      select: { id: true, email: true, role: true },
    });

    // 创建即登录，引导用户直接进入后台
    await createSession({
      userId: user.id,
      email: user.email,
      role: user.role,
    });
    return ok({ id: user.id, email: user.email }, undefined, 201);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      // 撞固定主键=并发下已被他人初始化；撞 email 唯一键=该用户名已被占用
      const initialized = (await superadminCount()) > 0;
      return initialized ? fail("系统已初始化", 403) : fail("该账号已存在", 409);
    }
    logger.error("setup failed", error);
    return fail("初始化失败，请稍后重试", 500);
  }
}
