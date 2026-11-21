# Tag 自动发布与回滚

本项目的生产发布规则：只有推送形如 `v1.2.3` 的 Git Tag 才会部署；普通 `main` 提交仍只运行 CI。发布工作流先验证类型、前端测试、服务端协议测试与带同步地址的生产构建，再通过 SSH 发布该 Tag 的精确提交。

当前线上形态已经核实为：Ubuntu 上的宿主机 Nginx 提供静态网页，`/api/` 反代 `server-pocketbase-1`；Caddy `web` 服务不启动。发布脚本固定 Compose 项目名为 `server`，因此复用既有 `server_pb_data` 数据卷，绝不新建空库。

## 一次性服务器准备

以下命令仅首次执行。创建的部署用户需要能访问 Docker（Docker 组等价于较高权限，只应授予自动部署用途的 SSH Key）；不要使用日常密码或把 `.env` 提交到仓库。

```bash
sudo useradd --create-home --shell /bin/bash yaoshitu-deploy
sudo usermod -aG docker yaoshitu-deploy
sudo install -d -o yaoshitu-deploy -g yaoshitu-deploy /opt/yaoshitu-releases /var/lib/yaoshitu-deploy
sudo install -d -o yaoshitu-deploy -g yaoshitu-deploy /var/www/yaoshitu-releases /var/www/yaoshitu
sudo ln -sfn /var/www/yaoshitu-v0.2.0-dev /var/www/yaoshitu/current
```

让部署用户可读取现有工作区和 Compose 所需 `.env`，但不要放宽给其他用户。Docker 组成员本身可取得主机高权限，因此这里不存在“给了 Docker 但仍低权限”的安全假设。

```bash
sudo chown -R yaoshitu-deploy:yaoshitu-deploy /opt/yaoshitu
sudo chmod 750 /opt/yaoshitu/server
sudo chmod 640 /opt/yaoshitu/server/.env
```

### 配置 GitHub Actions 的专用 SSH Key

这对密钥只供 GitHub Actions 登录 `yaoshitu-deploy` 使用，不能复用你自己的 SSH 私钥，也不要为它设置密码短语（当前工作流直接以私钥文件连接，无法交互输入密码短语）。**私钥绝不能粘贴到聊天、提交到仓库或上传到服务器。**

#### 1. 在 Windows 本机生成密钥

在 PowerShell 执行。首次输入密码短语时直接按两次 Enter，得到无密码短语的、仅用于自动部署的密钥：

```powershell
$key = "$env:USERPROFILE\.ssh\yaoshitu-deploy"
ssh-keygen -t ed25519 -a 100 -f $key -C "github-actions-yaoshitu-deploy"
```

确认得到两个文件：

- `$env:USERPROFILE\.ssh\yaoshitu-deploy`：**私钥**，只用于后续 GitHub Secret。
- `$env:USERPROFILE\.ssh\yaoshitu-deploy.pub`：**公钥**，只安装到服务器。

仅显示待复制的公钥；不要运行 `Get-Content` 查看私钥：

```powershell
Get-Content "$env:USERPROFILE\.ssh\yaoshitu-deploy.pub"
```

#### 2. 在 Ubuntu 安装公钥

保持已有的 root SSH 窗口打开。在服务器执行下面命令，其中第二条会打开编辑器；把上一步显示的**整行公钥**粘贴为一行后保存退出。不要粘贴 `.pub` 文件名，也不要粘贴私钥的 `BEGIN OPENSSH PRIVATE KEY` 内容。

```bash
sudo install -d -m 700 -o yaoshitu-deploy -g yaoshitu-deploy /home/yaoshitu-deploy/.ssh
sudoedit /home/yaoshitu-deploy/.ssh/authorized_keys
sudo chown yaoshitu-deploy:yaoshitu-deploy /home/yaoshitu-deploy/.ssh/authorized_keys
sudo chmod 600 /home/yaoshitu-deploy/.ssh/authorized_keys
```

#### 3. 先验证密钥登录，再禁用该用户密码登录

不要先修改 SSH 配置。另开一个 Windows PowerShell，用私钥测试；`id -un` 应输出 `yaoshitu-deploy`，且 `docker compose version` 必须显示 Compose 版本。如果失败，保留原 root SSH 窗口排查，不要关闭它。

```powershell
ssh -i "$env:USERPROFILE\.ssh\yaoshitu-deploy" -o IdentitiesOnly=yes yaoshitu-deploy@你的服务器IP "id -un; docker compose version"
```

若第一行已是 `yaoshitu-deploy`、第二行却显示 `docker: unknown command: docker compose`，说明密钥和 Docker 用户组都已生效，但 Compose 插件只安装在 root 的用户目录，对部署用户不可见。**先修复插件可见性，未通过前不要执行下一步的 SSH 密码禁用。**

在服务器的 root SSH 窗口执行以下只读查找：

```bash
sudo find /root/.docker/cli-plugins /usr/local/lib/docker/cli-plugins /usr/local/libexec/docker/cli-plugins /usr/lib/docker/cli-plugins /usr/libexec/docker/cli-plugins \
  -maxdepth 1 -type f -name docker-compose -perm /111 -print 2>/dev/null
```

若输出包含 `/root/.docker/cli-plugins/docker-compose`，把已由 root 正在使用的插件复制到 Docker 的系统级插件目录：

```bash
sudo install -D -m 0755 /root/.docker/cli-plugins/docker-compose /usr/local/lib/docker/cli-plugins/docker-compose
sudo -u yaoshitu-deploy docker compose version
```

最后一条必须显示版本号。若查找命令没有输出，或复制后仍找不到 Compose，不要自行下载二进制；先安装发行版/官方 Docker 源提供的 `docker-compose-plugin`，再重复验证。

确认成功后，仅针对部署用户禁用密码、交互式认证、端口转发和 TTY；不会影响 root 或你的日常 SSH 用户。服务器执行：

```bash
sudo tee /etc/ssh/sshd_config.d/80-yaoshitu-deploy.conf >/dev/null <<'EOF'
Match User yaoshitu-deploy
    PasswordAuthentication no
    KbdInteractiveAuthentication no
    AuthenticationMethods publickey
    AllowTcpForwarding no
    X11Forwarding no
    PermitTTY no
EOF
sudo sshd -t && sudo systemctl reload ssh
```

再重复上一条 Windows `ssh` 测试，确认密钥仍可登录。部署用户属于 Docker 组，而 Docker 组可获得主机高权限，因此这把私钥应视为生产管理员凭据：仅保存在 GitHub Secret 和你本机受保护的位置；完成 GitHub 配置与一次试发布后，可删除本机私钥副本。

#### 4. 核验主机指纹并准备 Known Hosts

不要把未经核验的 `ssh-keyscan` 结果直接信任。先在服务器控制台或已验证的 root SSH 会话执行，记下 ED25519 指纹：

```bash
sudo ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
```

在 Windows 执行下面命令，输出的 ED25519 指纹必须一致；其中 `你的服务器IP` 换成即将填写的 `DEPLOY_HOST`：

```powershell
ssh-keyscan -H 你的服务器IP 2>$null | ssh-keygen -lf -
ssh-keyscan -H 你的服务器IP 2>$null
```

第一条只用于比对指纹；第二条输出的一行或多行哈希主机记录，完整复制到 `DEPLOY_KNOWN_HOSTS` Secret。

若 `ssh-keyscan` 没有任何输出，管道后的 `ssh-keygen` 会提示“不是公钥文件”；这代表没有获取到主机公钥，**不能把空结果保存为 Secret**。此时可在已验证的服务器 root SSH 会话直接生成一条可用于 Known Hosts 的公开记录（主机公钥不是私钥）：

```bash
printf '你的服务器IP '
sudo cat /etc/ssh/ssh_host_ed25519_key.pub
```

把上面两行合并后的完整单行复制为 `DEPLOY_KNOWN_HOSTS`。例如格式为 `203.0.113.10 ssh-ed25519 AAAA...`；IP 必须与 `DEPLOY_HOST` 完全一致。也可以从 Windows 已信任记录中读取：

```powershell
ssh-keygen -F 你的服务器IP -f "$env:USERPROFILE\.ssh\known_hosts" | Select-String -NotMatch '^#'
```

将实际启用的 `yaoshitu.xyz` HTTPS Nginx server 块中的前端根目录改为以下稳定链接（只改这个 `root`，不要用仓库的 HTTP 模板覆盖 Certbot HTTPS 配置）。链接放在 `yaoshitu-deploy` 可写的子目录中，发布脚本才能原子改名；**不要**让部署用户取得整个 `/var/www` 的写权限：

```nginx
root /var/www/yaoshitu/current;
```

然后验证并重载：

```bash
sudo nginx -t && sudo systemctl reload nginx
```

## GitHub 配置

仓库 Settings → Environments → `yaoshituLinux` → Add environment secret 中添加以下 Secrets（也可放在 Settings → Secrets and variables → Actions 的 Repository secrets；生产专用的值更推荐放进 `yaoshituLinux` 环境）。环境名必须与 `.github/workflows/release.yml` 的 `environment` 完全一致；不要误填到另一个同名/空白环境。

| 名称 | 内容 |
| --- | --- |
| `DEPLOY_HOST` | 服务器主机名或 IP |
| `DEPLOY_USER` | `yaoshitu-deploy` |
| `DEPLOY_SSH_PORT` | SSH 端口，通常为 `22` |
| `DEPLOY_SSH_KEY` | 专用部署私钥完整内容 |
| `DEPLOY_KNOWN_HOSTS` | 经人工核验指纹后的 `ssh-keyscan -H <host>` 输出 |

填写时：

- `DEPLOY_HOST` 填服务器公网 IP 或稳定域名，不要带 `https://`、端口、空格或路径。
- `DEPLOY_USER` 固定填 `yaoshitu-deploy`，`DEPLOY_SSH_PORT` 通常填 `22`。
- 在 Windows 本机将私钥直接复制进剪贴板，再粘贴为 `DEPLOY_SSH_KEY` 的完整值；这条命令不在终端显示私钥：

  ```powershell
  Get-Content -Raw "$env:USERPROFILE\.ssh\yaoshitu-deploy" | Set-Clipboard
  ```

- 将已在上一节核验指纹的 `ssh-keyscan -H` 完整输出粘贴为 `DEPLOY_KNOWN_HOSTS`。不要使用 `StrictHostKeyChecking=no` 或在 CI 中临时 `accept-new`。

保存 Secret 后，关闭包含私钥的剪贴板内容。GitHub Environment `yaoshituLinux` 不设置审批人即可全自动发布；若以后希望每次发布人工放行，可在该 Environment 添加 required reviewers。

## 发布与回滚行为

```bash
git tag -a v0.2.1 -m "v0.2.1"
git push origin v0.2.1
```

工作流在服务器为 Tag 创建独立 Git worktree、构建前端和 PocketBase 镜像、先探测新 PocketBase 健康状态，最后原子替换静态前端软链接。任一步失败时脚本会恢复前一个静态链接和之前运行的 PocketBase 镜像。

PocketBase 数据库迁移可能不可逆：自动回滚优先恢复可运行的应用镜像，不能承诺任意破坏性 schema 迁移都能无损降级。发布涉及删除/改名字段时，应先做数据库快照并执行恢复演练。

首次启用前，建议从一个测试 Tag 验证：GitHub Actions 成功、`https://yaoshitu.xyz/api/health` 返回 200、登录与跨设备同步正常；确认后再将其作为常规发布方式。
