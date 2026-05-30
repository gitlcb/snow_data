import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api-response";
import { requireUser, assertAppOwner } from "@/lib/require-user";
import { logger } from "@/lib/logger";

const updateSchema = z.object({
  data: z
    .record(z.unknown())
    .refine((v) => v !== null && !Array.isArray(v), {
      message: "data 必须是对象",
    }),
});

// 校验记录确实属于该 app，避免越权改到其它 app 的记录
async function recordBelongsToApp(
  recordId: string,
  appId: string,
): Promise<boolean> {
  const rec = await prisma.record.findFirst({
    where: { id: recordId, appId },
    select: { id: true },
  });
  return !!rec;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; recordId: string }> },
) {
  try {
    const user = await requireUser();
    if (!user) return fail("未登录", 401);

    const { id, recordId } = await params;
    if (!(await assertAppOwner(id, user.userId))) return fail("无权访问", 403);
    if (!(await recordBelongsToApp(recordId, id)))
      return fail("记录不存在", 404);

    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "参数错误", 400);
    }

    const record = await prisma.record.update({
      where: { id: recordId },
      data: { data: parsed.data.data as Prisma.InputJsonValue },
      select: { id: true, data: true, createdAt: true, updatedAt: true },
    });

    return ok(record);
  } catch (error) {
    logger.error("更新记录失败", error);
    return fail("更新记录失败", 500);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; recordId: string }> },
) {
  try {
    const user = await requireUser();
    if (!user) return fail("未登录", 401);

    const { id, recordId } = await params;
    if (!(await assertAppOwner(id, user.userId))) return fail("无权访问", 403);
    if (!(await recordBelongsToApp(recordId, id)))
      return fail("记录不存在", 404);

    await prisma.record.delete({ where: { id: recordId } });

    return ok({ ok: true });
  } catch (error) {
    logger.error("删除记录失败", error);
    return fail("删除记录失败", 500);
  }
}
