import { ok } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { getSystemConfig } from "@/lib/system-config";

// 公开端点：供登录/注册页渲染（是否开放注册、是否启用 Linux Do 登录）
// 仅返回非敏感标志，不含任何密钥。
export async function GET() {
  const cfg = await getSystemConfig();
  // needsSetup：无超管时为 true，前端据此把用户引导到 /setup（中间件在 Edge 无法查库）
  const needsSetup =
    (await prisma.user.count({ where: { role: "superadmin" } })) === 0;
  return ok({
    siteUrl: cfg.siteUrl ?? "",
    registrationOpen: cfg.registrationOpen,
    linuxdoEnabled: cfg.linuxdoEnabled && !!cfg.linuxdoClientId,
    needsSetup,
  });
}
