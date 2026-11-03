import { describe, it, expect } from "vitest";
import {
  MIN_PASSWORD_LENGTH,
  validateEmail,
  validatePassword,
} from "@/lib/auth-validate";

describe("validateEmail - 邮箱格式校验", () => {
  it("接受合法邮箱", () => {
    expect(validateEmail("hr@company.com").ok).toBe(true);
  });

  it("大小写与首尾空格归一化后仍可通过", () => {
    expect(validateEmail("  HR@Company.COM ").ok).toBe(true);
  });

  it("拒绝缺少 @ 的邮箱", () => {
    const r = validateEmail("hr.company.com");
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("邮箱格式");
  });

  it("拒绝空邮箱", () => {
    const r = validateEmail("   ");
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("请输入邮箱");
  });

  it("拒绝超过 RFC 上限的超长邮箱", () => {
    const r = validateEmail("a".repeat(250) + "@x.com");
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("过长");
  });
});

describe("validatePassword - 密码强度校验", () => {
  it(`拒绝少于 ${MIN_PASSWORD_LENGTH} 位的密码`, () => {
    const r = validatePassword("Ab3");
    expect(r.ok).toBe(false);
    expect(r.reason).toContain(`${MIN_PASSWORD_LENGTH} 位`);
  });

  it("拒绝纯数字密码（无字母）", () => {
    const r = validatePassword("12345678");
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("字母和数字");
  });

  it("拒绝纯字母密码（无数字）", () => {
    const r = validatePassword("password");
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("字母和数字");
  });

  it("接受同时含字母和数字且足够长的密码", () => {
    expect(validatePassword("Passw0rd").ok).toBe(true);
    expect(validatePassword("abc12345").ok).toBe(true);
  });
});
