import { NextRequest } from "next/server";
import { readFile } from "fs/promises";
import { prisma } from "@/lib/prisma";
import { absoluteStoragePath } from "@/lib/file-storage";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const asset = await prisma.fileAsset.findUnique({ where: { id } });
    if (!asset) {
      return new Response("Not Found", { status: 404 });
    }

    let buffer: Buffer;
    try {
      buffer = await readFile(absoluteStoragePath(asset.storagePath));
    } catch {
      // DB 有记录但磁盘文件丢失
      return new Response("Not Found", { status: 404 });
    }

    // 复制为独立 ArrayBuffer，符合 Response BodyInit 类型
    const body = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    ) as ArrayBuffer;

    return new Response(body, {
      headers: {
        "Content-Type": asset.mimeType || "application/octet-stream",
        "Content-Length": String(buffer.length),
        "Cache-Control": "public, max-age=31536000",
      },
    });
  } catch (error) {
    console.error("读取文件失败:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
