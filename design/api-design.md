# REST API 设计（v3）

约定：所有接口以 `/api` 为前缀；除认证接口外均需登录态（JWT cookie）；
响应统一 `{ data?, error? }`；列表分页统一用游标参数 `cursor` + `limit`（默认 20）；
所有入参经 zod 校验；错误信息不含密钥与上游敏感细节（见 architecture §7）。

## 1. 认证

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/auth/register` | 注册（受 `ALLOW_REGISTRATION` 控制）`{email, password, name}`；密码强度 ≥8 位且含字母与数字；创建未验证用户并发送验证邮件（未配 SMTP 返 503）；IP 频控 10 次/小时；不自动登录 |
| GET | `/api/auth/verify?token=` | 邮箱验证：一次性 token（24h，库存 SHA-256 哈希），成功后 302 回 `/login?verified=1` |
| POST | `/api/auth/resend-verify` | 重发验证邮件 `{email}`；60s 冷却 + 每日 5 封上限；一律返成功防枚举 |
| POST | `/api/auth/login` | 登录（NextAuth credentials）；登录成功后按设置异步触发增量刷新；门禁：未验证→错误码 `unverified`，锁定中→`locked:剩余分钟`，连续 5 次失败锁 15 分钟 |
| POST | `/api/auth/logout` | 登出 |
| GET | `/api/auth/session` | 当前用户信息 |

## 2. 订阅源（期刊 / arXiv / NBER / 书籍）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/sources/journals/search?q=` | 透传 Crossref 期刊检索 `[{issn, name, publisher}]` |
| GET | `/api/sources/arxiv/categories` | arXiv 学科分类目录（供勾选订阅） |
| GET | `/api/sources/books/publishers?q=` | Crossref 出版社检索（供书籍订阅） |
| GET | `/api/sources` | 当前用户已订阅源（含最近抓取时间、上次新增数、`is_baseline`）；另返 `isAdmin`（前端控制基线开关可见性） |
| POST | `/api/sources` | 订阅 `{kind:"journal"\|"arxiv"\|"nber"\|"book", identifier}`；不存在则建档并触发首次回填 |
| DELETE | `/api/sources/:id` | 退订（不删除源记录本身） |
| PATCH | `/api/sources/:id` | 更新订阅设置（如补充期刊 `rss_url`） |
| POST | `/api/sources/:id/baseline` | `{baseline: bool}` 切换基线标记，仅 admin（403 拦截）；基线源抓取+摘要由全局模型承担 |
| POST | `/api/sources/:id/refresh` | 手动刷新单个源 |
| POST | `/api/sources/refresh-all` | 手动刷新全部订阅源（防抖 60s） |

## 3. 文章信息流

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/articles` | 信息流分页。参数：`source_id`、`platform`、`range=today\|week\|month\|quarter\|halfyear\|all`（默认 month，过滤优先用发表日期）、`read=0\|1`、`oa=1`、`cursor`、`q`（搜索：英文/中文标题、来源名，LIKE 参数化）、`kinds=journal,arxiv,nber`（来源类型多选）、`types=`（论文类型五分类多选，对概要 paper_types JSON 匹配）、`id=`（单篇查询，供卡片轮询待摘要状态，提供时忽略分页/筛选参数）。每条含快速概要与资源状态 |
| GET | `/api/articles/updates?since=<ISO时间>` | 增量探测：返回新文章数量（登录刷新完成后的顶部提示） |
| GET | `/api/articles/:id` | 详情（全文摘要、作者、卷期、概要、资源列表） |
| POST | `/api/articles/:id/brief` | 手动触发快速概要（基线分层）：已配置个人概要模型 → 以手动优先级入队并归属当前用户（豁免每日额度），201；未配置 → 400 提示去设置页 |
| POST | `/api/articles/:id/read` | 标记已读（支持批量 `{ids:[...]}`） |
| POST | `/api/articles/:id/star` | 收藏/取消 `{starred: bool}` |
| GET | `/api/articles/saved?cursor=` | 收藏列表 |

`GET /api/articles` 单条响应示例：

```json
{
  "id": 123, "externalId": "10.1038/s41586-...",
  "source": {"id": 1, "kind": "journal", "name": "Nature"},
  "title": "A Study of ...",
  "brief": {
    "status": "done",
    "titleZh": "基于...的研究",
    "field": "计量经济学",
    "paperTypes": ["quant_empirical", "methodology"],
    "researchQuestion": "...",
    "conclusion": "..."
  },
  "publishedAt": "2026-08-23",
  "publishedOnline": "2026-08-23",
  "publishedPrint": null,
  "volume": "116", "issue": "5", "page": "1023-1058",
  "isOa": true, "pdfUrl": "https://...",
  "resources": [{"kind": "dataverse", "label": "Replication Data", "url": "..."}]
}
```

## 4. 深度阅读（技能插槽，占位）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/articles/:id/deep-read` | 触发深度阅读。**当前返回 501** `{error:"阅读技能未安装"}`；技能上传后：入队高优任务，返回 `{taskId}` |
| GET | `/api/articles/:id/deep-read` | 查询状态/结果（前端轮询） |

接口契约（`ReaderSkill`）已冻结：输入 `{article, pdfText, paperTypes}`，输出 Markdown 笔记；
技能文件由用户上传，加载逻辑待技能交付后实现。

## 5. 附录与数据集

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/articles/:id/resources/discover` | 触发资源发现（高优任务）；有缓存直接返回 |
| GET | `/api/articles/:id/resources` | 资源列表 `[{kind, label, url}]`，前端直接渲染为下载/跳转链接（`rel="noopener"` 新标签页） |

## 6. 用户设置与模型配置 / 用量统计

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/settings` | 当前用户偏好；另返 `account:{name, email, role, verified}` 供设置页账号区 |
| PATCH | `/api/settings` | `{autoRefreshOnLogin, refreshIntervalMin, defaultLang, obsidianVaultPath?}`；`obsidianVaultPath` 为阅读笔记平台预留，接受但功能未启用 |
| PATCH | `/api/settings/profile` | 修改昵称 `{name}`（1–64 字符） |
| POST | `/api/settings/password` | 修改密码 `{oldPassword, newPassword}`：校验旧密码，新密码强度同注册规则 |
| GET | `/api/settings/llm` | 模型配置：brief（全局最新一条）/ briefPersonal（本人 `brief_personal` 槽）/ notes（本人），Key 仅回显掩码；含 `isAdmin`、`briefEnvFallback`、`briefEffective` |
| PUT | `/api/settings/llm` | `{slot:"brief"\|"brief_personal"\|"notes", baseUrl, model, apiKey?}`；`apiKey` 留空沿用已存；brief 槽仅管理员可写（403 拦截），brief_personal/notes 每用户可写 |
| DELETE | `/api/settings/llm?slot=` | 清除配置（brief 仅管理员） |
| POST | `/api/settings/llm/test` | 测试连接（调用 models.list，错误脱敏，支持三槽） |
| GET/PUT | `/api/settings/quota` | 个人自动摘要额度：GET 返 `{briefDailyCap, prioritySourceIds, usedToday}`；PUT 校验上限 0–1000 整数（0=仅手动）且优先源必须全部为已订阅源 |
| GET | `/api/stats/usage?days=90` | Token 消耗：按日×4 时段聚合 `cells` + `totals{today, week, all}`，供仪表盘热力图 |
| GET | `/api/stats/feed` | 信息流统计行：`{total, briefed, lastFetchAt}`（订阅范围内总数/已摘要数/最近抓取时间） |
| POST | `/api/feedback` | 用户反馈：multipart `summary`（必填）+ `detail` + `files`（图片/PDF，≤10MB，最多 3 个）；附件存 `data/uploads/YYYYMM/<uuid>.<ext>`，相对路径数组入库 `feedbacks` |

## 7. 管理/系统（role=admin）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/admin/stats` | 概览：源数、文章数、队列积压、今日 LLM 用量 |
| GET | `/api/admin/fetch-logs?source_id=` | 抓取日志 |
| GET | `/api/admin/db` | 数据库统计（各表行数、体积、最近备份时间） |
| POST | `/api/admin/db/backup` | 立即备份至 `data/backups/`（db-manager） |
| GET/POST | `/api/admin/users` | 用户列表 `{id,name,email,role,verified,createdAt}` / 创建账号（直接已验证，随机密码一次性回显） |
| PATCH | `/api/admin/users/:id` | `{role?, verified?}`：升降角色（不可降级自己）；手动标记已验证 |

## 8. 预留模块约定（会议 / 基金 / 项目 / 笔记）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/modules` | 模块注册表：`[{key, route, label, status:"active"\|"planned"}]`，导航据此渲染 |
| ANY | `/api/conferences/*`、`/api/funding/*`、`/api/projects/*`、`/api/notes/*` | 未启用前统一返回 501 `{error:"模块规划中"}`；启用后沿用本文档鉴权、校验与错误码约定 |

## 9. 错误码约定

| HTTP | 场景 |
| --- | --- |
| 401 | 未登录 |
| 403 | 无权限（如普通用户访问 admin 接口） |
| 404 | 资源不存在 |
| 409 | 重复订阅 / external_id 冲突 |
| 422 | 参数校验失败（body 附字段级错误） |
| 429 | 手动刷新/用户触发操作防抖期内重复请求 |
| 501 | 深度阅读技能未安装 / 预留模块未启用 |
| 502 | 上游依赖失败（Crossref/LLM/Unpaywall），body 附 `upstream` 类别码（不含细节） |
