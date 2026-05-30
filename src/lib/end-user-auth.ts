import { SignJWT, jwtVerify } from "jose";
import { getJwtSecret } from "@/lib/auth-secret";

const ENDUSER_MAX_AGE = 60 * 60 * 24 * 30; // 30 天

export interface EndUserToken {
  endUserId: string;
  appId: string;
  email: string;
}

/** 为终端用户签发 JWT（demo 客户端自行保存，通过 Bearer 头回传）。 */
export async function signEndUserToken(payload: EndUserToken): Promise<string> {
  return new SignJWT({ ...payload, kind: "enduser" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ENDUSER_MAX_AGE}s`)
    .sign(getJwtSecret());
}

/**
 * 校验终端用户 JWT。失败或非 enduser 类型返回 null。
 * appId 用于确保 token 属于当前 App（Key 解析出的 App 与 token 内 appId 必须一致）。
 */
export async function verifyEndUserToken(
  token: string,
): Promise<EndUserToken | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    if (payload.kind !== "enduser") return null;
    return {
      endUserId: payload.endUserId as string,
      appId: payload.appId as string,
      email: payload.email as string,
    };
  } catch {
    return null;
  }
}
