import { NextRequest } from "next/server";
import { nanoid } from "nanoid";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api-response";
import { requireUser, assertAppOwner } from "@/lib/require-user";
import { logger } from "@/lib/logger";

const MAX_IMPORT = 1000;
const itemSchema = z
  .record(z.unknown())
  .refine((v) => v !== null && !Array.isArray(v), "必须是对象");

function extractData(item: unknown): unknown {
  if (item && typeof item === "object" && !Array.isArray(item)) {
    const obj = item as Record<string, unknown>;
    if ("data" in obj && obj.data && typeof obj.data === "object") return obj.data;
    return obj;
  }
  return item;
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

    const sp = req.nextUrl.searchParams;
    const collection = sp.get("collection")?.trim();
    if (!collection) return fail("缺少 collection 参数", 400);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return fail("请求体必须是 JSON 数组", 400);
    }
    if (!Array.isArray(body)) return fail("导入数据必须是 JSON 数组", 400);
    if (body.length === 0 || body.length > MAX_IMPORT) {
      return fail(`导入需 1-${MAX_IMPORT} 条`, 400);
    }

    const items = body.map(extractData);
    if (!items.every((it) => itemSchema.safeParse(it).success)) {
      return fail("存在非 JSON 对象的数据项", 400);
    }

    await prisma.record.createMany({
      data: items.map((it) => ({
        id: nanoid(),
        appId: id,
        collection,
        data: it as Prisma.InputJsonValue,
      })),
    });

    return ok({ imported: items.length }, undefined, 201);
  } catch (error) {
    logger.error("导入记录失败", error);
    return fail("导入失败", 500);
  }
}
