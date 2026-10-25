# 邮箱密码登录部署：Ubuntu + Nginx + PocketBase

更新时间：2026-10-24。适用于当前服务器 `163.7.4.20`、域名 `yaoshitu.xyz`，项目目录 `/opt/yaoshitu`。

本次目标：邮箱 + 密码直接注册登录、GitHub 登录、首页显著的“登录 / 注册”入口。游客模式继续可用。邮箱验证、密码找回、SMTP 和邮件通知后置，当前不需要购买或配置发信服务。

**当前无用户，本次省略升级前备份步骤。** 保留现有数据库卷、`.env`、GitHub OAuth 配置及两个加密密钥；无需重新安装数据库或创建管理员。

## 一、先分清在哪台机器执行

- 标为 **Windows PowerShell** 的命令在自己的电脑执行。
- 标为 **Ubuntu** 的命令在 SSH 登录后的服务器执行，即提示符以 `root@iv-...` 开头的窗口。
- 每个代码块执行成功后再执行下一块；出现报错先停下，不要继续覆盖前端。

当前入口由宿主机 Nginx 提供：静态前端位于 `/var/www/yaoshitu-v0.2.0-dev`，`/api/` 转发到 `127.0.0.1:8090` 的 PocketBase。Compose 的 `web` 镜像只用于构建和导出前端，**不启动 Caddy 容器**。

本次必须同时升级前后端。只替换前端 ZIP，不会更新 PocketBase 的登录规则。

## 二、确认新源码已经推到 GitHub

邮箱简化登录的代码提交为 `59fd0b5`，旧 Tag `v0.2.0-dev` 不包含这次功能。服务器后续切换到这个明确提交，避免仍使用旧 Tag。

**Windows PowerShell**：如果新代码尚未推送，先执行下面命令。这里只推送已有提交，不需要提交 ZIP，不会创建新 Tag。

```powershell
# 进入电脑上的项目根目录。
Set-Location 'C:\PROJECT_DEV\要事\TODO_APP'

# 确认当前分支为 main，并查看最近提交。
git branch --show-current
git log -5 --oneline

# 把本机 main 的已有提交推到 GitHub；若当前不是 main，先停止核对。
git push origin main
```

若这次推送触发 GitHub Actions，确认对应 CI 通过后再继续。这里的命令是操作步骤，不代表已经替你推送或检查了远端 CI。

## 三、服务器检查现状

**Ubuntu**：

```bash
# 进入现有项目根目录，不重新 clone。
cd /opt/yaoshitu

# 查看当前提交：如果仍是 5df3d12，说明还在最初的旧版本。
git log -1 --oneline

# 查看服务器源码是否有手工修改，先看结果再进行第四节。
git status --short

# 确认磁盘可用空间；此前约有 9 GB 可用。
df -h /

# 确认当前 PocketBase 可用，预期输出 code 为 200。
curl -fsS https://yaoshitu.xyz/api/health
```

注意：`git status --short` 无输出代表工作区干净，直接进入第四节。若只有 `server/Dockerfile` 被修改，可能是之前手工添加 `ARG TARGETARCH=amd64` 的临时修复，按下面单独保存；新版本已包含正式架构兼容修复。

```bash
# 仅查看 Dockerfile 的差异；不输出 .env 或其他密钥。
git diff -- server/Dockerfile

# 若确认只有此前的架构临时修复，把这个文件的改动存入 Git stash。
# 只处理指定文件，不移动或覆盖 .env，也不会删除数据库。
git stash push -m 'deployment: preserve local Dockerfile fix' -- server/Dockerfile

# 再次查看状态；若仍有其他源码改动，先核对这些改动再切换版本。
git status --short
```

如果存在其他修改或未跟踪文件，不要运行 `git reset --hard` 或 `git clean`。保留输出并先核对，尤其不要删除 `.env`。保存的 Dockerfile stash 暂时保留即可，不需要再应用到新版。

## 四、下载并切换到邮箱登录版本

**Ubuntu**，确认第三节工作区问题已处理后执行：

```bash
# 保持在已有仓库内。
cd /opt/yaoshitu

# 获取 GitHub main 分支最新历史；浅克隆也可以执行。
git fetch origin main

# 确认 GitHub 获取的历史包含本次提交；应显示邮箱简化登录的提交说明。
# 如果报 unknown revision，停止：说明本机代码尚未成功推送，或本次 fetch 失败。
git show --no-patch --oneline 59fd0b5

# 切到已确认的部署提交；detached HEAD 是按提交部署时的正常状态。
git switch --detach 59fd0b5

# 确认现在确实是目标版本。
git log -1 --oneline

# 确认邮箱登录的两个新增迁移文件都在。
ls server/pb_migrations/
```

迁移目录应包含：

- `1792281600_sync.js`：原同步数据结构。
- `1792800000_email_auth.js`：启用邮箱密码注册，密码至少 12 位。
- `1792800001_email_basic.js`：关闭新设备登录邮件通知，当前不依赖 SMTP。

不要删掉较早迁移或手工清空迁移历史。历史迁移中的邮件模板不代表当前需要发信；现有前端不会调用验证或找回邮件接口。

## 五、校验配置并构建两个镜像

**Ubuntu**：

```bash
# 进入现有 Compose 配置目录；必须从这里管理原服务，复用原数据卷。
cd /opt/yaoshitu/server

# 确认原 .env 存在；不显示其中的密钥内容。
test -f .env && echo '.env 已存在，继续使用原配置'

# 校验 Compose 配置，不输出渲染后的敏感环境变量。
# 成功通常没有输出；失败则停下处理报错。
docker compose config --quiet

# 只构建镜像，不启动任何服务，也不抢占 80/443 端口。
# 首次构建可能下载依赖，等待命令成功结束。
docker compose build pocketbase web
```

若仍提示缺少 buildx，但构建继续执行，可先观察最终结果；新版 Dockerfile 已兼容此前的经典构建器架构问题。只有命令成功结束，才继续部署。

## 六、更新 PocketBase 后端

**Ubuntu**：

```bash
# 只更新 PocketBase；不启动 web/Caddy，不影响其他项目容器。
docker compose up -d --no-deps pocketbase

# 查看后端状态，预期 pocketbase 为 Up。
docker compose ps pocketbase

# 查看最近启动日志，确认没有迁移失败、缺少密钥或数据库错误。
# 日志用于自己检查；分享日志前遮住任何令牌或密钥。
docker compose logs --tail=80 pocketbase

# 从服务器回环地址检查 PocketBase，预期 code 为 200。
curl -fsS http://127.0.0.1:8090/api/health
```

PocketBase 启动时会应用尚未执行的迁移。现有参数 `--automigrate=false` 关闭的是开发期自动生成迁移文件，不会禁止执行已有迁移。镜像包含新版 hooks，因此本次升级会移除“邮箱未验证禁止密码登录”的限制。

如果健康检查刚好连接失败，先查看日志，等待服务完成启动，再重新执行检查。不要用删除数据卷来解决启动问题。

再验证公网登录方式：

```bash
# 仅输出认证方式，不显示 OAuth state、授权链接或密钥。
curl -fsS https://yaoshitu.xyz/api/collections/users/auth-methods |
python3 -c 'import json,sys; d=json.load(sys.stdin); print("邮箱密码登录:",d.get("password",{}).get("enabled")); print("OAuth提供商:",[p.get("name") for p in d.get("oauth2",{}).get("providers",[])])'
```

预期结果：

```text
邮箱密码登录: True
OAuth提供商: ['github']
```

如果 GitHub 列表为空，先通过原 SSH 隧道查看 `users → Options → OAuth2`，确认已有 GitHub 配置；不要重新生成 Client Secret。正式回调地址仍为 `https://yaoshitu.xyz/api/oauth2-redirect`。

## 七、导出新版静态前端

**Ubuntu**，确认后端健康后执行：

```bash
# 用新版镜像重新创建前端容器，但不启动它。
# --force-recreate 确保不是从旧容器里导出旧网页。
docker compose create --force-recreate web

# 确认前端容器名；当前项目预期为 server-web-1，状态为 Created 即可。
docker compose ps -a web

# 确认 Nginx 当前使用的静态目录存在。
# 此处沿用已有目录名，目录名带旧版本号不影响运行。
test -d /var/www/yaoshitu-v0.2.0-dev && echo '前端目录已存在'

# 从前端容器导出 /srv 的全部文件，更新 Nginx 的静态目录。
# Docker 支持从未启动的 Created 容器复制文件。
docker cp server-web-1:/srv/. /var/www/yaoshitu-v0.2.0-dev/

# 给 Nginx 读取文件和进入目录所需的权限。
chmod -R a+rX /var/www/yaoshitu-v0.2.0-dev

# 检查新首页能通过正式 HTTPS 域名返回，预期 HTTP 200。
curl -I https://yaoshitu.xyz
```

如果 `ps` 显示的容器名称不是 `server-web-1`，先把复制命令中的名称替换为实际名称。不要复制自旧镜像的容器。

本次不改 Nginx 配置，不需要 reload Nginx，也不需要重新签 HTTPS 证书。旧静态资源暂时保留，不影响新首页引用新版资源。

## 八、让浏览器加载新版

电脑浏览器：

1. 关闭之前的 GitHub 登录弹窗。
2. 打开 `https://yaoshitu.xyz`，按 F12。
3. 在 Application（应用）→ Service Workers 中点击 Update。
4. 等待新版 Service Worker 安装，再关闭所有要事图标签页并重新打开。
5. 首页上方应出现“登录 / 注册”。进入后有邮箱登录、注册账号和 GitHub 登录。

若仍旧显示旧界面，可先用无痕窗口打开网站作对照。不要点 Clear site data，不要删除 IndexedDB，这些操作会删除浏览器内的游客任务。手机先关闭原页面并重新打开；用新的浏览器会话确认新版是否已生效。

## 九、按顺序验收

### 1. 游客入口

未登录时首页可见“登录 / 注册”，原任务仍可查看和编辑。登录不是使用应用的前提。

### 2. 邮箱注册和登录

- 使用自己的邮箱，密码至少 12 位，并填写确认密码。
- 点击注册后应提示“注册成功，请使用邮箱和密码登录”。
- 直接使用刚才的邮箱密码登录，无需收邮件，无需邮箱验证。
- 登录后展示账号身份；退出后回到原游客空间。
- 错误密码应登录失败；重复邮箱不应生成第二个账号。

### 3. GitHub 登录

从首页账号窗口点击 GitHub 登录，授权后应返回账号空间。原 GitHub App 的 Homepage 和回调地址保持不变。不要把游客和不同账号的数据自动合并。

### 4. 两台设备同步

电脑邮箱登录后新建一条测试任务，再在手机用同一个邮箱账号登录，检查任务出现。电脑修改任务后检查手机更新。游客任务不会自动上传，需要明确选择“导入本机游客数据”。

### 5. PocketBase 后台

通过原 SSH 隧道访问后台，确认 `users` 中存在测试账号、`sync_documents` 在账号创建任务后出现记录。邮箱账号的 `verified=false` 是当前设计，不能手工批量改成 true 来绕过问题。

当前页面没有忘记密码、验证邮件和 SMTP 设置流程。现阶段请妥善保管密码；不能只凭对方说出一个邮箱就替其重置密码。

## 十、常见问题与检查命令

### 首页没有登录 / 注册

优先检查复制的容器是否是新版，以及浏览器的 Service Worker 是否已更新。仅重启 PocketBase 不会更新静态前端。

### 注册后仍提示需要验证邮箱

说明后端 hooks 仍是旧版，或页面仍是旧版。重新核对第四节提交和第六节后端更新；不要只重复覆盖 ZIP。

### 邮箱登录正常，但 GitHub 回调停住

```bash
# 检查 SSE 是否能建立连接，应出现 PB_CONNECT。
# 收到事件后，8 秒结束出现 curl 超时是预期行为。
curl -N -i --max-time 8 https://yaoshitu.xyz/api/realtime

# 检查无参数回调能否到达 PocketBase。
# 无授权参数时返回 307 到失败结果页属于正常现象。
curl -sS -D - -o /dev/null https://yaoshitu.xyz/api/oauth2-redirect
```

前端构建应包含 API 路径的 PWA 导航排除规则。不要把带 code/state 的真实授权链接发到聊天，也不要复用旧授权链接重试；从网站重新发起登录。

### 更新容器时提示 80 端口被占用

说明启动了 web/Caddy。当前 80/443 属于宿主机 Nginx，后端只用带 `pocketbase` 服务名的更新命令。静态导出只需要 create，不需要启动 web。

### 只想上传前端 ZIP

可以把 ZIP 解压到上述 Nginx 静态目录，但这只能替代第七节，不能替代后端源码、hooks 和迁移升级。当前不把 ZIP 提交到 Git。

### PocketBase 重启并提示迁移文件 permission denied

若日志出现 `open pb_migrations/1792800000_email_auth.js: permission denied`，说明镜像内的迁移文件不能被运行用户读取。只改宿主机权限而不重建镜像不会修复已生成的镜像。新版 Dockerfile 在 COPY 后、USER 前显式设置 hooks 和迁移目录权限为 755、文件为 644；服务器修正 Dockerfile 后，只重建并更新 pocketbase。不要改为 root 运行，不要使用 chmod 777，不要删除数据库卷或重置密钥。此修复的服务器启动结果仍需实际检查。

## 十一、从 Windows 安全打开 PocketBase 管理后台（SSH 隧道）

正式网站给普通用户使用，PocketBase 管理后台通过 SSH 隧道访问。这条隧道只影响后台访问，不影响网站用户登录。服务器 8090 继续只绑定回环地址，无需在安全组开放 8090 或 18090。

### 1. 在自己电脑打开 PowerShell

以下命令在 **Windows PowerShell** 中执行，不是在 Ubuntu 窗口中执行：

```powershell
# 把本机 18090 转发到服务器自身的 127.0.0.1:8090。
# -N：只建立隧道，不进入远程命令行。
# ExitOnForwardFailure：本机端口绑定失败时直接报错。
# ServerAlive 参数：连接空闲时发送保活，失联后结束连接。
ssh -N -L 127.0.0.1:18090:127.0.0.1:8090 -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -o ServerAliveCountMax=3 root@163.7.4.20
```

`127.0.0.1:18090` 是你电脑的入口；后面的 `127.0.0.1:8090` 是从服务器视角访问 PocketBase。root 是 SSH 账号。

第一次连接如提示确认主机指纹，应先与云服务器控制台提供的 SSH 主机指纹核对，再确认。已有正常连接记录通常不再提示。

### 2. 输入服务器 SSH 密码

看到 `root@163.7.4.20's password:` 时，输入服务器 root 的 SSH 密码，然后按回车。不是 PocketBase 管理员密码，也不是 GitHub 密码。

输入时**不显示字符、星号或光标移动是正常现象**。不要把密码粘贴到聊天或命令参数中。

- 仍停在 password 提示且尚未回车：正在等待输入密码。
- 输入并回车后，没有输出、没有重新出现 `PS C:\...>` 提示符：通常表示隧道已建立，命令正在持续运行。
- 出现 `Connection closed ...` 并回到 `PS C:\...>`：该次连接已经结束，隧道不可用；需要重新连接并排查原因。

**保持这个 PowerShell 窗口打开。** 不要在这里继续输入 Ubuntu 命令；需要操作服务器时另开一个 SSH 窗口。

### 3. 在同一台电脑的浏览器打开后台

```text
http://127.0.0.1:18090/_/
```

这里使用本地 HTTP 地址；电脑到服务器之间由 SSH 加密。不要改成 https，不要使用服务器公网 IP 加 18090，也不要用手机打开电脑上的 127.0.0.1 地址。

使用之前创建的 **PocketBase 管理员邮箱和密码**登录，不是 SSH root 密码。进入后可查看 `users`、`sync_documents`、`sync_receipts`。管理账号与普通网站用户是两套账号。

### 4. 用完如何关闭

在浏览器退出 PocketBase 管理账号。切回保持运行的 PowerShell 窗口，按 **Ctrl+C** 结束隧道；看到 `PS C:\...>` 即已返回本机命令行。关掉该窗口也会断开隧道，网站本身继续运行。

### 5. 连接被服务器关闭

一次 `Connection closed by 163.7.4.20 port 22` 不能直接判定为密码错误。先重新执行一次隧道命令并输入正确密码；若仍关闭，另开一个 Windows PowerShell，检查普通 SSH 是否可用：

```powershell
# 普通登录测试，不包含端口转发。
ssh root@163.7.4.20
```

若普通 SSH 也失败，先通过云厂商网页控制台登录服务器，检查 SSH 连接问题。不要为了修隧道随意修改 SSH 配置或重启 SSH 服务。

```bash
# 仅在 Ubuntu 或云厂商服务器控制台执行，查看 SSH 服务状态。
systemctl status ssh --no-pager

# 查看最近十分钟 SSH 日志，判断是认证、转发限制还是连接被断开。
journalctl -u ssh --since '10 minutes ago' --no-pager
```

如果普通 SSH 可以登录、仅隧道失败，在 Windows 用详细日志重试：

```powershell
# -v 输出连接过程，帮助区分认证成功与端口转发问题。
ssh -v -N -L 127.0.0.1:18090:127.0.0.1:8090 -o ExitOnForwardFailure=yes root@163.7.4.20
```

分享诊断日志前遮住个人路径、身份信息和任何令牌，不要发送密码或私钥。若报 `administratively prohibited`，需检查服务器或密钥的转发限制；不要直接开启所有转发权限。

### 6. 本机端口被占用

如果提示 `Address already in use` 或 `cannot listen to port: 18090`，可能之前的隧道仍在运行。优先使用原窗口对应的后台地址；不要重复建立相同端口的隧道。

也可以另选本机端口，例如 18091：

```powershell
# 仅更换本机入口端口，服务器 PocketBase 仍为 8090。
ssh -N -L 127.0.0.1:18091:127.0.0.1:8090 -o ExitOnForwardFailure=yes root@163.7.4.20
```

对应打开 `http://127.0.0.1:18091/_/`。

### 7. 隧道运行但网页打不开

先在另一个 Windows PowerShell 检查本机转发入口：

```powershell
# 明确使用 curl.exe，避免 PowerShell 中 curl 别名的差异。
# 预期返回 code 为 200 的健康 JSON。
curl.exe --max-time 10 http://127.0.0.1:18090/api/health
```

若健康检查成功，检查浏览器是否输入了正确的 `http://127.0.0.1:18090/_/`。若失败，在 Ubuntu 检查后端：

```bash
# 进入现有部署目录。
cd /opt/yaoshitu/server

# 确认 PocketBase 容器为 Up。
docker compose ps pocketbase

# 确认服务器本机可以访问后端。
curl -i --max-time 10 http://127.0.0.1:8090/api/health
```

服务器本机也失败时，先恢复 PocketBase，再重试隧道；隧道本身不会启动 PocketBase。

### GitHub 回调到 /_/#/auth/oauth2-redirect-success 却显示 Nginx 404

PocketBase 0.40.5 会把已处理的 OAuth 回调跳转到 `/_/` 下带 hash 的结果页；原 Nginx 的 `location ^~ /_/ { return 404; }` 连结果页也拦截了。修复采用 `location = /_/` 返回不含管理界面的简短提示页，其他 `/_/` 子路径继续拒绝访问；不要把整个管理后台反向代理到公网。`#` 及其后内容不发送给服务器，因此服务端不按 success/failure fragment 区分结果，提示页只要求回主页面查看登录状态，不宣称账号登录成功。

在现有域名站点的 HTTPS server 块内、原 `location ^~ /_/` 附近增加与仓库 nginx-site.conf 一致的精确匹配。不要用 HTTP 模板覆盖 Certbot 已配置的 HTTPS 站点。修改后先运行 `nginx -t`，通过后才运行 `systemctl reload nginx`。直接请求 `https://yaoshitu.xyz/_/` 应为 200；这只验证结果页面，不等同于完整 GitHub 登录验收。

若主页面仍未登录，在主页面开发者工具 Network 查看 `auth-with-oauth2` 的状态码和响应；回调 success 只说明授权码已交给实时连接，后续仍需完成换取用户身份。不要共享请求里的 code、codeVerifier、token 或 Client Secret。

### 点击 GitHub 登录却进入之前的邮箱账号

GitHub 登录请求必须显式设置空 Authorization，避免 PocketBase 将旧邮箱会话作为绑定目标；新版已增加此设置，并在 GitHub 授权 URL 中添加 prompt=select_account。该修改只需升级前端。不会自动解除之前已生成的 GitHub 关联；如果升级后仍返回同一用户，应在 PocketBase 后台查看该用户的外部认证关联，以及 GitHub 返回的邮箱是否与账号相同。相同邮箱的自动匹配仍属于 PocketBase 默认行为，不能仅凭界面显示邮箱判断实际登录方式。不要未经核对删除账号或关联，以免失去数据入口。
