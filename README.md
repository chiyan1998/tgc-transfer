# 虎妞小猫学术信息中转站（TGC Transfer）

学术信息聚合平台：订阅期刊 / arXiv / NBER / 书籍 → 定时抓取 → AI 四要素概要 → 信息流浏览、收藏、引用生成。

- 产品与页面设计：[design/product-design.md](design/product-design.md)
- 接口清单：[design/api-design.md](design/api-design.md)
- 数据模型：[design/data-model.md](design/data-model.md)
- 架构与安全：[design/architecture.md](design/architecture.md)
- 阿里云上线方案：[design/deployment-aliyun.md](design/deployment-aliyun.md)

## 本地运行（任意一台机器）

### 1. 前置条件

- **Node 20**（必需，better-sqlite3 按 Node 版本编译）：推荐 `nvm install 20 && nvm use 20`（仓库自带 `.nvmrc`）。
- macOS/Linux 通常无需额外工具（better-sqlite3 有预编译二进制）；若报编译错误，macOS 装 Xcode Command Line Tools、Windows 装 VS Build Tools。

### 2. 安装与启动

```bash
git clone <本仓库地址> tgc && cd tgc
npm ci

# 环境变量：复制模板并填写
cp .env.example .env.local && chmod 600 .env.local
#   必填：AUTH_SECRET（openssl rand -base64 32 生成）
#   建议：ADMIN_EMAIL=<你的邮箱>（首位注册该邮箱的用户自动成为管理员）
#   可选：LLM_*（全局概要模型，不配则摘要功能不可用）
#   可选：SMTP_*（不配则注册走降级提示，见下方说明）

npm run dev          # 数据库与迁移（001-006）首次启动自动创建，见 data/tgc.db
```

打开 http://localhost:3000 → 注册 `ADMIN_EMAIL` 对应的账号 → 成为管理员。

### 3. 无 SMTP 时如何登录（本地测试常态）

未配置 `SMTP_HOST/USER/PASS` 时，注册会提示「邮件服务未配置」，此时用开发脚本直接放行：

```bash
npm run dev:verify-user -- email=你的邮箱
```

之后即可正常登录。配置了真实 SMTP（如阿里云邮件推送，见上线文档 §3.7）则走完整邮件验证链路。

### 4. 常用命令

```bash
npm run dev          # 开发模式（3000 端口）
npm run build && npm start   # 生产模式
npx tsc --noEmit     # 类型检查
npm run dev:verify-user -- email=xx   # 手动标记邮箱已验证（无 SMTP 环境）
```

## 说明

- `data/`（数据库/附件/备份）与 `.env.local` 均在 `.gitignore` 中，不进仓库；每台机器首次启动自动建库。
- 测试账号数据不随代码分发，本地从空库开始。
