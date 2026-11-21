# Tag 自动发布与回滚

本项目的生产发布规则：只有推送形如 `v1.2.3` 的 Git Tag 才会部署；普通 `main` 提交仍只运行 CI。发布工作流先验证类型、前端测试、服务端协议测试与带同步地址的生产构建，再通过 SSH 发布该 Tag 的精确提交。

当前线上形态已经核实为：Ubuntu 上的宿主机 Nginx 提供静态网页，`/api/` 反代 `server-pocketbase-1`；Caddy `web` 服务不启动。发布脚本固定 Compose 项目名为 `server`，因此复用既有 `server_pb_data` 数据卷，绝不新建空库。

## 一次性服务器准备

以下命令仅首次执行。创建的部署用户需要能访问 Docker（Docker 组等价于较高权限，只应授予自动部署用途的 SSH Key）；不要使用日常密码或把 `.env` 提交到仓库。

```bash
sudo useradd --create-home --shell /bin/bash yaoshitu-deploy
sudo usermod -aG docker yaoshitu-deploy
sudo install -d -o yaoshitu-deploy -g yaoshitu-deploy /opt/yaoshitu-releases /var/lib/yaoshitu-deploy
sudo install -d -o yaoshitu-deploy -g yaoshitu-deploy /var/www/yaoshitu-releases
sudo ln -sfn /var/www/yaoshitu-v0.2.0-dev /var/www/yaoshitu-current
```

让部署用户可读取现有工作区和 Compose 所需 `.env`，但不要放宽给其他用户。Docker 组成员本身可取得主机高权限，因此这里不存在“给了 Docker 但仍低权限”的安全假设。

```bash
sudo chown -R yaoshitu-deploy:yaoshitu-deploy /opt/yaoshitu
sudo chmod 750 /opt/yaoshitu/server
sudo chmod 640 /opt/yaoshitu/server/.env
```

为 `yaoshitu-deploy` 创建一对专用 ED25519 SSH Key，将公钥放入 `/home/yaoshitu-deploy/.ssh/authorized_keys`；私钥只保存到 GitHub Secret，禁用该用户密码登录。服务器私钥、`.env`、PocketBase 密钥和 OAuth Secret 都不能上传 GitHub。

将实际启用的 `yaoshitu.xyz` HTTPS Nginx server 块中的前端根目录改为以下稳定链接（只改这个 `root`，不要用仓库的 HTTP 模板覆盖 Certbot HTTPS 配置）：

```nginx
root /var/www/yaoshitu-current;
```

然后验证并重载：

```bash
sudo nginx -t && sudo systemctl reload nginx
```

## GitHub 配置

仓库 Settings → Secrets and variables → Actions 中添加以下 **Secrets**：

| 名称 | 内容 |
| --- | --- |
| `DEPLOY_HOST` | 服务器主机名或 IP |
| `DEPLOY_USER` | `yaoshitu-deploy` |
| `DEPLOY_SSH_PORT` | SSH 端口，通常为 `22` |
| `DEPLOY_SSH_KEY` | 专用部署私钥完整内容 |
| `DEPLOY_KNOWN_HOSTS` | 经人工核验指纹后的 `ssh-keyscan -H <host>` 输出 |

`DEPLOY_KNOWN_HOSTS` 不应在 CI 临时使用 `accept-new` 生成；先通过可信渠道核对服务器主机指纹，再保存结果。GitHub Environment `production` 不设置审批人即可全自动发布；若以后希望每次发布人工放行，可在该 Environment 添加 required reviewers。

## 发布与回滚行为

```bash
git tag -a v0.2.1 -m "v0.2.1"
git push origin v0.2.1
```

工作流在服务器为 Tag 创建独立 Git worktree、构建前端和 PocketBase 镜像、先探测新 PocketBase 健康状态，最后原子替换静态前端软链接。任一步失败时脚本会恢复前一个静态链接和之前运行的 PocketBase 镜像。

PocketBase 数据库迁移可能不可逆：自动回滚优先恢复可运行的应用镜像，不能承诺任意破坏性 schema 迁移都能无损降级。发布涉及删除/改名字段时，应先做数据库快照并执行恢复演练。

首次启用前，建议从一个测试 Tag 验证：GitHub Actions 成功、`https://yaoshitu.xyz/api/health` 返回 200、登录与跨设备同步正常；确认后再将其作为常规发布方式。
