import { ok } from "@/lib/api-response";
import { getSystemConfig } from "@/lib/system-config";

// 公开端点：供登录/注册页渲染（是否开放注册、是否启用 Linux Do 登录）
// 仅返回非敏感标志，不含任何密钥。
export async function GET() {
  const cfg = await getSystemConfig();
  return ok({
    registrationOpen: cfg.registrationOpen,
    linuxdoEnabled: cfg.linuxdoEnabled && !!cfg.linuxdoClientId,
  });
}
