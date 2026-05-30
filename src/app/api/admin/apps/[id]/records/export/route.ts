import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api-response";
import { requireUser, assertAppOwner } from "@/lib/require-user";
import { logger } from "@/lib/logger";

const EXPORT_LIMIT = 10_000;

function toCsv(rows: { id: string; data: unknown; createdAt: Date }[]): string {
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
    lines.push(
      [esc(r.id), esc(r.createdAt.toISOString()), ...[...keys].map((k) => esc(d[k]))].join(","),
    );
  }
  return lines.join("\n");
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    if (!user) return fail("未登录", 401);

    const { id } = await params;
    if (!(await assertAppOwner(id, user.userId))) return fail("无权访问", 403);

    const sp = req.nextUrl.searchParams;
    const collection = sp.get("collection")?.trim();
    const format = sp.get("format") === "csv" ? "csv" : "json";
    if (!collection) return fail("缺少 collection 参数", 400);

    const rows = await prisma.record.findMany({
      where: { appId: id, collection },
      orderBy: { createdAt: "desc" },
      take: EXPORT_LIMIT,
      select: { id: true, data: true, createdAt: true },
    });

    if (format === "csv") {
      return new Response(toCsv(rows), {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${collection}.csv"`,
        },
      });
    }
    return new Response(
      JSON.stringify(
        rows.map((r) => ({ id: r.id, data: r.data, createdAt: r.createdAt })),
      ),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="${collection}.json"`,
        },
      },
    );
  } catch (error) {
    logger.error("导出记录失败", error);
    return fail("导出失败", 500);
  }
}
