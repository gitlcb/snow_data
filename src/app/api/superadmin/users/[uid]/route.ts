import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api-response";
import { requireSuperadmin } from "@/lib/require-user";
import { logger } from "@/lib/logger";

const patchSchema = z.object({
  disabled: z.boolean().optional(),
  role: z.enum(["user", "superadmin"]).optional(),
});

// 统计仍有效的超管数量（未禁用），用于防止锁死系统
async function activeSuperadminCount(): Promise<number> {
  return prisma.user.count({ where: { role: "superadmin", disabled: false } });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> },
) {
  try {
    const admin = await requireSuperadmin();
    if (!admin) return fail("需要超级管理员权限", 403);

    const { uid } = await params;
    const body = await req.json().catch(() => null);
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "参数错误", 400);
    }

    const target = await prisma.user.findUnique({
      where: { id: uid },
      select: { id: true, role: true, disabled: true },
    });
    if (!target) return fail("用户不存在", 404);

    // 不能禁用/降级自己，避免误操作锁死
    if (uid === admin.userId) {
      return fail("不能修改自己的状态或角色", 400);
    }

    // 若本次操作会移除一个有效超管，确保系统至少还留一个
    const willLoseSuperadmin =
      target.role === "superadmin" &&
      !target.disabled &&
      ((parsed.data.disabled === true) || parsed.data.role === "user");
    if (willLoseSuperadmin && (await activeSuperadminCount()) <= 1) {
      return fail("系统必须保留至少一个有效的超级管理员", 400);
    }

    const updated = await prisma.user.update({
      where: { id: uid },
      data: {
        ...(parsed.data.disabled !== undefined && {
          disabled: parsed.data.disabled,
        }),
        ...(parsed.data.role !== undefined && { role: parsed.data.role }),
      },
      select: { id: true, email: true, role: true, disabled: true },
    });

    return ok(updated);
  } catch (error) {
    logger.error("更新平台用户失败", error);
    return fail("更新用户失败", 500);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ uid: string }> },
) {
  try {
    const admin = await requireSuperadmin();
    if (!admin) return fail("需要超级管理员权限", 403);

    const { uid } = await params;
    if (uid === admin.userId) return fail("不能删除自己", 400);

    const target = await prisma.user.findUnique({
      where: { id: uid },
      select: { id: true, role: true, disabled: true },
    });
    if (!target) return fail("用户不存在", 404);

    if (
      target.role === "superadmin" &&
      !target.disabled &&
      (await activeSuperadminCount()) <= 1
    ) {
      return fail("系统必须保留至少一个有效的超级管理员", 400);
    }

    // 级联删除该用户的所有 App（schema onDelete: Cascade 会连带 records/keys/files）
    await prisma.user.delete({ where: { id: uid } });

    return ok({ ok: true });
  } catch (error) {
    logger.error("删除平台用户失败", error);
    return fail("删除用户失败", 500);
  }
}
