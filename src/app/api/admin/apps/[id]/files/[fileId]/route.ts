import { NextRequest } from "next/server";
import { unlink } from "fs/promises";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api-response";
import { requireUser, assertAppOwner } from "@/lib/require-user";
import { absoluteStoragePath } from "@/lib/file-storage";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> },
) {
  try {
    const user = await requireUser();
    if (!user) return fail("未登录", 401);

    const { id: appId, fileId } = await params;
    const owned = await assertAppOwner(appId, user.userId);
    if (!owned) return fail("无权访问该应用", 403);

    const asset = await prisma.fileAsset.findFirst({
      where: { id: fileId, appId },
    });
    if (!asset) return fail("文件不存在", 404);

    await prisma.fileAsset.delete({ where: { id: asset.id } });

    // 尽量删除磁盘文件，失败忽略不报错
    await unlink(absoluteStoragePath(asset.storagePath)).catch(() => {});

    return ok({ ok: true });
  } catch (error) {
    console.error("删除文件失败:", error);
    return fail("删除文件失败", 500);
  }
}
