import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail } from "@/lib/api-response";
import { requireSuperadmin } from "@/lib/require-user";
import { getSystemConfig, updateSystemConfig } from "@/lib/system-config";
import { logger } from "@/lib/logger";

const patchSchema = z.object({
  registrationOpen: z.boolean().optional(),
  linuxdoEnabled: z.boolean().optional(),
  linuxdoClientId: z.string().trim().max(255).optional().nullable(),
  // 空串表示「不修改」；非空才更新 secret（避免脱敏回显被当作明文写回）
  linuxdoClientSecret: z.string().max(255).optional(),
  uploadMaxBytes: z.number().int().min(1024).max(1024 * 1024 * 1024).optional(),
  uploadAllowedMime: z.string().max(2000).optional(),
});

export async function GET() {
  try {
    const admin = await requireSuperadmin();
    if (!admin) return fail("需要超级管理员权限", 403);

    const cfg = await getSystemConfig();
    // secret 脱敏：只返回是否已配置，不回显明文
    return ok({
      registrationOpen: cfg.registrationOpen,
      linuxdoEnabled: cfg.linuxdoEnabled,
      linuxdoClientId: cfg.linuxdoClientId ?? "",
      linuxdoClientSecretSet: !!cfg.linuxdoClientSecret,
      uploadMaxBytes: cfg.uploadMaxBytes,
      uploadAllowedMime: cfg.uploadAllowedMime,
    });
  } catch (error) {
    logger.error("读取系统配置失败", error);
    return fail("读取系统配置失败", 500);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const admin = await requireSuperadmin();
    if (!admin) return fail("需要超级管理员权限", 403);

    const body = await req.json().catch(() => null);
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "参数错误", 400);
    }

    const {
      linuxdoClientSecret,
      ...rest
    } = parsed.data;

    const patch: Record<string, unknown> = { ...rest };
    // 仅当传了非空 secret 才更新；空串/未传表示保留原值
    if (linuxdoClientSecret !== undefined && linuxdoClientSecret !== "") {
      patch.linuxdoClientSecret = linuxdoClientSecret;
    }

    await updateSystemConfig(patch);

    return ok({ ok: true });
  } catch (error) {
    logger.error("更新系统配置失败", error);
    return fail("更新系统配置失败", 500);
  }
}
