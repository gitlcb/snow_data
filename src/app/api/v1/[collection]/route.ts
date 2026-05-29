import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveApiKey } from "@/lib/api-key";
import { ok, fail } from "@/lib/api-response";
import { parseQueryParams, queryRecords } from "@/lib/record-query";
import { withCors } from "../_lib/cors";
import { nanoid } from "nanoid";

interface RouteCtx {
  params: Promise<{ collection: string }>;
}

// 将内部 RecordRow（raw SQL，snake_case）转成对外格式
function formatRow(row: {
  id: string;
  data: unknown;
  created_at: Date;
  updated_at: Date;
}) {
  return {
    id: row.id,
    data: row.data,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function GET(req: NextRequest, ctx: RouteCtx) {
  try {
    const resolved = await resolveApiKey(req.headers.get("authorization"));
    if (!resolved) return withCors(fail("无效的 API Key", 401));
    const { appId } = resolved;

    const { collection } = await ctx.params;
    const qp = parseQueryParams(new URL(req.url).searchParams);
    const { rows, total } = await queryRecords(appId, collection, qp);

    return withCors(
      ok(rows.map(formatRow), { total, page: qp.page, limit: qp.limit }),
    );
  } catch (error) {
    console.error("[v1] GET list failed:", error);
    return withCors(fail("查询失败，请稍后重试", 500));
  }
}

export async function POST(req: NextRequest, ctx: RouteCtx) {
  try {
    const resolved = await resolveApiKey(req.headers.get("authorization"));
    if (!resolved) return withCors(fail("无效的 API Key", 401));
    const { appId } = resolved;

    const { collection } = await ctx.params;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return withCors(fail("请求体必须是 JSON 对象", 400));
    }
    if (
      body === null ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return withCors(fail("请求体必须是 JSON 对象", 400));
    }

    const created = await prisma.record.create({
      data: {
        id: nanoid(),
        appId,
        collection,
        data: body as object,
      },
    });

    return withCors(
      ok(
        {
          id: created.id,
          data: created.data,
          createdAt: created.createdAt,
          updatedAt: created.updatedAt,
        },
        undefined,
        201,
      ),
    );
  } catch (error) {
    console.error("[v1] POST create failed:", error);
    return withCors(fail("写入失败，请稍后重试", 500));
  }
}

export async function OPTIONS() {
  return withCors(new Response(null, { status: 204 }));
}
