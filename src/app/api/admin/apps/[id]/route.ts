import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api-response";
import { requireUser, assertAppOwner } from "@/lib/require-user";
import { logger } from "@/lib/logger";

const updateSchema = z
  .object({
    name: z.string().trim().min(1, "应用名称不能为空").optional(),
    description: z.string().trim().optional(),
  })
  .refine((v) => v.name !== undefined || v.description !== undefined, {
    message: "没有需要更新的字段",
  });

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    if (!user) return fail("未登录", 401);

    const { id } = await params;
    if (!(await assertAppOwner(id, user.userId))) return fail("无权访问", 403);

    const app = await prisma.app.findUnique({
      where: { id },
      include: { _count: { select: { records: true, apiKeys: true } } },
    });
    if (!app) return fail("应用不存在", 404);

    return ok(app);
  } catch (error) {
    logger.error("获取应用详情失败", error);
    return fail("获取应用详情失败", 500);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    if (!user) return fail("未登录", 401);

    const { id } = await params;
    if (!(await assertAppOwner(id, user.userId))) return fail("无权访问", 403);

    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "参数错误", 400);
    }

    const app = await prisma.app.update({
      where: { id },
      data: parsed.data,
      include: { _count: { select: { records: true, apiKeys: true } } },
    });

    return ok(app);
  } catch (error) {
    logger.error("更新应用失败", error);
    return fail("更新应用失败", 500);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    if (!user) return fail("未登录", 401);

    const { id } = await params;
    if (!(await assertAppOwner(id, user.userId))) return fail("无权访问", 403);

    await prisma.app.delete({ where: { id } });

    return ok({ ok: true });
  } catch (error) {
    logger.error("删除应用失败", error);
    return fail("删除应用失败", 500);
  }
}
