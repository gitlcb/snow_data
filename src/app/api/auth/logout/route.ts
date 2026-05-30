import { destroySession } from "@/lib/auth";
import { ok, fail } from "@/lib/api-response";
import { logger } from "@/lib/logger";

export async function POST() {
  try {
    await destroySession();
    return ok({ ok: true });
  } catch (error) {
    logger.error("logout failed", error);
    return fail("登出失败，请稍后重试", 500);
  }
}
