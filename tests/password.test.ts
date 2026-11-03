import { describe, it, expect, vi } from "vitest";

// lib/auth.ts 标记了 server-only 且依赖 lib/db.ts。
// 这里只测纯哈希逻辑（不碰数据库），所以把 server-only 标记替换为空模块，
// 让 vitest 的 node 环境能正常 import（postgres.js 懒连接，不会真正建连）。
vi.mock("server-only", () => ({}));

import { hashPassword, verifyPassword } from "@/lib/auth";

/**
 * 注册/登录的密码安全，本质上是回答两个问题：
 *
 * 1. 彩虹表攻击：攻击者预计算「常见明文 → 哈希」的大表，拖库后直接查表。
 *    抵御方式 = 随机盐。盐让同一明文在不同账号下哈希不同，
 *    攻击者必须为「每个盐」单独建表，预计算失去意义。
 *
 * 2. 暴力破解：攻击者拿密码字典逐个尝试。
 *    抵御方式 = 高成本因子 + 强度校验。cost=10 表示 2^10=1024 轮 Blowfish，
 *    每次猜测都昂贵；强度校验堵住「弱密码」这条捷径。
 */
describe("hashPassword/verifyPassword - 密码哈希安全性", () => {
  it("使用 bcrypt v2b，成本因子为 10", async () => {
    const hash = await hashPassword("Passw0rd");
    // 格式：$2b$10$<22字符盐><31字符哈希>
    expect(hash.startsWith("$2b$10$")).toBe(true);
  });

  it("同一密码两次哈希结果不同（随机盐，彩虹表无法命中）", async () => {
    const a = await hashPassword("Passw0rd");
    const b = await hashPassword("Passw0rd");
    expect(a).not.toBe(b);
  });

  it("盐嵌入哈希且每次不同", async () => {
    const a = await hashPassword("Passw0rd");
    const b = await hashPassword("Passw0rd");
    // $2b$10$ 前缀长 7 字符，之后是 22 字符的 base64 盐
    const saltA = a.slice(7, 29);
    const saltB = b.slice(7, 29);
    expect(saltA).not.toBe(saltB);
    expect(saltA.length).toBe(22);
  });

  it("正确密码验证通过", async () => {
    const hash = await hashPassword("Passw0rd");
    expect(await verifyPassword("Passw0rd", hash)).toBe(true);
  });

  it("错误密码验证失败", async () => {
    const hash = await hashPassword("Passw0rd");
    expect(await verifyPassword("passw0rd", hash)).toBe(false);
    expect(await verifyPassword("Passw0rd!", hash)).toBe(false);
  });

  it("哈希不可逆：结果不包含明文", async () => {
    const plain = "SuperSecret9";
    const hash = await hashPassword(plain);
    expect(hash).not.toContain(plain);
    expect(hash).not.toContain("SuperSecret");
  });
});
