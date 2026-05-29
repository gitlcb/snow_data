import { NextRequest } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api-response";
import { requireUser, assertAppOwner } from "@/lib/require-user";
import { generateApiKey } from "@/lib/api-key";

const createSchema = z.object({
  name: z.string().trim().min(1, "Key 名称不能为空"),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    if (!user) return fail("未登录", 401);

    const { id } = await params;
    if (!(await assertAppOwner(id, user.userId))) return fail("无权访问", 403);

    const keys = await prisma.apiKey.findMany({
      where: { appId: id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });

    return ok(keys);
  } catch (error) {
    console.error("列出 API Key 失败:", error);
    return fail("获取 API Key 列表失败", 500);
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

    const { plain, keyHash, keyPrefix } = generateApiKey();
    const created = await prisma.apiKey.create({
      data: {
        id: nanoid(),
        appId: id,
        name: parsed.data.name,
        keyHash,
        keyPrefix,
      },
      select: { id: true, name: true, keyPrefix: true },
    });

    // plainKey 仅此一次返回，前端需提示用户立即保存
    return ok({ ...created, plainKey: plain }, undefined, 201);
  } catch (error) {
    console.error("创建 API Key 失败:", error);
    return fail("创建 API Key 失败", 500);
  }
}
