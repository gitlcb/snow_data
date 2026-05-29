import { NextRequest } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api-response";
import { requireUser } from "@/lib/require-user";

const createSchema = z.object({
  name: z.string().trim().min(1, "应用名称不能为空"),
  description: z.string().trim().optional(),
});

export async function GET() {
  try {
    const user = await requireUser();
    if (!user) return fail("未登录", 401);

    const apps = await prisma.app.findMany({
      where: { userId: user.userId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { records: true, apiKeys: true } } },
    });

    return ok(apps);
  } catch (error) {
    console.error("列出应用失败:", error);
    return fail("获取应用列表失败", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    if (!user) return fail("未登录", 401);

    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "参数错误", 400);
    }

    const app = await prisma.app.create({
      data: {
        id: nanoid(),
        userId: user.userId,
        name: parsed.data.name,
        description: parsed.data.description,
      },
    });

    return ok(app, undefined, 201);
  } catch (error) {
    console.error("创建应用失败:", error);
    return fail("创建应用失败", 500);
  }
}
