import { NextRequest } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api-response";
import { requireSuperadmin } from "@/lib/require-user";
import { logger } from "@/lib/logger";

const createSchema = z.object({
  title: z.string().trim().min(1, "标题不能为空").max(200, "标题过长"),
  body: z.string().trim().min(1, "正文不能为空"),
  type: z.enum(["info", "warning", "danger"]).default("info"),
  published: z.boolean().default(false),
});

// 列出全部公告（含草稿），供超管管理
export async function GET() {
  try {
    const admin = await requireSuperadmin();
    if (!admin) return fail("需要超级管理员权限", 403);

    const list = await prisma.announcement.findMany({
      orderBy: { createdAt: "desc" },
    });

    return ok(list);
  } catch (error) {
    logger.error("列出公告失败", error);
    return fail("获取公告列表失败", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireSuperadmin();
    if (!admin) return fail("需要超级管理员权限", 403);

    const body = await req.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "参数错误", 400);
    }

    const created = await prisma.announcement.create({
      data: {
        id: nanoid(),
        authorId: admin.userId,
        title: parsed.data.title,
        body: parsed.data.body,
        type: parsed.data.type,
        published: parsed.data.published,
      },
    });

    return ok(created, undefined, 201);
  } catch (error) {
    logger.error("创建公告失败", error);
    return fail("创建公告失败", 500);
  }
}
