# RAG 知识库问答系统

一个可登录、多租户隔离、带用量配额的知识库问答产品：上传文档 → 切片向量化 → 混合检索 + 重排序 → 流式回答并标注引用来源，附带成本看板。

> 在线体验：<https://ai-chat-333243-11-1340654264.sh.run.tcloudbase.com/login>
> 演示账号：`demo@ai-chat.com` / `demo123456`

## 功能

**知识库问答**

- 支持 `.txt` / `.md` / `.docx` 上传，按标题层级 + 段落递归切片（单块 ≤ 800 字，重叠 100 字）
- 混合检索：pgvector 语义检索 + PostgreSQL `ts_rank` / `ILIKE` 关键词检索并行，按 id 合并去重
- 阈值过滤 + 加权重排序（向量 0.5 / BM25 0.2 / 关键词命中 0.3），取 top-3 注入 system prompt
- 回答流式输出，末尾标注 `[来源N] 文件名`，前端可展开查看完整检索链路
- 检索不到时自动降级为普通对话，不阻断提问

**对话体验**

- 流式 Markdown 增量渲染（详见 [流式渲染优化](docs/streaming-markdown-optimization.md)）
- 超过 10 轮对话自动摘要早期消息，控制 token 消耗
- 对话历史自动保存到数据库，可切换、删除

**多租户与安全**

- 邮箱 + 密码登录，bcrypt 哈希，JWT 存 httpOnly cookie，7 天有效期
- `documents` / `chats` 全部带 `user_id`，读写、更新、删除都按用户隔离，越权返回 404
- 上传内容做 Prompt 注入检测与 10 万字上限校验，同名文件拒绝覆盖
- 登录接口按 IP 限流（10 分钟 5 次失败），防撞库

**成本控制**

- 每用户每日 300 次调用、全站每日 1000 次，超额返回 429
- 每次 LLM 调用记录 token 与耗时，`/usage` 页面展示今日用量、剩余额度、平均响应时间和估算成本

## 技术栈

| 层 | 选型 |
|---|---|
| 框架 | Next.js 16（App Router）+ React 19 + TypeScript |
| 样式/组件 | Tailwind CSS 4 + Ant Design 6 / @ant-design/x |
| LLM | Vercel AI SDK 6，硅基流动 Qwen2.5-32B（备选 DeepSeek） |
| 向量 | BGE-large-zh-v1.5（1024 维，云端）；无 Key 时回退本地 bge-small-zh（512 维） |
| 数据库 | PostgreSQL + pgvector（Supabase） |
| 认证 | bcryptjs + jose（HS256 JWT）+ httpOnly cookie |
| 部署 | Docker 多阶段构建 → 腾讯云 CloudBase 云托管 |

## 架构

```
浏览器
  │  fetch / SSE
  ▼
Next.js（App Router）
  ├─ proxy.ts            乐观鉴权重定向（只查 cookie 是否存在）
  ├─ app/api/*           路由处理器：真实会话校验 + 配额检查
  ├─ lib/dal.ts          会话解析（jose 验签，cache 去重）
  ├─ lib/usage.ts        用量记录 / 配额 / 成本估算
  └─ lib/hybrid.ts       混合检索
        ├─ lib/embedding.ts  → 硅基流动 Embedding API
        ├─ lib/db.ts         → PostgreSQL + pgvector
        └─ lib/rerank.ts     加权重排
  ▼
LLM（流式返回）
```

表结构：`users`、`documents`（含 `embedding vector(1024)`）、`chats`、`usage_events`。

## 快速开始

```bash
npm install
cp .env.example .env.local   # 按需填写，见下表
npm run dev
```

### 环境变量

| 变量 | 必填 | 说明 |
|---|---|---|
| `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASSWORD` | ✅ | PostgreSQL 连接信息。Supabase 事务池用 6543 端口、用户名形如 `postgres.<项目ref>` |
| `SESSION_SECRET` | ✅ | JWT 签名密钥，`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` 生成 |
| `SILICONFLOW_API_KEY` | ✅ | 用于云端 Embedding + 默认 LLM；不填会退化为本地 512 维模型 |
| `DEEPSEEK_API_KEY` / `DEEPSEEK_API_BASE` | ❌ | 未配置硅基流动时的 LLM 兜底 |
| `CHAT_DAILY_LIMIT_PER_USER` | ❌ | 每用户每日调用上限，默认 `300` |
| `CHAT_DAILY_LIMIT_GLOBAL` | ❌ | 全站每日调用上限，默认 `1000` |
| `LLM_PRICE_INPUT_PER_M` / `LLM_PRICE_OUTPUT_PER_M` | ❌ | 单价（元/百万 token），配置后看板显示估算成本 |
| `HF_ENDPOINT` | ❌ | 本地 embedding 模型的下载镜像 |

首次访问会自动建表并播种演示账号（`demo@ai-chat.com` / `demo123456`）。

## 部署

已适配腾讯云 CloudBase 云托管（容器）：

```bash
docker build -t ai-chat .
docker run -p 3000:3000 --env-file .env.local ai-chat
```

云托管配置要点：

- 构建目录 `/`，Dockerfile 名称 `Dockerfile`
- 服务端口 `3000`，访问端口 `80`
- 实例数最小 0 / 最大 1，规格 0.25 核 0.5G
- 请求超时 ≥ 60 秒（SSE 长连接需要）
- 环境变量：上表全部必填项

> `output: "standalone"` 已开启，镜像不含源码；`public` 与 `.next/static` 由 Dockerfile 显式拷贝。

## 测试

```bash
npm test
```

覆盖切片、重排、净化、Markdown 分块等单位测试，以及 embedding / LLM / RAG 集成测试（需真实 Key）。

## 已知限制

- 限流基于进程内存，单实例部署有效；多实例需换 Redis
- 会话是无状态 JWT，删除用户不会立刻吊销已签发的 token（最长 7 天）
- 跨境外置数据库（Supabase）延迟约 100–300ms，后续可迁至同区域
- 只开放演示账号，没有注册流程
