import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import { ok, fail, tooMany } from "@/lib/api-response";
import { resolveApiKey, canWrite } from "@/lib/api-key";
import { storeUpload } from "@/lib/file-storage";
import { checkUpload } from "../_lib/validation";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { withCors } from "../_lib/cors";

export async function OPTIONS(req: NextRequest) {
  return withCors(new NextResponse(null, { status: 204 }), req);
}

export async function POST(req: NextRequest) {
  try {
    const resolved = await resolveApiKey(req.headers.get("authorization"));
    if (!resolved) return withCors(fail("无效的 API Key", 401), req);
    const { appId, apiKeyId } = resolved;

    if (!canWrite(resolved)) return withCors(fail("该 Key 为只读，无写入权限", 403), req);

    const rl = rateLimit(`v1upload:${apiKeyId}`, 30, 60_000);
    if (!rl.ok) return withCors(tooMany(rl.retryAfter), req);

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return withCors(fail("请求需为 multipart/form-data", 400), req);
    }

    const file = form.get("file");
    if (!(file instanceof File)) {
      return withCors(fail("缺少文件字段 file", 400), req);
    }
    const mime = file.type || "application/octet-stream";
    const check = await checkUpload(file.size, mime);
    if (!check.ok) {
      return withCors(fail(check.error!, check.status!), req);
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

    return withCors(
      ok(
        {
          id: asset.id,
          filename: asset.filename,
          url: `/api/files/${asset.id}`,
          size: asset.size,
          mimeType: asset.mimeType,
        },
        undefined,
        201,
      ),
      req,
    );
  } catch (error) {
    logger.error("v1 文件上传失败", error);
    return withCors(fail("文件上传失败", 500), req);
  }
}
