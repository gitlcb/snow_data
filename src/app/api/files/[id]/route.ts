import { NextRequest } from "next/server";
import { readFile } from "fs/promises";
import { prisma } from "@/lib/prisma";
import { absoluteStoragePath } from "@/lib/file-storage";
import { resolveApiKey } from "@/lib/api-key";
import { getSession } from "@/lib/auth";
import { assertAppOwner } from "@/lib/require-user";
import { logger } from "@/lib/logger";

/** 校验调用方是否有权读取该 app 的文件：API Key 命中同 app，或登录用户拥有该 app。 */
async function canAccess(req: NextRequest, appId: string): Promise<boolean> {
  const resolved = await resolveApiKey(req.headers.get("authorization"));
  if (resolved && resolved.appId === appId) return true;

  const session = await getSession();
  if (session && (await assertAppOwner(appId, session.userId))) return true;

  return false;
}

// 仅这些位图类型允许内联展示（供后台缩略图）；其余一律强制下载，杜绝 HTML/SVG 内联 XSS
const INLINE_SAFE_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const asset = await prisma.fileAsset.findUnique({ where: { id } });
    if (!asset) return new Response("Not Found", { status: 404 });

    if (!(await canAccess(req, asset.appId))) {
      return new Response("Forbidden", { status: 403 });
    }

    let buffer: Buffer;
    try {
      buffer = await readFile(absoluteStoragePath(asset.storagePath));
    } catch {
      // DB 有记录但磁盘文件丢失
      return new Response("Not Found", { status: 404 });
    }

    const body = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    ) as ArrayBuffer;

    const inline = INLINE_SAFE_MIME.has(asset.mimeType);
    const disposition = inline ? "inline" : "attachment";

    return new Response(body, {
      headers: {
        "Content-Type": asset.mimeType || "application/octet-stream",
        "Content-Length": String(buffer.length),
        // 非位图强制下载 + 全程禁止 MIME 嗅探，杜绝上传 HTML/SVG 触发的存储型 XSS
        "Content-Disposition": `${disposition}; filename="${encodeURIComponent(asset.filename)}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    logger.error("读取文件失败", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
