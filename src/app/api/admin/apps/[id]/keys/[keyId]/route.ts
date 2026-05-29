import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api-response";
import { requireUser, assertAppOwner } from "@/lib/require-user";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; keyId: string }> },
) {
  try {
    const user = await requireUser();
    if (!user) return fail("未登录", 401);

    const { id, keyId } = await params;
    if (!(await assertAppOwner(id, user.userId))) return fail("无权访问", 403);

    // 校验该 key 确实属于该 app
    const key = await prisma.apiKey.findFirst({
      where: { id: keyId, appId: id },
      select: { id: true },
    });
    if (!key) return fail("API Key 不存在", 404);

    await prisma.apiKey.delete({ where: { id: keyId } });

    return ok({ ok: true });
  } catch (error) {
    console.error("删除 API Key 失败:", error);
    return fail("删除 API Key 失败", 500);
  }
}
