import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveV1Auth } from "../../_lib/auth-context";
import type { V1Context } from "../../_lib/auth-context";
import { ok, fail, tooMany } from "@/lib/api-response";
import { withCors } from "../../_lib/cors";
import {
  collectionSchema,
  recordIdSchema,
  jsonObjectSchema,
  bodyTooLarge,
} from "../../_lib/validation";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

interface RouteCtx {
  params: Promise<{ collection: string; id: string }>;
}

// 限流键：App Key 用 keyId，终端用户用 ownerId
function rlKey(ctx: V1Context): string {
  return ctx.apiKeyId ? `v1:${ctx.apiKeyId}` : `v1:eu:${ctx.ownerId}`;
}

// 单记录定位条件：终端用户附加 owner_id 约束，App Key 不限
function recordWhere(
  auth: V1Context,
  id: string,
  collection: string,
): Prisma.RecordWhereInput {
  const where: Prisma.RecordWhereInput = {
    id,
    appId: auth.appId,
    collection,
  };
  if (auth.ownerId) where.ownerId = auth.ownerId;
  return where;
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

interface ParsedParams {
  collection: string;
  id: string;
}

function parseParams(raw: {
  collection: string;
  id: string;
}): ParsedParams | null {
  const collection = collectionSchema.safeParse(raw.collection);
  const id = recordIdSchema.safeParse(raw.id);
  if (!collection.success || !id.success) return null;
  return { collection: collection.data, id: id.data };
}

export async function GET(req: NextRequest, ctx: RouteCtx) {
  try {
    const auth = await resolveV1Auth(req.headers.get("authorization"));
    if (!auth) return withCors(fail("无效的 API Key 或令牌", 401), req);

    const rl = rateLimit(rlKey(auth), 120, 60_000);
    if (!rl.ok) return withCors(tooMany(rl.retryAfter), req);

    const p = parseParams(await ctx.params);
    if (!p) return withCors(fail("非法的参数", 400), req);

    const record = await prisma.record.findFirst({
      where: recordWhere(auth, p.id, p.collection),
    });
    if (!record) return withCors(fail("记录不存在", 404), req);

    return withCors(ok(formatRecord(record)), req);
  } catch (error) {
    logger.error("[v1] GET one failed", error);
    return withCors(fail("查询失败，请稍后重试", 500), req);
  }
}

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  try {
    const auth = await resolveV1Auth(req.headers.get("authorization"));
    if (!auth) return withCors(fail("无效的 API Key 或令牌", 401), req);

    if (auth.scope !== "readwrite")
      return withCors(fail("该 Key 为只读，无写入权限", 403), req);

    const rl = rateLimit(rlKey(auth), 120, 60_000);
    if (!rl.ok) return withCors(tooMany(rl.retryAfter), req);

    const p = parseParams(await ctx.params);
    if (!p) return withCors(fail("非法的参数", 400), req);

    if (bodyTooLarge(req)) return withCors(fail("请求体过大", 413), req);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return withCors(fail("请求体必须是 JSON 对象", 400), req);
    }
    const parsed = jsonObjectSchema.safeParse(body);
    if (!parsed.success) {
      return withCors(fail("请求体必须是 JSON 对象", 400), req);
    }

    const record = await prisma.record.findFirst({
      where: recordWhere(auth, p.id, p.collection),
    });
    if (!record) return withCors(fail("记录不存在", 404), req);

    // 浅合并：保留原有字段，用新字段覆盖；原数据非对象时以空对象兜底
    const base =
      record.data && typeof record.data === "object" && !Array.isArray(record.data)
        ? (record.data as Record<string, unknown>)
        : {};
    const merged = { ...base, ...parsed.data };

    const updated = await prisma.record.update({
      where: { id: record.id },
      data: { data: merged as Prisma.InputJsonValue },
    });

    return withCors(ok(formatRecord(updated)), req);
  } catch (error) {
    logger.error("[v1] PATCH failed", error);
    return withCors(fail("更新失败，请稍后重试", 500), req);
  }
}

export async function DELETE(req: NextRequest, ctx: RouteCtx) {
  try {
    const auth = await resolveV1Auth(req.headers.get("authorization"));
    if (!auth) return withCors(fail("无效的 API Key 或令牌", 401), req);

    if (auth.scope !== "readwrite")
      return withCors(fail("该 Key 为只读，无写入权限", 403), req);

    const rl = rateLimit(rlKey(auth), 120, 60_000);
    if (!rl.ok) return withCors(tooMany(rl.retryAfter), req);

    const p = parseParams(await ctx.params);
    if (!p) return withCors(fail("非法的参数", 400), req);

    const record = await prisma.record.findFirst({
      where: recordWhere(auth, p.id, p.collection),
    });
    if (!record) return withCors(fail("记录不存在", 404), req);

    await prisma.record.delete({ where: { id: record.id } });

    return withCors(ok({ ok: true }), req);
  } catch (error) {
    logger.error("[v1] DELETE failed", error);
    return withCors(fail("删除失败，请稍后重试", 500), req);
  }
}

export async function OPTIONS(req: NextRequest) {
  return withCors(new Response(null, { status: 204 }), req);
}
