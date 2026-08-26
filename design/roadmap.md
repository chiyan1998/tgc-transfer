# 技术选型与开发路线图（v3）

## 1. 技术栈清单

| 类别 | 选型 | 说明 |
| --- | --- | --- |
| 框架 | Next.js 15（App Router）+ React 19 + TypeScript | 全栈单项目 |
| 样式/组件 | Tailwind CSS 4 + shadcn/ui | 快速搭建一致的信息流界面 |
| 数据库 | SQLite via better-sqlite3（WAL） | 同步 API、零运维；schema 迁移用自维护的 numbered SQL |
| 认证 | NextAuth v5（credentials provider）+ bcryptjs | 会话 JWT |
| 定时任务 | node-cron | 进程内调度抓取 |
| RSS/Atom 解析 | rss-parser | NBER RSS 与出版社补充源 |
| PDF 文本抽取 | pdf-parse | 无系统依赖，纯 JS |
| LLM 调用 | openai 官方 SDK（`baseURL` 指向任意兼容端点） | 快速概要 + 深度阅读共用，仅服务端持有密钥 |
| 校验 | zod | API 入参校验 |
| 测试 | Vitest + Playwright（冒烟） | |
| 部署 | Node 常驻进程，可选 Docker | 数据卷 `data/` |

环境变量（`.env.local`）：

```
LLM_BASE_URL=          # OpenAI 兼容端点
LLM_API_KEY=
LLM_MODEL=             # 如 gpt-4o-mini / deepseek-chat
LLM_CONCURRENCY=2      # 队列并发
UNPAYWALL_EMAIL=       # Unpaywall 必填
AUTH_SECRET=
ADMIN_EMAIL=           # 初始管理员
ALLOW_REGISTRATION=true
FETCH_INTERVAL_MIN=30
```

## 2. 里程碑（v2）

### M0 · 项目骨架与安全基座（0.5~1 天）

- Next.js + Tailwind + shadcn 脚手架，目录按 `design/README.md` 规划
- `db-manager.ts`：建库、numbered 迁移、备份、统计；全部建表（含 SSRN 预留字段）
- NextAuth 登录/注册 + 路由守卫；`security/mask.ts` + `ssrf-guard.ts` 先于一切出站调用落地
- LLM Key 启动自检（格式/连通性，脱敏报错）
- **验收**：能注册登录；密钥不出现在日志/响应（有测试）；备份可生成可还原

### M1 · 多源订阅与增量抓取（2 天）

- `/sources` 页：期刊搜索（Crossref）+ arXiv 分类勾选 + NBER 一键订阅 + 退订/单源刷新；SSRN 分区灰置
- 适配器：Crossref（ISSN 增量）、arXiv API（分类）、NBER RSS；`(source, external_id)` 去重、首次 30 天回填、预印本→正式发表 DOI 补录
- node-cron 调度 + 登录自动增量刷新（`user_settings`）+ 顶栏/单源手动刷新（防抖 60s）+ fetch_logs
- **验收**：订阅 Nature + arXiv econ.EM + NBER 后均有文章入库，重启不重复入库，登录触发刷新可见新增提示

### M2 · 信息流与快速概要（1~2 天）

- `/feed`：筛选、无限滚动、已读/收藏、增量提示、顶栏手动刷新
- 任务队列（优先级）+ 概要 Worker：一次调用完成翻译+四要素（领域/类型多标签/问题/结论），`paper-types.ts` 五分类定义注入提示词，JSON Schema 强约束，摘要缺失降级 `partial`
- 详情抽屉、中英切换；`/settings` 刷新策略设置页；`/saved`
- **验收**：新文章 5 分钟内出现四要素概要；类型标签可交叉；失败可重试

### M3 · OA 探测、资源发现与深度阅读插槽（1~2 天）

- `pdf_probe`：Crossref link + Unpaywall，标记 `is_oa`
- `resource_discovery`：附录/补充材料线索 + Zenodo/DataCite 数据集反查（含 Dataverse），卡片「查找附录/数据」与详情资源列表（下载/跳转）
- 书籍源：Crossref `type=book` 按出版社订阅适配器 + 简化书籍卡片（翻译+基本信息，无深度阅读/资源发现）
- `deep-read` 插槽：`ReaderSkill` 接口 + API 501 占位 + UI 置灰入口；技能上传后的加载方案文档化待接入（未来阅读笔记平台共用）
- **验收**：OA 文章可见 PDF 入口；有数据集的文章能发现 Dataverse 链接；深度阅读接口按契约返回 501；订阅出版社后有新书资讯入库

### M4 · 收尾（0.5~1 天）

- admin 面板：统计/抓取日志/数据库备份；旧数据清理任务；RSS 补充源接入完善
- 预留模块落地：`lib/modules.ts` 注册表 + `/conferences` `/funding` `/projects` `/notes` 占位页（笔记页含 Obsidian 配置与 PDF 上传禁用态入口）+ `/api/modules`
- 品牌落地：顶栏/登录页应用平台名「虎妞中转站 · TGC Transfer」与吉祥物图标；Dockerfile + 部署文档（含密钥安全说明）；Playwright 冒烟（含安全用例）
- **验收**：`docker compose up` 后全流程可用；备份/恢复验证通过

## 3. 已识别风险与对策

| 风险 | 对策 |
| --- | --- |
| SSRN 无官方 API | v1 仅预留数据模型；接入时再评估（网页抓取有 ToS 与稳定性风险） |
| NBER RSS 元数据较简 | 摘要尽量从落地页元数据补全；缺失标记 `incomplete`，概要走 `partial` 降级 |
| 部分期刊摘要在 Crossref 缺失 | RSS 补充 + `partial` 概要（仅翻译标题），UI 明示 |
| 出版社反爬/CDN 拦截 PDF 与附录 | 仅走 Unpaywall 认定的合法 OA 链接；失败优雅降级、保留外链 |
| LLM 成本/速率 | 批量概要、结果缓存、并发与 RPM 可配置；用量进 admin 面板 |
| 附录/数据集发现召回率有限 | 多路信号（元数据关键词 + Unpaywall + Zenodo/DataCite）；无结果明示而非误导 |
| Crossref/arXiv 收录时延 | 属外部约束，接受；个别时延大的刊用 RSS 抢时效 |
| 密钥泄露 | 五层防护（存储/自检/脱敏/SSRF/限流）+ 安全测试，见 architecture §7 |
| 书籍几乎无摘要/全文 | 概要降级为翻译+基本信息；出版社订阅噪声靠退订与后续关键词过滤 |
| 预留模块范围蔓延 | 严格执行"只留入口"：占位页 + 501 接口，不提前建表、不写业务逻辑 |
