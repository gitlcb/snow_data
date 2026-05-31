import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getSystemConfig } from "@/lib/system-config";
import { buildAuthorizeUrl, OAUTH_STATE_COOKIE } from "@/lib/oauth-linuxdo";
import { resolveOrigin } from "@/lib/site-url";
import { logger } from "@/lib/logger";

// 发起 Linux Do 登录：校验已启用 + 已配置，生成 state 防 CSRF，302 跳转授权页
export async function GET(req: NextRequest) {
  try {
    const cfg = await getSystemConfig();
    if (!cfg.linuxdoEnabled || !cfg.linuxdoClientId) {
      return NextResponse.json(
        { success: false, error: "Linux Do 登录未启用" },
        { status: 404 },
      );
    }

    const origin = resolveOrigin(cfg.siteUrl, req);
    const redirectUri = `${origin}/api/auth/oauth/linuxdo/callback`;
    const state = randomBytes(16).toString("hex");

    const authorizeUrl = buildAuthorizeUrl({
      clientId: cfg.linuxdoClientId,
      redirectUri,
      state,
    });

    const res = NextResponse.redirect(authorizeUrl);
    // state 存 httpOnly cookie，回调时比对
    res.cookies.set(OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600, // 10 分钟
      path: "/",
    });
    return res;
  } catch (error) {
    logger.error("发起 Linux Do 登录失败", error);
    return NextResponse.json(
      { success: false, error: "发起登录失败" },
      { status: 500 },
    );
  }
}
