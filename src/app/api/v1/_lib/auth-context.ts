import { resolveApiKey } from "@/lib/api-key";
import { verifyEndUserToken } from "@/lib/end-user-auth";

export interface V1Context {
  appId: string;
  apiKeyId: string | null; // 终端用户身份时为 null
  scope: "readonly" | "readwrite";
  ownerId: string | null; // 终端用户身份时为其 id；App Key 时为 null（可访问全部）
  isEndUser: boolean;
}

/**
 * 统一解析 /api/v1 数据请求的身份：
 *  - sk_live_ 开头 -> App Key（ownerId=null，可访问全部，scope 来自 Key）
 *  - 否则尝试终端用户 JWT（ownerId=自己，scope=readwrite，仅自己的记录）
 * 返回 null 表示鉴权失败。
 */
export async function resolveV1Auth(
  authHeader: string | null,
): Promise<V1Context | null> {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1].trim();

  // App Key 路径
  if (token.startsWith("sk_live_")) {
    const key = await resolveApiKey(authHeader);
    if (!key) return null;
    return {
      appId: key.appId,
      apiKeyId: key.apiKeyId,
      scope: key.scope === "readonly" ? "readonly" : "readwrite",
      ownerId: null,
      isEndUser: false,
    };
  }

  // 终端用户 JWT 路径
  const eu = await verifyEndUserToken(token);
  if (!eu) return null;
  return {
    appId: eu.appId,
    apiKeyId: null,
    scope: "readwrite",
    ownerId: eu.endUserId,
    isEndUser: true,
  };
}
