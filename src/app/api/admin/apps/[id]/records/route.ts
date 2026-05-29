import { NextRequest } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api-response";
import { requireUser, assertAppOwner } from "@/lib/require-user";

const createSchema = z.object({
  collection: z.string().trim().min(1, "集合名称不能为空"),
  data: z
    .record(z.unknown())
    .refine((v) => v !== null && !Array.isArray(v), {
      message: "data 必须是对象",
    }),
});

interface RawRecord {
  id: string;
  data: unknown;
  created_at: Date;
  updated_at: Date;
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
    if (!collection) return fail("缺少 collection 参数", 400);

    const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(sp.get("limit") ?? "20", 10) || 20),
    );
    const q = sp.get("q")?.trim() ?? "";
    const skip = (page - 1) * limit;

    // 有搜索词时用 raw SQL 对 JSON 文本做参数化模糊匹配（MySQL 上更稳）
    if (q) {
      const dataSql =
        "SELECT id, data, created_at, updated_at FROM records WHERE app_id = ? AND collection = ? AND CAST(data AS CHAR) LIKE ? ORDER BY created_at DESC LIMIT ? OFFSET ?";
      const countSql =
        "SELECT COUNT(*) AS cnt FROM records WHERE app_id = ? AND collection = ? AND CAST(data AS CHAR) LIKE ?";
      const like = `%${q}%`;

      const rows = await prisma.$queryRawUnsafe<RawRecord[]>(
        dataSql,
        id,
        collection,
        like,
        limit,
        skip,
      );
      const countRes = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
        countSql,
        id,
        collection,
        like,
      );
      const total = Number(countRes[0]?.cnt ?? 0);

      const records = rows.map((r) => ({
        id: r.id,
        data: typeof r.data === "string" ? safeParse(r.data) : r.data,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }));

      return ok(records, { total, page, limit });
    }

    const [rows, total] = await Promise.all([
      prisma.record.findMany({
        where: { appId: id, collection },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: { id: true, data: true, createdAt: true, updatedAt: true },
      }),
      prisma.record.count({ where: { appId: id, collection } }),
    ]);

    return ok(rows, { total, page, limit });
  } catch (error) {
    console.error("获取记录列表失败:", error);
    return fail("获取记录列表失败", 500);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    if (!user) return fail("未登录", 401);

    const { id } = await params;
    if (!(await assertAppOwner(id, user.userId))) return fail("无权访问", 403);

    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "参数错误", 400);
    }

    const record = await prisma.record.create({
      data: {
        id: nanoid(),
        appId: id,
        collection: parsed.data.collection,
        data: parsed.data.data as Prisma.InputJsonValue,
      },
      select: { id: true, data: true, createdAt: true, updatedAt: true },
    });

    return ok(record, undefined, 201);
  } catch (error) {
    console.error("创建记录失败:", error);
    return fail("创建记录失败", 500);
  }
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}
