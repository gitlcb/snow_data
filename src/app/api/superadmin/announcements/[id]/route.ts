import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api-response";
import { requireSuperadmin } from "@/lib/require-user";
import { logger } from "@/lib/logger";

const patchSchema = z.object({
  title: z.string().trim().min(1, "标题不能为空").max(200, "标题过长").optional(),
  body: z.string().trim().min(1, "正文不能为空").optional(),
  type: z.enum(["info", "warning", "danger"]).optional(),
  published: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireSuperadmin();
    if (!admin) return fail("需要超级管理员权限", 403);

    const { id } = await params;
    const body = await req.json().catch(() => null);
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "参数错误", 400);
    }

    const exists = await prisma.announcement.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) return fail("公告不存在", 404);

    const updated = await prisma.announcement.update({
      where: { id },
      data: {
        ...(parsed.data.title !== undefined && { title: parsed.data.title }),
        ...(parsed.data.body !== undefined && { body: parsed.data.body }),
        ...(parsed.data.type !== undefined && { type: parsed.data.type }),
        ...(parsed.data.published !== undefined && {
          published: parsed.data.published,
        }),
      },
    });

    return ok(updated);
  } catch (error) {
    logger.error("更新公告失败", error);
    return fail("更新公告失败", 500);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireSuperadmin();
    if (!admin) return fail("需要超级管理员权限", 403);

    const { id } = await params;

    const exists = await prisma.announcement.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) return fail("公告不存在", 404);

    await prisma.announcement.delete({ where: { id } });

    return ok({ ok: true });
  } catch (error) {
    logger.error("删除公告失败", error);
    return fail("删除公告失败", 500);
  }
}
