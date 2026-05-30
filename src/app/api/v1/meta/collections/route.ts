import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveApiKey } from "@/lib/api-key";
import { ok, fail, tooMany } from "@/lib/api-response";
import { withCors } from "../../_lib/cors";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

// 返回当前 app 下所有 collection 名及各自记录数
export async function GET(req: NextRequest) {
  try {
    const resolved = await resolveApiKey(req.headers.get("authorization"));
    if (!resolved) return withCors(fail("无效的 API Key", 401), req);
    const { appId, apiKeyId } = resolved;

    const rl = rateLimit(`v1:${apiKeyId}`, 120, 60_000);
    if (!rl.ok) return withCors(tooMany(rl.retryAfter), req);

    const grouped = await prisma.record.groupBy({
      by: ["collection"],
      where: { appId },
      _count: true,
    });

    const result = grouped.map((g) => ({
      collection: g.collection,
      count: g._count,
    }));

    return withCors(ok(result), req);
  } catch (error) {
    logger.error("[v1] meta collections failed", error);
    return withCors(fail("查询失败，请稍后重试", 500), req);
  }
}

export async function OPTIONS(req: NextRequest) {
  return withCors(new Response(null, { status: 204 }), req);
}
