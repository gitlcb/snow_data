import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveApiKey } from "@/lib/api-key";
import { fail, tooMany } from "@/lib/api-response";
import { withCors } from "../../_lib/cors";
import { collectionSchema } from "../../_lib/validation";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { recordUsage } from "@/lib/usage";

const EXPORT_LIMIT = 10_000; // 单次导出上限，防止超大集合拖垮内存

function toCsv(rows: { id: string; data: unknown; createdAt: Date }[]): string {
  // 收集所有 data 键作为列
  const keys = new Set<string>();
  for (const r of rows) {
    if (r.data && typeof r.data === "object" && !Array.isArray(r.data)) {
      for (const k of Object.keys(r.data as object)) keys.add(k);
    }
  }
  const cols = ["id", "createdAt", ...keys];
  const esc = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [cols.join(",")];
  for (const r of rows) {
    const d = (r.data ?? {}) as Record<string, unknown>;
    const row = [
      esc(r.id),
      esc(r.createdAt.toISOString()),
      ...[...keys].map((k) => esc(d[k])),
    ];
    lines.push(row.join(","));
  }
  return lines.join("\n");
}

export async function GET(req: NextRequest) {
  const resolved = await resolveApiKey(req.headers.get("authorization"));
  if (!resolved) return withCors(fail("无效的 API Key", 401), req);
  const { appId, apiKeyId } = resolved;

  let res: Response;
  try {
    const rl = rateLimit(`v1export:${apiKeyId}`, 20, 60_000);
    if (!rl.ok) {
      res = withCors(tooMany(rl.retryAfter), req);
    } else {
      const sp = new URL(req.url).searchParams;
      const collection = collectionSchema.safeParse(sp.get("collection") ?? "");
      const format = sp.get("format") === "csv" ? "csv" : "json";

      if (!collection.success) {
        res = withCors(fail("非法或缺失的集合名", 400), req);
      } else {
        const rows = await prisma.record.findMany({
          where: { appId, collection: collection.data },
          orderBy: { createdAt: "desc" },
          take: EXPORT_LIMIT,
          select: { id: true, data: true, createdAt: true },
        });

        if (format === "csv") {
          const csv = toCsv(rows);
          res = withCors(
            new Response(csv, {
              status: 200,
              headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": `attachment; filename="${collection.data}.csv"`,
              },
            }),
            req,
          );
        } else {
          const json = JSON.stringify(
            rows.map((r) => ({
              id: r.id,
              data: r.data,
              createdAt: r.createdAt,
            })),
          );
          res = withCors(
            new Response(json, {
              status: 200,
              headers: {
                "Content-Type": "application/json; charset=utf-8",
                "Content-Disposition": `attachment; filename="${collection.data}.json"`,
              },
            }),
            req,
          );
        }
      }
    }
  } catch (error) {
    logger.error("[v1] export failed", error);
    res = withCors(fail("导出失败，请稍后重试", 500), req);
  }
  recordUsage(appId, apiKeyId, "GET", res.status);
  return res;
}

export async function OPTIONS(req: NextRequest) {
  return withCors(new Response(null, { status: 204 }), req);
}
