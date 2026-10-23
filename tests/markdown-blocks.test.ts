import { describe, it, expect } from "vitest";
import { splitMarkdownBlocks } from "@/lib/markdown-blocks";

describe("splitMarkdownBlocks", () => {
  it("按空行切分普通段落", () => {
    expect(splitMarkdownBlocks("第一段\n\n第二段\n\n第三段")).toEqual([
      "第一段",
      "第二段",
      "第三段",
    ]);
  });

  it("连续多个空行只切一次", () => {
    expect(splitMarkdownBlocks("a\n\n\n\nb")).toEqual(["a", "b"]);
  });

  it("代码块内部的空行不切分", () => {
    const md = "```js\nconst a = 1;\n\nconst b = 2;\n```";
    expect(splitMarkdownBlocks(md)).toEqual([md]);
  });

  it("代码块结束后继续按空行切分", () => {
    const md = "```js\nconst a = 1;\n```\n\n后面的段落";
    expect(splitMarkdownBlocks(md)).toEqual(["```js\nconst a = 1;\n```", "后面的段落"]);
  });

  it("未闭合的代码块保持为一个块", () => {
    const md = "```py\nprint(1)\n\nprint(2)";
    expect(splitMarkdownBlocks(md)).toEqual([md]);
  });

  it("~~~ 形式的代码块同样生效", () => {
    const md = "~~~\nline1\n\nline2\n~~~";
    expect(splitMarkdownBlocks(md)).toEqual([md]);
  });

  it("空字符串返回一个空块，方便渲染层处理", () => {
    expect(splitMarkdownBlocks("")).toEqual([""]);
  });
});
