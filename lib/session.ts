/**
 * 会话（JWT）加解密
 *
 * 采用无状态 session：登录后签发 HS256 JWT 存入 httpOnly cookie，
 * 服务端只需验签即可拿到 userId，无需查会话表。
 */
import "server-only";
import { SignJWT, jwtVerify } from "jose";

export interface SessionPayload {
  userId: number;
  email: string;
}

/** cookie 名称与有效期（秒），登录与退出共用 */
export const SESSION_COOKIE = "session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 天

function getEncodedKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("缺少 SESSION_SECRET 环境变量，无法签发会话");
  }
  return new TextEncoder().encode(secret);
}

/** 签发会话 JWT */
export async function encrypt(payload: SessionPayload): Promise<string> {
  return new SignJWT({ userId: payload.userId, email: payload.email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(getEncodedKey());
}

/** 校验并解出会话内容；token 缺失、过期或被篡改都返回 undefined */
export async function decrypt(
  token: string | undefined
): Promise<SessionPayload | undefined> {
  if (!token) return undefined;
  try {
    const { payload } = await jwtVerify(token, getEncodedKey(), {
      algorithms: ["HS256"],
    });
    if (typeof payload.userId !== "number" || typeof payload.email !== "string") {
      return undefined;
    }
    return { userId: payload.userId, email: payload.email };
  } catch {
    // 验签失败 / 过期：视作未登录
    return undefined;
  }
}
