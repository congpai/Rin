# Resend 访客评论回复邮件

本文档记录博客（Rin fork）中基于 [Resend](https://resend.com) 的访客评论回复通知实现，便于日后迁移到 SendGrid、Mailgun、阿里云邮件等其他平台。

## 功能说明

当有人**回复一条游客评论**（请求带 `replyToId`，且被回复评论的 `user_id` 为空）时，向该游客留下的 `guest_email` 发送通知邮件。

### 会发邮件

- 回复对象是游客评论（`userId` 为 `null`）
- 游客填写了有效邮箱
- Worker 已配置 `RESEND_API_KEY` 与 `RESEND_FROM`
- 回复人与被回复人邮箱不同（避免自己回复自己仍收信）

### 不会发邮件

- 回复的是登录用户评论
- 顶级评论（无 `replyToId`）
- Resend 未配置
- 被回复评论无邮箱或邮箱格式无效

---

## 环境变量（Cloudflare Worker）

| 变量 | 类型 | 说明 |
|------|------|------|
| `RESEND_API_KEY` | **Secret** | Resend API Key（形如 `re_...`） |
| `RESEND_FROM` | **Var / Secret** | 发件人，例如 `二打六博客 <notify@yourdomain.com>` |

### 部署与同步

- `RESEND_API_KEY` 列入 `cli/src/tasks/deploy-cf.ts` 的 `WORKER_SECRET_KEYS`，部署时通过 `wrangler secret bulk` 同步。
- `RESEND_FROM` 需在 Cloudflare Dashboard → Worker → Settings → Variables，或 `wrangler.toml` 的 `[vars]` 中单独配置（当前生成逻辑未写入 `wrangler.toml` 的 vars 块）。

### 类型声明

`server/worker-configuration.d.ts`：

```typescript
RESEND_API_KEY?: string;
RESEND_FROM?: string;
```

---

## 架构与调用链

```
评论创建 (comments.ts / moment-comments.ts)
    └── maybeNotifyGuestCommentReply()     ← server/src/utils/comment-reply-email.ts
            ├── 查询被回复评论的 guest_email
            ├── buildReplyEmailHtml()      ← 内联 HTML 模板
            └── sendResendEmail()          ← server/src/utils/resend.ts
                    └── POST https://api.resend.com/emails
```

**换邮件平台时**：通常只需替换 `resend.ts`（或新建 `email-provider.ts` 并改 import），`comment-reply-email.ts` 的业务与 HTML 可复用。

---

## 文件清单

### 新增（Resend 核心）

| 文件 | 作用 |
|------|------|
| `server/src/utils/resend.ts` | Resend HTTP 封装：`isResendConfigured`、`getResendConfigStatus`、`sendResendEmail` |
| `server/src/utils/comment-reply-email.ts` | 业务逻辑：校验、组信、调用发送 |
| `server/src/utils/__tests__/resend.test.ts` | Resend 单元测试 |
| `server/src/utils/__tests__/comment-reply-email.test.ts` | 回复邮件逻辑测试 |

### 修改（接入与数据）

| 文件 | 改动摘要 |
|------|----------|
| `server/src/services/comments.ts` | 文章评论创建后调用 `maybeNotifyGuestCommentReply` |
| `server/src/services/moment-comments.ts` | 动态评论创建后同上 |
| `server/src/services/config.ts` | 管理端测试接口 `POST /api/config/test-resend` |
| `server/src/utils/comment-parent.ts` | `replyToId` / `parentId` 校验与解析 |
| `server/src/db/schema.ts` | `guestEmail`、`replyToId` 字段 |
| `server/sql/0013.sql` | 迁移：为 `comments`、`moment_comments` 增加 `reply_to_id` |
| `server/sql/0010.sql` / `0011.sql` | 评论表含 `guest_email`（动态评论） |
| `cli/src/tasks/deploy-cf.ts` | `WORKER_SECRET_KEYS` 含 `RESEND_API_KEY` |
| `packages/api/src/types.ts` | API 类型：`guestEmail`、`replyToId` |
| `packages/api/src/schemas.ts` | 请求体校验 |
| `client/src/components/comment/comment_composer.tsx` | 游客邮箱、`replyToId` 提交 |
| `client/src/components/comment/comment_list.tsx` | 回复 UI、`replyToId` |
| `client/src/components/comment/comment_section.tsx` | 评论区 props |
| `client/src/utils/guest-comment-cache.ts` | localStorage 缓存游客姓名/邮箱 |
| `client/public/locales/zh-CN/translation.json` 等 | `guest_email_required`、`guest_email_placeholder` 等文案 |

---

## 核心 API（`resend.ts`）

```typescript
export type ResendEmailPayload = {
    to: string;
    subject: string;
    html: string;
};

export function isResendConfigured(env: Env): boolean;

export function getResendConfigStatus(env: Env): {
    hasApiKey: boolean;
    hasFrom: boolean;
    from: string;
    configured: boolean;
};

export async function sendResendEmail(
    env: Env,
    payload: ResendEmailPayload,
): Promise<{ ok: true } | { ok: false; error: string }>;
```

实现要点：使用 Worker 原生 `fetch` 调用 `https://api.resend.com/emails`，`Authorization: Bearer ${RESEND_API_KEY}`。

---

## 业务入口（`comment-reply-email.ts`）

```typescript
export async function maybeNotifyGuestCommentReply(options: {
    db: DB;
    env: Env;
    clientConfig: CacheImpl;
    origin: string;
    replyToId: number | null;
    replyContent: string;
    replyPending: boolean;
    replier: { userId?: number; guestName?: string; guestEmail?: string };
    page:
        | { type: "feed"; feedId: number; title: string }
        | { type: "moment"; momentId: number; title: string };
}): Promise<void>;
```

### 邮件内容

- **主题**：`【{站点名}】{回复者} 回复了您的评论`（站点名来自配置 `site.name`）
- **正文**：HTML，含回复摘要（去图后最多 300 字）、页面链接、待审核提示（若 `replyPending`）
- **链接**：
  - 文章：`{origin}/feed/{feedId}`
  - 动态：`{origin}/moments#id-{momentId}`

### 调用位置

- `server/src/services/comments.ts`：登录用户评论、游客评论创建成功后各调用一次（仅当存在 `replyToId` 时内部生效）
- `server/src/services/moment-comments.ts`：同上

邮件发送失败**不阻塞**评论创建，错误仅 `console.error`。

---

## 管理端测试接口

```
POST /api/config/test-resend
```

- **权限**：管理员（`admin`）
- **Body**：`{ "to": "your@email.com" }`
- **成功**：`{ "success": true }`
- **未配置**：`{ "success": false, "error": "Resend is not configured. Set RESEND_API_KEY and RESEND_FROM on the Worker." }`

实现：`server/src/services/config.ts`（`ConfigService` 内）。

示例（需带管理员 Cookie / Token）：

```bash
curl -X POST "https://blog.example.com/api/config/test-resend" \
  -H "Content-Type: application/json" \
  -d '{"to":"you@example.com"}'
```

---

## 数据库

### 表：`comments`、`moment_comments`

| 列 | 类型 | 说明 |
|----|------|------|
| `guest_email` | `text` | 游客邮箱（通知收件人） |
| `reply_to_id` | `integer` | 回复目标评论 ID（`ON DELETE SET NULL`） |

迁移文件：`server/sql/0013.sql`（`reply_to_id`）。

评论模型为**扁平一层**：`parentId` 表示挂在哪条根评论下，`replyToId` 表示「回复谁」（用于 UI 与邮件）。

---

## 日志关键字（Cloudflare Observability）

| 日志 | 含义 |
|------|------|
| `[comment-reply-email] skipped: Resend is not configured` | 未配置 API Key / From |
| `[comment-reply-email] skipped: not a thread reply` | 无 `replyToId` |
| `[comment-reply-email] skipped: reply target is a logged-in user comment` | 被回复者是登录用户 |
| `[comment-reply-email] skipped: guest email missing or invalid` | 无有效邮箱 |
| `[comment-reply-email] skipped: replier and recipient share the same email` | 同邮箱不重复通知 |
| `[comment-reply-email] sent to user@example.com` | 发送成功 |
| `[comment-reply-email] failed:` | 发送失败（含 Resend API 返回体） |

---

## 迁移到其他邮件平台

1. 新建 `server/src/utils/email-provider.ts`（或重命名 `resend.ts`），实现与 `sendResendEmail` 相同签名的 `sendEmail(env, payload)`。
2. 将 `comment-reply-email.ts` 中的 `import { ... } from "./resend"` 改为新模块。
3. 替换环境变量名（如 `SENDGRID_API_KEY`），更新：
   - `server/worker-configuration.d.ts`
   - `cli/src/tasks/deploy-cf.ts` → `WORKER_SECRET_KEYS`
4. 按需将 `POST /api/config/test-resend` 改为通用 `test-email`。
5. 更新本文档与单元测试。

**建议保留不变**：`comment-reply-email.ts` 的 HTML 模板、跳过逻辑、`comments.ts` / `moment-comments.ts` 的调用方式。

### 适配层最小接口示例

```typescript
// email-provider.ts（迁移目标）
export type EmailPayload = { to: string; subject: string; html: string };

export function isEmailConfigured(env: Env): boolean;

export async function sendEmail(
    env: Env,
    payload: EmailPayload,
): Promise<{ ok: true } | { ok: false; error: string }>;
```

---

## Resend 运维备忘

1. 在 Resend 控制台添加并验证发信域名（DNS：SPF / DKIM）。
2. `RESEND_FROM` 必须使用已验证域名下的地址。
3. 注意免费档日发送限额；失败时查 Worker Logs 中 `[comment-reply-email] failed`。
4. 建议配置 DMARC，降低进垃圾箱概率。
5. 测试顺序：先 `test-resend` → 再发真实回复评论验证。

---

## 相关文档

- [Resend API — Send Email](https://resend.com/docs/api-reference/emails/send-email)
- Cloudflare Workers [Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
