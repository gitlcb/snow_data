import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveV1Auth } from "../_lib/auth-context";
import { ok, fail, tooMany } from "@/lib/api-response";
import { parseQueryParams, queryRecords } from "@/lib/record-query";
import { withCors } from "../_lib/cors";
import {
  collectionSchema,
  jsonObjectSchema,
  bodyTooLarge,
  parseFields,
} from "../_lib/validation";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { recordUsage } from "@/lib/usage";
import { nanoid } from "nanoid";
import type { V1Context } from "../_lib/auth-context";

const MAX_BATCH = 100;

interface RouteCtx {
  params: Promise<{ collection: string }>;
}

// 限流键：App Key 用 keyId，终端用户用 ownerId
function rlKey(ctx: V1Context): string {
  return ctx.apiKeyId ? `v1:${ctx.apiKeyId}` : `v1:eu:${ctx.ownerId}`;
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

// 字段投影：只保留 data 中指定的键
function projectData(data: unknown, fields: string[] | null): unknown {
  if (!fields || data === null || typeof data !== "object" || Array.isArray(data)) {
    return data;
  }
  const src = data as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    if (f in src) out[f] = src[f];
  }
  return out;
}

export async function GET(req: NextRequest, ctx: RouteCtx) {
  const auth = await resolveV1Auth(req.headers.get("authorization"));
  if (!auth) return withCors(fail("无效的 API Key 或令牌", 401), req);

  let res: Response;
  try {
    const rl = rateLimit(rlKey(auth), 120, 60_000);
    if (!rl.ok) {
      res = withCors(tooMany(rl.retryAfter), req);
    } else {
      const { collection: rawCollection } = await ctx.params;
      const collection = collectionSchema.safeParse(rawCollection);
      if (!collection.success) {
        res = withCors(fail("非法的集合名", 400), req);
      } else {
        const url = new URL(req.url);
        const qp = parseQueryParams(url.searchParams);
        const fields = parseFields(url.searchParams.get("fields"));
        const { rows, total } = await queryRecords(
          auth.appId,
          collection.data,
          qp,
          auth.ownerId,
        );
        const out = rows.map((r) => {
          const f = formatRow(r);
          return { ...f, data: projectData(f.data, fields) };
        });
        res = withCors(ok(out, { total, page: qp.page, limit: qp.limit }), req);
      }
    }
  } catch (error) {
    logger.error("[v1] GET list failed", error);
    res = withCors(fail("查询失败，请稍后重试", 500), req);
  }
  recordUsage(auth.appId, auth.apiKeyId, "GET", res.status);
  return res;
}

export async function POST(req: NextRequest, ctx: RouteCtx) {
  const auth = await resolveV1Auth(req.headers.get("authorization"));
  if (!auth) return withCors(fail("无效的 API Key 或令牌", 401), req);

  let res: Response;
  try {
    if (auth.scope !== "readwrite") {
      res = withCors(fail("该 Key 为只读，无写入权限", 403), req);
    } else {
      const rl = rateLimit(rlKey(auth), 120, 60_000);
      if (!rl.ok) {
        res = withCors(tooMany(rl.retryAfter), req);
      } else {
        const { collection: rawCollection } = await ctx.params;
        const collection = collectionSchema.safeParse(rawCollection);
        if (!collection.success) {
          res = withCors(fail("非法的集合名", 400), req);
        } else if (bodyTooLarge(req)) {
          res = withCors(fail("请求体过大", 413), req);
        } else {
          let body: unknown;
          try {
            body = await req.json();
          } catch {
            body = undefined;
          }
          if (Array.isArray(body)) {
            // 批量写入
            if (body.length === 0 || body.length > MAX_BATCH) {
              res = withCors(
                fail(`批量写入需 1-${MAX_BATCH} 条`, 400),
                req,
              );
            } else if (
              !body.every((item) => jsonObjectSchema.safeParse(item).success)
            ) {
              res = withCors(fail("批量项必须都是 JSON 对象", 400), req);
            } else {
              await prisma.record.createMany({
                data: body.map((item) => ({
                  id: nanoid(),
                  appId: auth.appId,
                  collection: collection.data,
                  ownerId: auth.ownerId,
                  data: item as object,
                })),
              });
              res = withCors(
                ok({ created: body.length }, undefined, 201),
                req,
              );
            }
          } else {
            const parsed = jsonObjectSchema.safeParse(body);
            if (!parsed.success) {
              res = withCors(fail("请求体必须是 JSON 对象", 400), req);
            } else {
              const created = await prisma.record.create({
                data: {
                  id: nanoid(),
                  appId: auth.appId,
                  collection: collection.data,
                  ownerId: auth.ownerId,
                  data: parsed.data as object,
                },
              });
              res = withCors(
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
                req,
              );
            }
          }
        }
      }
    }
  } catch (error) {
    logger.error("[v1] POST create failed", error);
    res = withCors(fail("写入失败，请稍后重试", 500), req);
  }
  recordUsage(auth.appId, auth.apiKeyId, "POST", res.status);
  return res;
}

export async function OPTIONS(req: NextRequest) {
  return withCors(new Response(null, { status: 204 }), req);
}
