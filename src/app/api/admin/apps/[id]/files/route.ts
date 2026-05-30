import { NextRequest } from "next/server";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api-response";
import { requireUser, assertAppOwner } from "@/lib/require-user";
import { storeUpload } from "@/lib/file-storage";
import { checkUpload } from "@/app/api/v1/_lib/validation";
import { logger } from "@/lib/logger";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    if (!user) return fail("未登录", 401);

    const { id: appId } = await params;
    const owned = await assertAppOwner(appId, user.userId);
    if (!owned) return fail("无权访问该应用", 403);

    const sp = req.nextUrl.searchParams;
    const page = Math.max(1, Number(sp.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, Number(sp.get("limit")) || 50));

    const [total, files] = await Promise.all([
      prisma.fileAsset.count({ where: { appId } }),
      prisma.fileAsset.findMany({
        where: { appId },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const data = files.map((f) => ({
      id: f.id,
      filename: f.filename,
      mimeType: f.mimeType,
      size: f.size,
      createdAt: f.createdAt,
      url: `/api/files/${f.id}`,
    }));

    return ok(data, { total, page, limit });
  } catch (error) {
    logger.error("列出文件失败", error);
    return fail("获取文件列表失败", 500);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    if (!user) return fail("未登录", 401);

    const { id: appId } = await params;
    const owned = await assertAppOwner(appId, user.userId);
    if (!owned) return fail("无权访问该应用", 403);

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return fail("请求需为 multipart/form-data", 400);
    }

    const file = form.get("file");
    if (!(file instanceof File)) {
      return fail("缺少文件字段 file", 400);
    }
    const mime = file.type || "application/octet-stream";
    const check = await checkUpload(file.size, mime);
    if (!check.ok) {
      return fail(check.error!, check.status!);
    }

    const { storagePath, filename } = await storeUpload(appId, file);

    const asset = await prisma.fileAsset.create({
      data: {
        id: nanoid(),
        appId,
        filename,
        storagePath,
        mimeType: mime,
        size: file.size,
      },
    });

    return ok(
      {
        id: asset.id,
        filename: asset.filename,
        mimeType: asset.mimeType,
        size: asset.size,
        createdAt: asset.createdAt,
        url: `/api/files/${asset.id}`,
      },
      undefined,
      201,
    );
  } catch (error) {
    logger.error("上传文件失败", error);
    return fail("文件上传失败", 500);
  }
}
