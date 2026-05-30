import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveApiKey } from "@/lib/api-key";
import { ok, fail, tooMany } from "@/lib/api-response";
import { withCors } from "../../_lib/cors";
import { collectionSchema, isValidField } from "../../_lib/validation";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { recordUsage } from "@/lib/usage";

const OPS = new Set(["count", "sum", "avg", "min", "max"]);

interface AggRow {
  g: string | null;
  v: number | bigint | null;
}

export async function GET(req: NextRequest) {
  const resolved = await resolveApiKey(req.headers.get("authorization"));
  if (!resolved) return withCors(fail("无效的 API Key", 401), req);
  const { appId, apiKeyId } = resolved;

  let res: Response;
  try {
    const rl = rateLimit(`v1:${apiKeyId}`, 120, 60_000);
    if (!rl.ok) {
      res = withCors(tooMany(rl.retryAfter), req);
    } else {
      const sp = new URL(req.url).searchParams;
      const collection = collectionSchema.safeParse(sp.get("collection") ?? "");
      const op = sp.get("op") ?? "count";
      const field = sp.get("field");
      const groupBy = sp.get("groupBy");

      if (!collection.success) {
        res = withCors(fail("非法或缺失的集合名", 400), req);
      } else if (!OPS.has(op)) {
        res = withCors(fail("不支持的聚合算子", 400), req);
      } else if (op !== "count" && (!field || !isValidField(field))) {
        res = withCors(fail("该算子需要合法的 field 参数", 400), req);
      } else if (groupBy && !isValidField(groupBy)) {
        res = withCors(fail("非法的 groupBy 字段", 400), req);
      } else {
        // 构造聚合表达式（字段路径走占位符参数化）
        let selectExpr: string;
        if (op === "count") {
          selectExpr = "COUNT(*)";
        } else {
          const sqlOp = op.toUpperCase();
          selectExpr = `${sqlOp}(CAST(JSON_UNQUOTE(JSON_EXTRACT(data, ?)) AS DECIMAL(30,10)))`;
        }

        let groupExpr = "NULL";
        let groupTail = "";
        if (groupBy) {
          groupExpr = "JSON_UNQUOTE(JSON_EXTRACT(data, ?))";
          // 按 SELECT 别名 g 分组，避免重复表达式触发 only_full_group_by
          groupTail = ` GROUP BY g ORDER BY v DESC LIMIT 50`;
        }

        // 参数顺序：SELECT 里的 group 路径、agg field 路径，WHERE 的 app/collection
        const selectParams: string[] = [];
        if (groupBy) selectParams.push(`$.${groupBy}`);
        if (op !== "count" && field) selectParams.push(`$.${field}`);

        const sql = `SELECT ${groupExpr} AS g, ${selectExpr} AS v FROM records WHERE app_id = ? AND collection = ?${groupTail}`;
        const rows = await prisma.$queryRawUnsafe<AggRow[]>(
          sql,
          ...selectParams,
          appId,
          collection.data,
        );

        const result = groupBy
          ? rows.map((r) => ({ group: r.g, value: Number(r.v ?? 0) }))
          : { value: Number(rows[0]?.v ?? 0) };

        res = withCors(ok(result), req);
      }
    }
  } catch (error) {
    logger.error("[v1] aggregate failed", error);
    res = withCors(fail("聚合查询失败，请稍后重试", 500), req);
  }
  recordUsage(appId, apiKeyId, "GET", res.status);
  return res;
}

export async function OPTIONS(req: NextRequest) {
  return withCors(new Response(null, { status: 204 }), req);
}
