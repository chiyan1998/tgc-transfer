# 虎妞小猫学术信息中转站（TGC Transfer）— 设计总览（v3）

> **虎妞中转站**：一个面向科研人员的学术信息聚合平台。v1 核心是文献信息流——
> 滚动更新用户订阅的学术期刊、预印本（arXiv / NBER）与新书资讯，自动翻译并生成
> "快速概要"（领域/类型/问题/结论），协助发现附录与 Dataverse 等配套资源；
> 并为学术会议、基金资助、项目管理、阅读笔记等模块预留入口。

## 平台命名与品牌

| 项 | 内容 |
| --- | --- |
| 全称 | 虎妞小猫学术信息中转站 · Tiger Girl Cat Academia Information Transfer |
| 中文简称 | 虎妞中转站 |
| 英文简称 | TGC Transfer |
| 命名由来 | "虎妞"是用户的宠物猫（金渐层英短）；平台定位为学术信息的"中转站" |
| 图标 | 虎妞（金渐层英短）原创卡通吉祥物：[design/assets/tgc-mascot.png](./assets/tgc-mascot.png)（AI 原创生成，规避版权风险；后续可委托绘制正式版） |
| 项目代号 | 工作区目录沿用 `K1-文献集市`，产品对外名称为虎妞中转站 |

## 平台定位与模块地图

v1 交付「文献集市」核心，其余模块**只预留导航入口与路由占位**，不实现功能：

| 模块 | 路由 | 状态 | 说明 |
| --- | --- | --- | --- |
| 文献集市 | `/feed` `/sources` | **v1 核心** | 期刊 + arXiv + NBER + 书籍的聚合信息流、快速概要、资源发现 |
| 学术会议 | `/conferences` | 预留入口 | conference / meeting 信息收集平台（截稿日期、征稿等） |
| 基金资助 | `/funding` | 预留入口 | 基金 / 助学金 / 奖学金信息收集平台 |
| 项目管理 | `/projects` | 预留入口 | 工作与研究项目管理系统（复杂系统，仅留入口） |
| 阅读笔记 | `/notes` | 预留入口 | 文献阅读笔记快速生成平台（见下） |

**阅读笔记平台（未来模块）设计要点**：
- 接本地 **Obsidian vault** 目录（设置中配置路径），用用户自研的阅读技能按论文类型生成笔记，
  写入 vault 的特定目录（如 `ReadingNotes/`）；
- 支持**上传 PDF** 生成阅读报告（不依赖在线全文）；
- 与文献卡片的「深度阅读」功能**共用同一技能**（`ReaderSkill` 契约，见 architecture §3.3），
  深度阅读可视为该平台的在线先行形态。

**书籍源（books）设计要点**：
- 书籍几乎无在线全文，定位为**新书发布资讯**：以 Crossref 图书元数据为基础，按**出版社**粒度订阅；
- 卡片做翻译 + 基本信息（书名/作者/出版社/ISBN/出版日期/封面），**不进入**深度阅读与资源发现管线。

## 产品目标

| 目标 | 说明 |
| --- | --- |
| 聚合 | 期刊（Crossref）+ 预印本（arXiv、NBER）+ 新书资讯汇聚到一个信息流滚动浏览 |
| 个性化 | 每个用户维护自己的订阅源列表，并自定义刷新策略 |
| 无障碍阅读 | 自动翻译标题/摘要，生成"快速概要"：研究领域、论文类型、研究问题、研究结论 |
| 深度阅读 | 预留技能插槽：接入用户自定义阅读技能后按论文类型生成深度笔记（需 PDF） |
| 资源可达 | 尽力发现附录与数据集（Dataverse 等），提供下载链接或跳转 |
| 可扩展 | 会议/基金/项目/笔记模块预留入口，路由与导航配置驱动，后续独立演进 |

## 关键决策记录（v3）

| 决策点 | 结论 | 理由 |
| --- | --- | --- |
| 平台命名 | 虎妞中转站 / TGC Transfer | 用户指定，品牌资产（吉祥物图标）随设计交付 |
| 使用规模 | 个人/小团队，多用户+个性化订阅 | 需要账户体系，但无需配额/计费 |
| 期刊数据源 | Crossref API 为主 + 出版社 RSS 补充 | 元数据最全，免费无需 Key |
| 预印本源 | v1：arXiv 官方 API + NBER 官方 RSS；SSRN 仅预留 | arXiv/NBER 有官方接口；SSRN 无官方 API |
| 书籍源 | Crossref 图书元数据（`type=book`），按出版社订阅 | 新书资讯定位；无全文，不做深度阅读 |
| 预留模块 | 会议/基金/项目/笔记：导航配置驱动 + 路由占位页 + 接口统一 501 | 入口先行，不拖慢 v1；后续模块独立路由组演进 |
| 密钥安全 | 只经服务端环境变量注入；启动自检 + 日志脱敏 + 出站 SSRF 防护 | 用户自带 LLM Key，五层防护见 architecture §7 |
| AI 快速概要 | 入库自动执行：一次 LLM 调用完成翻译 + 四要素（领域/类型/问题/结论），类型五分类多标签 | 默认卡片信息，零操作、低时延 |
| 深度阅读 | 预留 `ReaderSkill` 插槽（占位），与未来阅读笔记平台共用技能 | 依赖外部技能，先冻结接口 |
| OA PDF 发现 | Crossref `link` + Unpaywall | 免费（仅需 email），合法 OA 直链 |
| 技术栈 | Next.js 15 全栈 + TypeScript + SQLite | 单项目覆盖前端、API、定时任务、后台队列 |
| 数据库管理 | 独立模块 `server/db/db-manager.ts` | 建库/迁移/备份/统计集中管理 |
| 部署形态 | 自托管 Node 服务（Docker 可选） | 本地文件系统可写是 Obsidian 集成的前提 |

## 文档索引

| 文档 | 内容 |
| --- | --- |
| [architecture.md](./architecture.md) | 系统架构、模块划分、各管线、预留模块架构、安全设计 |
| [product-design.md](./product-design.md) | 功能范围、页面结构、交互流程、预留模块占位页规范 |
| [data-model.md](./data-model.md) | 数据库表结构与关系（含论文类型分类学） |
| [api-design.md](./api-design.md) | REST API 接口设计（含预留模块约定） |
| [roadmap.md](./roadmap.md) | 技术栈、环境变量、里程碑与风险 |
| [assets/tgc-mascot.png](./assets/tgc-mascot.png) | 虎妞吉祥物图标（原创生成） |

## 项目目录规划（实施时）

```
K1-文献集市/
├── design/                  # 本设计文档（含 assets/ 品牌素材）
├── src/
│   ├── app/                 # Next.js App Router（页面 + route handlers）
│   │   ├── (auth)/          # 登录/注册
│   │   ├── (main)/          # 文献集市：信息流、源中心、收藏、设置
│   │   ├── (reserved)/      # 预留模块占位页：conferences/funding/projects/notes
│   │   └── api/             # REST API
│   ├── server/              # 服务端核心（与 UI 解耦，可独立单测）
│   │   ├── db/
│   │   │   ├── db-manager.ts    # 数据库管理：建库/迁移/备份/统计
│   │   │   ├── schema/          # numbered SQL 迁移
│   │   │   └── repositories/    # 各表数据访问
│   │   ├── ingest/          # 多源抓取：crossref / crossref-books / arxiv / nber / rss
│   │   ├── pipeline/        # 任务队列、概要生成、PDF探测、资源发现
│   │   ├── deep-read/       # ReaderSkill 插槽（占位；未来阅读笔记平台共用）
│   │   ├── scheduler/       # node-cron 调度 + 登录触发刷新
│   │   ├── security/        # 密钥脱敏、出站 SSRF 防护
│   │   └── llm/             # OpenAI 兼容客户端（限流/重试/用量）
│   ├── lib/
│   │   └── modules.ts       # 模块注册表：导航项、路由、状态（可用/规划中）
│   ├── components/          # UI 组件（shadcn/ui + 业务组件）
│   └── app shell            # 顶栏/侧边导航由 modules 注册表驱动渲染
├── data/                    # SQLite 数据文件（运行时生成，不入库）
│   └── backups/             # SQLite 备份
└── .env.local               # LLM Key、Unpaywall email 等（.gitignore）
```
