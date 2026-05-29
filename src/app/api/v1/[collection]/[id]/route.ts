import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveApiKey } from "@/lib/api-key";
import { ok, fail } from "@/lib/api-response";
import { withCors } from "../../_lib/cors";

interface RouteCtx {
  params: Promise<{ collection: string; id: string }>;
}

function formatRecord(record: {
  id: string;
  data: unknown;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: record.id,
    data: record.data,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export async function GET(req: NextRequest, ctx: RouteCtx) {
  try {
    const resolved = await resolveApiKey(req.headers.get("authorization"));
    if (!resolved) return withCors(fail("无效的 API Key", 401));
    const { appId } = resolved;

    const { collection, id } = await ctx.params;
    const record = await prisma.record.findFirst({
      where: { id, appId, collection },
    });
    if (!record) return withCors(fail("记录不存在", 404));

    return withCors(ok(formatRecord(record)));
  } catch (error) {
    console.error("[v1] GET one failed:", error);
    return withCors(fail("查询失败，请稍后重试", 500));
  }
}

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  try {
    const resolved = await resolveApiKey(req.headers.get("authorization"));
    if (!resolved) return withCors(fail("无效的 API Key", 401));
    const { appId } = resolved;

    const { collection, id } = await ctx.params;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return withCors(fail("请求体必须是 JSON 对象", 400));
    }
    if (body === null || typeof body !== "object" || Array.isArray(body)) {
      return withCors(fail("请求体必须是 JSON 对象", 400));
    }

    const record = await prisma.record.findFirst({
      where: { id, appId, collection },
    });
    if (!record) return withCors(fail("记录不存在", 404));

    // 浅合并：保留原有字段，用新字段覆盖
    const merged = {
      ...((record.data as object) ?? {}),
      ...(body as object),
    };

    const updated = await prisma.record.update({
      where: { id: record.id },
      data: { data: merged },
    });

    return withCors(ok(formatRecord(updated)));
  } catch (error) {
    console.error("[v1] PATCH failed:", error);
    return withCors(fail("更新失败，请稍后重试", 500));
  }
}

export async function DELETE(req: NextRequest, ctx: RouteCtx) {
  try {
    const resolved = await resolveApiKey(req.headers.get("authorization"));
    if (!resolved) return withCors(fail("无效的 API Key", 401));
    const { appId } = resolved;

    const { collection, id } = await ctx.params;
    const record = await prisma.record.findFirst({
      where: { id, appId, collection },
    });
    if (!record) return withCors(fail("记录不存在", 404));

    await prisma.record.delete({ where: { id: record.id } });

    return withCors(ok({ ok: true }));
  } catch (error) {
    console.error("[v1] DELETE failed:", error);
    return withCors(fail("删除失败，请稍后重试", 500));
  }
}

export async function OPTIONS() {
  return withCors(new Response(null, { status: 204 }));
}
