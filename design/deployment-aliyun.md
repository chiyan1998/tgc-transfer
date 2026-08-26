# 阿里云上线方案（TGC Transfer）

> M2 迭代意见 3 产出：公开部署流程与费用估算；账号体系升级后补充邮件通道（§3.7）与上线后验收（§4）。
> 前提决策：**大陆节点 + 自有域名 + ICP 备案**。
> 适用对象：已购买阿里云轻量应用服务器（或 ECS）+ 已购买域名的站长本人，按章节顺序执行即可。

## 1. 为什么这样选型

| 选项 | 结论 | 理由 |
| --- | --- | --- |
| 轻量应用服务器（推荐） | ✅ 采用 | 常驻进程需求：SQLite 单文件数据库 + node-cron 定时抓取/摘要调度器必须常驻；新人价低、自带固定公网 IP |
| 函数计算 / Serverless | ❌ 不采用 | 冷启动无常驻进程，node-cron 调度无法运行；SQLite 依赖本地磁盘写，实例文件系统临时 |
| ECS 云服务器 | ⚠️ 等价可用 | 能力等价但同配置更贵、网络/安全组要自己配；已买 ECS 的按本文操作完全一样，防火墙改为「安全组」放行 |
| Vercel 等托管平台 | ❌ 不采用 | 无持久磁盘（SQLite 不可用）、无 cron 常驻、且国内访问需备案域名才可绑定 |

## 2. 推荐架构

```
用户 → 域名(已备案) → Nginx(443 HTTPS) → next start(3000, pm2 守护)
                                            ├── data/tgc.db（SQLite，本机磁盘）
                                            ├── data/uploads/（反馈附件）
                                            ├── node-cron 调度器（应用内常驻）
                                            └── 发信 → 阿里云邮件推送 SMTP（注册验证邮件）
```

## 3. 上线全流程（按顺序执行）

### 3.1 域名实名认证 + ICP 备案（最先做，约 1–3 周）

备案是最长的环节，先启动它，期间可并行做服务器环境。

1. **实名认证**：阿里云控制台 →「域名」→ 对域名完成实名认证（个人：身份证）。实名信息必须与后续备案主体一致。
2. **获取备案服务号**：大陆服务器（轻量应用服务器 / ECS 包月 ≥ 3 个月）购买后自带备案服务号，在「备案」控制台可查。
3. **提交备案**：阿里云控制台搜「ICP 备案」→ 首次备案 → 主体选「个人」→ 按引导填域名、上传身份证、人脸核验、填写网站用途（选「博客/个人空间」类，避免选需前置审批的类目）。
4. **流程与时长**：阿里云初审（1–2 天）→ 提交管局审核（各省 3–20 天不等）→ 短信核验（收到工信部短信后 24 小时内完成核验，**逾期作废需重提**，注意接听）。
5. **备案期间**：域名可以解析、可以开发测试，但**大陆服务器不能对外提供网站服务**（80/443 不要指向建站内容）。可先用服务器公网 IP 直接访问 3000 端口自测（不走域名、不对外宣传）。
6. **备案通过后**：阿里云「云解析 DNS」→ 添加记录：`A 记录 @ → 服务器公网 IP`、`A 记录 www → 服务器公网 IP`；如用二级域名发信（见 §3.7），也在此一并加解析。

### 3.2 服务器准备

1. **镜像**：轻量应用服务器选系统镜像 Ubuntu 22.04 或 Alibaba Cloud Linux 3（应用镜像无现成 Next.js，用系统镜像手动装）。已购服务器可在控制台「重置系统」换镜像（会清空数据，部署前做无妨）。
2. **密码/密钥**：控制台重置 root 密码，或上传 SSH 公钥（推荐密钥登录）。
3. **放行端口**：轻量服务器「防火墙」（ECS 为「安全组」）放行 `22`（SSH）、`80`、`443`。**不要**放行 3000（应用只经 Nginx 暴露）。
4. **记下公网 IP**：轻量服务器概览页可见，后面 DNS 解析与 SSH 都用它。

### 3.3 SSH 连接与环境初始化

```bash
ssh root@<服务器公网IP>

# 时区确认（轻量服务器默认东八区；若不是则设置）
timedatectl status || sudo timedatectl set-timezone Asia/Shanghai

# Node 20（nvm 方式，与本机开发一致，避免 better-sqlite3 的 ABI 不匹配）
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 20 && nvm use 20 && nvm alias default 20

# 进程守护与基础软件
npm i -g pm2
sudo apt update && sudo apt install -y nginx git
```

> 已购 ECS 若为 CentOS/Alibaba Cloud Linux，把 `apt` 换成 `dnf`/`yum` 即可，其余一致。

### 3.4 部署应用

```bash
git clone <你的仓库地址> /opt/tgc && cd /opt/tgc

# 环境变量（以 .env.example 为准逐项填写）
cp .env.example .env.local
chmod 600 .env.local
nano .env.local
#   必填：AUTH_SECRET（openssl rand -base64 32 生成）、AUTH_URL（https://你的域名）、
#         APP_BASE_URL（同 AUTH_URL）、LLM_*（全局概要模型）、ADMIN_EMAIL
#   发信：SMTP_* 见 §3.7；暂不配邮件也能跑，注册会降级提示

npm ci                 # better-sqlite3 会在本机按 Node 20 重新编译
npm run build          # 数据库迁移（001–006）在进程启动时自动应用

pm2 start npm --name tgc -- start   # 等价 next start，监听 127.0.0.1:3000
pm2 save && pm2 startup             # 开机自启（按提示再执行它输出的那一行）

pm2 logs tgc --lines 30             # 确认「已应用迁移」「运行时已启动」「LLM 自检通过」
```

**代码更新重发布**（以后每次迭代）：

```bash
cd /opt/tgc && git pull && npm ci && npm run build && pm2 restart tgc
```

### 3.5 Nginx 反代 + HTTPS

1. **申请证书**：阿里云「数字证书管理服务」→ 免费证书（单域名，1 年，可续）→ 绑定域名申请 → 下载「Nginx」格式 → 上传到服务器 `/etc/nginx/ssl/你的域名.pem|key`。
2. **配置**：`sudo nano /etc/nginx/conf.d/tgc.conf`：

```nginx
server {
  listen 80;
  server_name 你的域名.com www.你的域名.com;
  return 301 https://$host$request_uri;
}
server {
  listen 443 ssl;
  server_name 你的域名.com www.你的域名.com;
  ssl_certificate     /etc/nginx/ssl/你的域名.pem;
  ssl_certificate_key /etc/nginx/ssl/你的域名.key;
  client_max_body_size 32m;   # 反馈附件上传留余量
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;   # 注册 IP 频控依赖
    proxy_set_header X-Forwarded-Proto https;
  }
}
```

3. **启用**：`sudo nginx -t && sudo systemctl reload nginx`。
4. 证书到期前一个月重复「申请免费证书 → 替换文件 → `reload`」；或改用 `certbot`（Let's Encrypt）自动续期，二选一。

### 3.6 首位管理员与初始数据

- `.env.local` 的 `ADMIN_EMAIL` 填你自己的邮箱：首位注册该邮箱的用户自动成为 admin（已有种子逻辑）。
- 上线后第一件事：注册管理员账号 → 设置页配置「快速概要模型」（或确认 `.env.local` 的 LLM_* 生效）→ 订阅源管理。
- 开发库如需迁移上生产：本地 `data/tgc.db` 用 `sqlite3 data/tgc.db ".backup backup.db"` 导出后 `scp` 到服务器 `data/` 下再启动（**应用停止时**替换）。

### 3.7 邮件发送：阿里云邮件推送（DirectMail）配置

注册验证邮件的发信通道。**不需要买企业邮箱**，用「邮件推送」即可，与代码中 `src/server/email/mailer.ts` 的标准 SMTP 直接对接。

**① 开通服务**：阿里云控制台搜「邮件推送 / DirectMail」→ 开通（开通免费；每账户共 2000 封免费额度、每天最多免费 200 封，超出按量 2 元/1000 封——验证邮件场景基本零成本）。

**② 配置发信域名**（控制台左侧「发信域名」→ 新建）：
- 建议用二级域名（如 `mail.你的域名.com`），避免发信信誉影响主域名；
- 控制台给出若干 DNS 记录（SPF / MX / CNAME 等），照抄到「云解析 DNS」；
- 回到控制台点「验证」，一般几分钟到 1–2 小时通过。

**③ 新建发信地址**（「发信地址」→ 新建）：
- 地址如 `noreply@mail.你的域名.com`；
- 发信类型选**触发邮件**（注册验证属触发类）；
- 回信地址可填你的常用邮箱（可选，需验证）；
- 在操作列点「**设置 SMTP 密码**」——这是发信专用密码，**不是阿里云账号密码**，记下来。

**④ 写入 `.env.local` 并重启**：

```bash
SMTP_HOST=smtpdm.aliyun.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=noreply@mail.你的域名.com     # 完整发信地址
SMTP_PASS=<第③步设置的 SMTP 密码>
SMTP_FROM=虎妞小猫学术信息中转站 <noreply@mail.你的域名.com>
APP_BASE_URL=https://你的域名.com
```

```bash
pm2 restart tgc
```

**注意**：
- 阿里云 ECS/轻量服务器默认封禁 25 端口，务必用 **465（SSL）**；465 不通时退路是 `SMTP_PORT=80` + `SMTP_SECURE=false`。
- 新域名发信初期可能被个别收件方放入垃圾箱，属正常；注册验证邮件提醒用户检查垃圾邮件夹（界面已含文案）。
- 自测：服务器上无需真实收信也可验证连通性——直接注册一个你自己的真实邮箱，收到验证邮件点链接即可；未配置 SMTP 前注册会提示「邮件服务未配置」，也可用 `npm run dev:verify-user -- email=xx` 手动放行用户。

### 3.8 备份（上线当天就配）

`data/`（tgc.db + uploads/ + backups/）是唯一数据源。服务器上加一条每日备份：

```bash
sudo mkdir -p /opt/tgc-backup
crontab -e
# 每天 03:30 打包整个 data 目录，保留 14 天
30 3 * * * tar -czf /opt/tgc-backup/tgc-$(date +\%F).tar.gz -C /opt/tgc data && find /opt/tgc-backup -mtime +14 -delete
```

- 更稳妥：装 `ossutil` 把每日包同步到 OSS（约几元/月），实现异地备份。
- 应用内也内置了 `POST /api/admin/db/backup`（设置页 admin 区），可随时手动触发 SQLite 热备份到 `data/backups/`。
- **恢复**：停止应用（`pm2 stop tgc`）→ 解包覆盖 `data/` → `pm2 start tgc`。

## 4. 上线后验收清单（按序过一遍）

| # | 检查项 | 通过标准 |
| --- | --- | --- |
| 1 | `curl -I https://你的域名` | 301/200，证书有效（浏览器无警告） |
| 2 | HTTP → HTTPS 跳转 | 访问 `http://` 自动跳 `https://` |
| 3 | 管理员注册/登录 | 用 `ADMIN_EMAIL` 注册（收到验证邮件→激活→登录）或登录已有账号 |
| 4 | 验证邮件链路 | 注册新账号 → 收件箱/垃圾箱收到「激活你的虎妞小猫账号」→ 点链接 → 登录成功 |
| 5 | 抓取调度 | 订阅一个源点「立即更新」；`pm2 logs` 观察 cron 到点抓取 |
| 6 | 概要生成 | 信息流出现四要素概要；设置页「Token 消耗」有记账 |
| 7 | 备份 | `ls /opt/tgc-backup` 次日有包；设置页 admin 手动备份可用 |
| 8 | 重启自愈 | `reboot` 服务器后站点自动恢复（pm2 startup + nginx） |

## 5. 费用估算（首年）

| 项目 | 金额 |
| --- | --- |
| 轻量应用服务器 2C2G | 活动价约 100-800 元/年（常规续费约 700-1200 元/年） |
| 域名 .com | 约 55-75 元/年（.cn 约 29-39 元/年） |
| ICP 备案 | 免费 |
| SSL 证书 | 免费（单域名免费证书） |
| 邮件推送 | 免费额度内 0 元；超出按量 2 元/1000 封 |
| OSS 备份（可选） | 约几元/月 |
| LLM Token | 按用量：国产模型日常刷新+摘要约几元/月量级；OpenAI 兼容接口按实际调用计费 |
| **首年合计** | **约 800-1300 元 + Token 消耗** |

## 6. 应用侧上线注意事项

- `AUTH_URL` 必须改为正式 `https://域名`，否则 NextAuth Cookie 会失效；`APP_BASE_URL` 同域名（验证邮件链接前缀）。
- `AUTH_SECRET` 用新的随机值（`openssl rand -base64 32`），不要沿用本地开发值；改密钥会使所有已登录会话失效。
- `ALLOW_REGISTRATION`：上线初期建议保持 `true`（靠邮箱验证 + IP 频控防滥注）；仅小范围使用时可设 `false`，改由设置页「用户管理」手动建号。
- `data/` 目录权限：运行用户可读写即可；`.env.local` 权限 600。
- `next start` 单实例即可；SQLite WAL 模式下勿起多实例写同一库。
- 生产环境 node-cron 调度时区为服务器时区；轻量服务器默认东八区，无需额外配置。
- 找回密码本期未做：用户忘记密码时，管理员可用设置页「用户管理」重建账号，或后续迭代 `auth_tokens` 已预留 `kind='reset'`。

## 7. 日常运维速查

```bash
pm2 status                     # 进程状态
pm2 logs tgc --lines 100       # 实时日志（抓取/摘要/邮件错误都在这里）
pm2 restart tgc                # 重启
cd /opt/tgc && git pull && npm ci && npm run build && pm2 restart tgc   # 发布新版
sqlite3 /opt/tgc/data/tgc.db "SELECT COUNT(*) FROM articles;"            # 数据快查
sudo tail /var/log/nginx/error.log                                        # Nginx 错误
```
