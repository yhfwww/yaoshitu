# Ubuntu 部署要事图 v0.2

目标域名：`yaoshitu.xyz`（2026-10-23 确认使用，尚未验证注册归属、DNS 或证书）。使用 Docker Compose：Caddy 提供 HTTPS 和静态网页，PocketBase 0.40.5 管理 SQLite。镜像版本固定；升级前先验证迁移和恢复。

## 1. 准备域名与配置

在 Ubuntu 安装 Docker Engine 与 Compose 插件，把域名 A 记录指向服务器；仅在 IPv6 可用时添加 AAAA。允许 80/443 入站，8090 只绑定服务器回环地址。

首次部署先检查 Ubuntu 版本、内存、磁盘、Docker 和 80/443 端口占用。若已有宝塔、1Panel、Nginx 或 Caddy 承载其他网站，先复用已有 HTTPS 入口，不直接启动本 Compose 的 web 服务抢占端口。Docker 安装步骤以官方 Ubuntu 文档为准：https://docs.docker.com/engine/install/ubuntu/ 。

DNS 根域名记录为 `@`、类型 `A`、值为服务器公网 IPv4。初次验收先使用直连解析；确认 HTTPS、OAuth 和同步后，再决定是否启用 Cloudflare 代理。域名未注册、解析未生效时，不视为已完成部署。

将整个工程放到服务器，进入 `server/`。复制 `.env.example` 为 `.env`，设置：

```dotenv
APP_DOMAIN=yaoshitu.xyz
YAOSHITU_DATA_KEY=独立生成的32位随机英文字母数字
YAOSHITU_SETTINGS_KEY=另一个独立生成的32位随机英文字母数字
```

上面密钥值是说明，不能原样使用。可在密码管理器分别生成两个随机 32 位字母数字密钥；`.env` 设为仅部署用户可读。不要提交、发送到聊天或放进 `VITE_*`。密钥单独离线备份，重启和升级时保持不变；丢失数据密钥将无法恢复业务内容。

```sh
docker compose up -d --build
```

首次初始化通过下一节的本地管理界面创建超级用户。这是后台管理员凭据，不是用户邮箱登录入口。

### 构建报错：缺少 Buildx，PocketBase 下载 404

`TARGETARCH` 的自动值由 BuildKit 提供。没有 Buildx 而回退到旧构建器时，旧版 v0.2.0-dev 标签的该参数会为空，下载 URL 变成 `linux_.zip`。当前 Dockerfile 已增加容器架构检测，支持 amd64/arm64，并拒绝不支持的架构。

若服务器已固定在旧标签、且确认 `uname -m` 为 `x86_64`，可在 `server/` 下暂时修正为：

```sh
sed -i 's/^ARG TARGETARCH$/ARG TARGETARCH=amd64/' Dockerfile
docker compose up -d --build
```

此方式无需替换现有 Docker 引擎，不修改 `.env`、密钥或数据卷。后续安装 Buildx 应匹配现有 Docker 软件包来源，不应为此直接卸载已有引擎。

## 2. 配置 GitHub OAuth

若宿主机已有 Nginx 并占用 80 端口，采用下文的现有 Nginx 分支；不运行 Compose 的 `web` 服务。独立 Caddy 分支与 Nginx 分支二选一。

通过 SSH 建立管理隧道：

```sh
ssh -L 8090:127.0.0.1:8090 你的部署用户@服务器地址
```

本机浏览器打开 `http://127.0.0.1:8090/_/`。公开站点屏蔽后台网页，管理通过此隧道进行。

全新实例先运行 `docker compose logs pocketbase`，找到一次性初始化链接，将其中主机部分改为 `127.0.0.1:8090`，保留完整路径和片段后在隧道内打开，完成超级用户初始化。不要公开或转发此链接。

在 GitHub Developer settings → OAuth Apps 新建应用：

- Homepage URL：`https://yaoshitu.xyz`
- Authorization callback URL：`https://yaoshitu.xyz/api/oauth2-redirect`

在 PocketBase 的 `users` 集合 Options → OAuth2，只配置并启用 GitHub，填写 Client ID 和 Client Secret。Secret 仅存在服务器设置里，不进入前端。邮箱密码登录由新增迁移启用，OTP 保持关闭，服务端钩子额外拒绝其他 OAuth 提供商。

前端构建已通过 Compose 使用 `VITE_POCKETBASE_URL=https://yaoshitu.xyz`。若修改域名，需要更新 GitHub 回调及重新构建前端。未配置服务地址的本地构建仅提供游客模式，不会自行联网。

## 3. 备份和恢复

迁移配置每日 03:00 UTC 自动快照，最近 7 份。进入后台 Settings → Backups 检查计划，配置专用的异地 S3 兼容存储；配置后手动创建一次快照并验证目标存储里存在。S3 凭据由 `YAOSHITU_SETTINGS_KEY` 加密保存；用户任务正文由 `YAOSHITU_DATA_KEY` 加密保存。备份对象访问设为私有。

上线前必须演练：在隔离目录或新容器恢复快照，提供相同的两个密钥，再验证账号、任务、归档、笔记和删除状态。使用内置快照接口；若直接复制 `pb_data`，必须先停服务保证一致性。对象存储若还有业务附件，需要独立规划备份，当前版本无附件。

注销删除当前在线数据，历史快照仍按 7 份轮换；异地对象的生命周期也需匹配该保留策略。不要对用户宣称历史快照立即被抹除。

## 4. 上线验收

1. GitHub 首次注册/再次登录成功；用户无需授权仓库读写权限。
2. 游客数据不自动上传；明确导入后账号空间有副本，退出后游客数据仍在。
3. 两台设备分别改标题与截止日期，联网后都保留；同字段冲突在设置可恢复旧值。
4. 断网修改、刷新、联网后补传；退出 A 再进入 B 不出现 A 的数据。
5. 回收站恢复、永久删除防复活、JSON 恢复、服务端快照恢复都通过。
6. 验证 HTTPS、SSE、后台私有访问和异地备份。

## 现有 Nginx 分支（2026-10-23）

已确认的服务器有默认站点监听 80、旧版要事图监听 5000。保留二者，新增 `yaoshitu.xyz` 域名站点，由宿主机 Nginx 提供静态网页并代理 PocketBase。此分支不再启动 Caddy 网页容器；后续不要直接运行无服务名的 `docker compose up -d`，以免再次尝试绑定 80/443。

前提：两个镜像已构建，`server-web-1` 处于 Created 状态，PocketBase 健康检查返回 200。从现有网页容器导出静态产物（Docker 支持从未运行的容器复制文件）：

```sh
mkdir -p /var/www/yaoshitu-v0.2.0-dev
docker cp server-web-1:/srv/. /var/www/yaoshitu-v0.2.0-dev/
chmod -R a+rX /var/www/yaoshitu-v0.2.0-dev
```

将本目录 `nginx-site.conf` 安装为 `/etc/nginx/sites-available/yaoshitu-domain`，软链接到 `/etc/nginx/sites-enabled/yaoshitu-domain`。先执行 `nginx -t`，仅在校验通过后 reload。该配置保持 `/api/` 路径不变、关闭 SSE 缓冲与 API 缓存，并屏蔽公开管理网页；后台仍通过 SSH 隧道访问。

通过本机 Host 请求确认站点：

```sh
curl -I -H 'Host: yaoshitu.xyz' http://127.0.0.1/
curl -sS -H 'Host: yaoshitu.xyz' http://127.0.0.1/api/health
```

HTTP 验证通过后，给域名站点配置受信任 HTTPS 证书及自动续期，再进行 GitHub 登录；不能把 HTTP 页面可见等同于部署完成。证书签发步骤以 Certbot Nginx 官方文档及实际安装方式为准。旧版 5000 端口和目录保持原样；如有本地任务，先从旧访问地址导出 JSON，再到新域名导入。

后续更新只重建前端镜像、导出新静态产物，再校验/切换 Nginx 站点；PocketBase 用 `docker compose up -d pocketbase` 单独管理，禁止删除 `pb_data` 数据卷或重新生成数据密钥。首次改成 Nginx 分支无需重建镜像、无需更换数据库。

## 本机开发和测试

前端 `src/.env.local` 可设置 `VITE_POCKETBASE_URL=http://127.0.0.1:8099`；本地 HTTP 仅允许回环地址。PocketBase 从本目录运行，设置数据密钥并执行：

```sh
./pocketbase serve --http=127.0.0.1:8099 --automigrate=false
node --test tests/merge.test.cjs
```

完整集成测试仅允许本机临时服务。设置 `PB_TEST_ADMIN` 和 `PB_TEST_PASSWORD` 为临时超级用户凭据，从仓库根目录运行 `node server/tests/integration.mjs`。可选 `PB_TEST_DATA` 指向临时 `data.db`，会额外验证 SQLite 正文非明文并生成恢复演练快照和 `.tmp/recovery-manifest.json`。测试创建的账号最终会清理。

恢复演练：将该快照解压到新的临时数据目录，以原数据密钥和相同 hooks 启动到 8100，再从根目录运行 `node server/tests/recovery.mjs`。本机开发未设置 settings 加密参数时只需数据密钥；生产 Compose 始终同时使用两个密钥。

## 邮箱密码登录与 SMTP

2026-10-24 新增邮箱密码直接注册登录，验证和找回密码后置；部署步骤见 [邮箱登录上线](../docs/email-auth-deployment.md)。GitHub 保留；邮箱用户注册后即可密码登录，无需 SMTP。
