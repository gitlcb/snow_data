import { destroySession } from "@/lib/auth";
import { ok, fail } from "@/lib/api-response";

export async function POST() {
  try {
    await destroySession();
    return ok({ ok: true });
  } catch (error) {
    console.error("logout failed:", error);
    return fail("登出失败，请稍后重试", 500);
  }
}
