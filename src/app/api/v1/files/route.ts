import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api-response";
import { resolveApiKey } from "@/lib/api-key";
import { storeUpload } from "@/lib/file-storage";

// 内联 CORS，避免与其他 v1 模块的共享文件产生依赖竞态
const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
};

function cors<T extends Response>(res: T): T {
  for (const [k, v] of Object.entries(CORS)) res.headers.set(k, v);
  return res;
}

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }));
}

export async function POST(req: NextRequest) {
  try {
    const resolved = await resolveApiKey(req.headers.get("authorization"));
    if (!resolved) return cors(fail("无效的 API Key", 401));

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return cors(fail("请求需为 multipart/form-data", 400));
    }

    const file = form.get("file");
    if (!(file instanceof File)) {
      return cors(fail("缺少文件字段 file", 400));
    }

    const { storagePath, filename } = await storeUpload(resolved.appId, file);

    const asset = await prisma.fileAsset.create({
      data: {
        id: nanoid(),
        appId: resolved.appId,
        filename,
        storagePath,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
      },
    });

    return cors(
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
    );
  } catch (error) {
    console.error("v1 文件上传失败:", error);
    return cors(fail("文件上传失败", 500));
  }
}
