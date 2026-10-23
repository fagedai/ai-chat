/**
 * 账号相关：密码哈希 + 用户查询 + 演示账号播种
 *
 * 只允许服务端引用（bcryptjs 跑在 Node 运行时）。
 */
import "server-only";
import bcrypt from "bcryptjs";
import { sql } from "./db";
import { DEMO_EMAIL, DEMO_PASSWORD } from "./demo";

const SALT_ROUNDS = 10;

export interface UserRecord {
  id: number;
  email: string;
  password_hash: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  passwordHash: string
): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

export async function createUser(
  email: string,
  passwordHash: string
): Promise<UserRecord> {
  const rows = await sql`
    INSERT INTO users (email, password_hash)
    VALUES (${email.toLowerCase()}, ${passwordHash})
    RETURNING id, email, password_hash
  `;
  return (rows as unknown as UserRecord[])[0];
}

export async function getUserByEmail(email: string): Promise<UserRecord | null> {
  const rows = await sql`
    SELECT id, email, password_hash FROM users WHERE email = ${email.toLowerCase()}
  `;
  return (rows as unknown as UserRecord[])[0] || null;
}

export async function getUserById(id: number): Promise<UserRecord | null> {
  const rows = await sql`SELECT id, email, password_hash FROM users WHERE id = ${id}`;
  return (rows as unknown as UserRecord[])[0] || null;
}

/**
 * 确保演示账号存在（幂等）。
 * 已存在时只做一次 SELECT，不会重复做 bcrypt 计算。
 */
export async function ensureDemoUser(): Promise<UserRecord> {
  const existing = await getUserByEmail(DEMO_EMAIL);
  if (existing) return existing;
  return createUser(DEMO_EMAIL, await hashPassword(DEMO_PASSWORD));
}
