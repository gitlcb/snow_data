import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveApiKey, canWrite } from "@/lib/api-key";
import { ok, fail, tooMany } from "@/lib/api-response";
import { withCors } from "../../_lib/cors";
import {
  collectionSchema,
  jsonObjectSchema,
  bodyTooLarge,
  MAX_BODY_BYTES,
} from "../../_lib/validation";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { recordUsage } from "@/lib/usage";
import { nanoid } from "nanoid";

const MAX_IMPORT = 1000;

// 接受两种形态：记录数组 [{...}] 或导出格式 [{id,data,...}]——取每项的 data（无则取整项）
function extractData(item: unknown): unknown {
  if (item && typeof item === "object" && !Array.isArray(item)) {
    const obj = item as Record<string, unknown>;
    if ("data" in obj && obj.data && typeof obj.data === "object") {
      return obj.data;
    }
    return obj;
  }
  return item;
}

export async function POST(req: NextRequest) {
  const resolved = await resolveApiKey(req.headers.get("authorization"));
  if (!resolved) return withCors(fail("无效的 API Key", 401), req);
  const { appId, apiKeyId } = resolved;

  let res: Response;
  try {
    if (!canWrite(resolved)) {
      res = withCors(fail("该 Key 为只读，无写入权限", 403), req);
    } else {
      const rl = rateLimit(`v1import:${apiKeyId}`, 20, 60_000);
      if (!rl.ok) {
        res = withCors(tooMany(rl.retryAfter), req);
      } else {
        const sp = new URL(req.url).searchParams;
        const collection = collectionSchema.safeParse(sp.get("collection") ?? "");
        if (!collection.success) {
          res = withCors(fail("非法或缺失的集合名", 400), req);
        } else if (bodyTooLarge(req, MAX_BODY_BYTES * 5)) {
          res = withCors(fail("导入数据过大", 413), req);
        } else {
          let body: unknown;
          try {
            body = await req.json();
          } catch {
            body = undefined;
          }
          if (!Array.isArray(body)) {
            res = withCors(fail("导入数据必须是 JSON 数组", 400), req);
          } else if (body.length === 0 || body.length > MAX_IMPORT) {
            res = withCors(fail(`导入需 1-${MAX_IMPORT} 条`, 400), req);
          } else {
            const items = body.map(extractData);
            if (!items.every((it) => jsonObjectSchema.safeParse(it).success)) {
              res = withCors(fail("存在非 JSON 对象的数据项", 400), req);
            } else {
              await prisma.record.createMany({
                data: items.map((it) => ({
                  id: nanoid(),
                  appId,
                  collection: collection.data,
                  data: it as object,
                })),
              });
              res = withCors(
                ok({ imported: items.length }, undefined, 201),
                req,
              );
            }
          }
        }
      }
    }
  } catch (error) {
    logger.error("[v1] import failed", error);
    res = withCors(fail("导入失败，请稍后重试", 500), req);
  }
  recordUsage(appId, apiKeyId, "POST", res.status);
  return res;
}

export async function OPTIONS(req: NextRequest) {
  return withCors(new Response(null, { status: 204 }), req);
}
