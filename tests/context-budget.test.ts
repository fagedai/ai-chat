import { describe, it, expect } from "vitest";
import {
  extractMessageText,
  messageChars,
  trimToCharBudget,
} from "@/lib/context-budget";

describe("extractMessageText", () => {
  it("字符串内容直接返回", () => {
    expect(extractMessageText("hello")).toBe("hello");
  });

  it("只拼接 text 类型的 part", () => {
    expect(
      extractMessageText([
        { type: "text", text: "ab" },
        { type: "image" },
        { type: "text", text: "cd" },
      ])
    ).toBe("abcd");
  });

  it("undefined 返回空字符串", () => {
    expect(extractMessageText(undefined)).toBe("");
  });
});

describe("messageChars", () => {
  it("按纯文本字符数计算", () => {
    expect(messageChars({ content: [{ type: "text", text: "你好" }] })).toBe(2);
  });
});

describe("trimToCharBudget", () => {
  const msg = (role: string, text: string) => ({ role, content: text });

  it("未超预算时原样返回", () => {
    const msgs = [msg("user", "12345"), msg("assistant", "67890")];
    expect(trimToCharBudget(msgs, 100)).toEqual(msgs);
  });

  it("超预算时从最早的消息开始丢弃", () => {
    const msgs = [
      msg("user", "11111"), // 5
      msg("assistant", "22222"), // 5
      msg("user", "33333"), // 5
    ];
    const result = trimToCharBudget(msgs, 10);
    expect(result.map((m) => m.content)).toEqual(["33333"]);
  });

  it("至少保留最后一条消息", () => {
    const msgs = [msg("user", "1234567890")];
    expect(trimToCharBudget(msgs, 1)).toHaveLength(1);
  });

  it("裁剪后不以 assistant 开头", () => {
    const msgs = [
      msg("user", "aaaa"), // 被裁掉
      msg("assistant", "bbbb"),
      msg("user", "cccc"),
    ];
    const result = trimToCharBudget(msgs, 9);
    expect(result[0].role).toBe("user");
    expect(result.map((m) => m.content)).toEqual(["cccc"]);
  });

  it("空数组返回空数组", () => {
    expect(trimToCharBudget([], 10)).toEqual([]);
  });
});
