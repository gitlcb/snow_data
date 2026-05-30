import { logger } from "@/lib/logger";

// Linux Do Connect OAuth2 端点（标准授权码流程）
export const LINUXDO_AUTHORIZE = "https://connect.linux.do/oauth2/authorize";
export const LINUXDO_TOKEN = "https://connect.linux.do/oauth2/token";
export const LINUXDO_USER = "https://connect.linux.do/api/user";

// state 防 CSRF 的 cookie 名（授权与回调路由共用）
export const OAUTH_STATE_COOKIE = "linuxdo_oauth_state";

export interface LinuxDoUser {
  id: number | string;
  username: string;
  name?: string;
  email?: string;
  avatar_url?: string;
  avatar_template?: string;
  active?: boolean;
  trust_level?: number;
}

/** 构造授权跳转 URL。 */
export function buildAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const u = new URL(LINUXDO_AUTHORIZE);
  u.searchParams.set("client_id", params.clientId);
  u.searchParams.set("redirect_uri", params.redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("state", params.state);
  return u.toString();
}

/** 用授权码换取 access_token。client_id/secret 走 body（最兼容）。 */
export async function exchangeCode(params: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<string | null> {
  try {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code: params.code,
      client_id: params.clientId,
      client_secret: params.clientSecret,
      redirect_uri: params.redirectUri,
    });
    const res = await fetch(LINUXDO_TOKEN, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body,
    });
    if (!res.ok) {
      logger.warn("Linux Do token 交换失败", res.status);
      return null;
    }
    const json = (await res.json()) as { access_token?: string };
    return json.access_token ?? null;
  } catch (e) {
    logger.warn("Linux Do token 交换异常", e);
    return null;
  }
}

/** 用 access_token 拉取用户信息。 */
export async function fetchUser(accessToken: string): Promise<LinuxDoUser | null> {
  try {
    const res = await fetch(LINUXDO_USER, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      logger.warn("Linux Do 拉取用户失败", res.status);
      return null;
    }
    return (await res.json()) as LinuxDoUser;
  } catch (e) {
    logger.warn("Linux Do 拉取用户异常", e);
    return null;
  }
}

/** 把头像模板转为实际 URL（avatar_template 含 {size} 占位）。 */
export function resolveAvatar(user: LinuxDoUser): string | null {
  if (user.avatar_url) return user.avatar_url;
  if (user.avatar_template) {
    const path = user.avatar_template.replace("{size}", "120");
    return path.startsWith("http") ? path : `https://linux.do${path}`;
  }
  return null;
}
