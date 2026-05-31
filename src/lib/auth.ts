import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
import { COOKIE_NAME, SESSION_MAX_AGE, getJwtSecret } from "@/lib/auth-secret";

const MAX_AGE = SESSION_MAX_AGE;

export interface SessionPayload {
  userId: string;
  email: string;
  role: string; // user | superadmin
}

/**
 * 判断「浏览器→边缘」这一跳是否走 HTTPS，用于决定 cookie 的 Secure 标志。
 * 反代（nginx `proxy_set_header X-Forwarded-Proto $scheme;`，且会覆盖客户端伪造值）
 * 与 Cloudflare 会带上 x-forwarded-proto；纯 HTTP 直连时该头缺失，按非安全处理。
 * 误判为非安全只会少一点加固（非 Secure cookie 在 HTTPS 下照样发送），不会让登录失效。
 */
export async function isRequestSecure(): Promise<boolean> {
  try {
    const proto = (await headers()).get("x-forwarded-proto");
    return proto?.split(",")[0]?.trim().toLowerCase() === "https";
  } catch {
    return false;
  }
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(getJwtSecret());

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: await isRequestSecure(),
    sameSite: "lax",
    maxAge: MAX_AGE,
    path: "/",
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return {
      userId: payload.userId as string,
      email: payload.email as string,
      role: (payload.role as string) ?? "user",
    };
  } catch {
    return null;
  }
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
