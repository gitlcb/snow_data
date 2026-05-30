import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";
import { getSystemConfig } from "@/lib/system-config";
import {
  exchangeCode,
  fetchUser,
  resolveAvatar,
  OAUTH_STATE_COOKIE,
} from "@/lib/oauth-linuxdo";
import { logger } from "@/lib/logger";

const PROVIDER = "linuxdo";

// 跳回登录页并带错误提示
function loginError(origin: string, code: string): NextResponse {
  const url = new URL("/login", origin);
  url.searchParams.set("oauth_error", code);
  const res = NextResponse.redirect(url);
  res.cookies.delete(OAUTH_STATE_COOKIE);
  return res;
}

export async function GET(req: NextRequest) {
  const origin = new URL(req.url).origin;
  try {
    const cfg = await getSystemConfig();
    if (!cfg.linuxdoEnabled || !cfg.linuxdoClientId || !cfg.linuxdoClientSecret) {
      return loginError(origin, "disabled");
    }

    const sp = req.nextUrl.searchParams;
    const code = sp.get("code");
    const state = sp.get("state");
    const savedState = req.cookies.get(OAUTH_STATE_COOKIE)?.value;

    // CSRF：state 必须存在且与 cookie 一致
    if (!code || !state || !savedState || state !== savedState) {
      return loginError(origin, "state");
    }

    const redirectUri = `${origin}/api/auth/oauth/linuxdo/callback`;
    const accessToken = await exchangeCode({
      code,
      clientId: cfg.linuxdoClientId,
      clientSecret: cfg.linuxdoClientSecret,
      redirectUri,
    });
    if (!accessToken) return loginError(origin, "token");

    const profile = await fetchUser(accessToken);
    if (!profile || profile.id === undefined || profile.id === null) {
      return loginError(origin, "profile");
    }

    const oauthId = String(profile.id);
    const avatarUrl = resolveAvatar(profile);

    // 先按 oauth 身份找已有用户
    let user = await prisma.user.findUnique({
      where: { oauthProvider_oauthId: { oauthProvider: PROVIDER, oauthId } },
      select: { id: true, email: true, role: true, disabled: true },
    });

    if (user) {
      if (user.disabled) return loginError(origin, "disabled_user");
    } else {
      // 新用户：受注册开关约束
      if (!cfg.registrationOpen) return loginError(origin, "registration_closed");

      // 邮箱：Linux Do 可能不返回 email，用占位保证唯一非空
      const email =
        profile.email && profile.email.includes("@")
          ? profile.email
          : `linuxdo_${oauthId}@users.noreply.linux.do`;

      // 邮箱已被本地账号占用时，附加后缀避免唯一冲突
      const emailTaken = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });
      const finalEmail = emailTaken ? `linuxdo_${oauthId}@users.noreply.linux.do` : email;

      user = await prisma.user.create({
        data: {
          id: nanoid(),
          email: finalEmail,
          name: profile.name || profile.username,
          role: "user",
          oauthProvider: PROVIDER,
          oauthId,
          avatarUrl,
          // password 留空（OAuth 用户无密码）
        },
        select: { id: true, email: true, role: true, disabled: true },
      });
    }

    await createSession({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const res = NextResponse.redirect(new URL("/dashboard", origin));
    res.cookies.delete(OAUTH_STATE_COOKIE);
    return res;
  } catch (error) {
    logger.error("Linux Do 回调处理失败", error);
    return loginError(origin, "server");
  }
}
