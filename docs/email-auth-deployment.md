# 邮箱注册登录上线（2026-10-24）

邮箱 + 密码与 GitHub 登录共用 `users` 集合和原同步协议，游客空间继续保留。邮箱注册后发送验证邮件，验证前不能密码登录。首页上方提供“登录 / 注册”；账号窗口与设置页均提供注册、登录、重发验证、找回密码。密码至少 12 位，由 PocketBase 哈希保存，前端不持久保存密码。

## 1. 准备发信服务

可采用 Resend 的 SMTP 服务。先注册账号，在 Domains 添加发信域名（例如 `mail.yaoshitu.xyz`），到阿里云 DNS 按服务商显示的主机名、类型和值逐条添加验证记录。不要改动现有网站 A 记录和 NS；若同一主机名已有 SPF，应按服务商指引合并，不能重复创建多条 SPF。等待服务商验证通过，再创建限定发信权限及对应域名的 API Key。

参考：[Resend SMTP](https://resend.com/docs/send-with-smtp)、[域名验证](https://resend.com/docs/dashboard/domains/introduction)。实际额度、资费和可用性以服务商当前账户为准。

## 2. 配置 PocketBase

通过原 SSH 隧道进入 `http://127.0.0.1:18090/_/`，在 Settings → Application 中设置 Application URL 为 `https://yaoshitu.xyz`，名称设为“要事图”。不能填本地管理后台地址。

进入 Settings → Mail settings，设置发件人名称“要事图”，发件地址使用已经验证域名下的地址（例如 `noreply@mail.yaoshitu.xyz`）。启用 SMTP：

| 字段 | Resend 示例 |
| --- | --- |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | 发信 API Key（直接填后台，不发到聊天） |
| TLS | 开启，465 使用直接 TLS |

保存后使用后台测试邮件功能，确认真实邮箱收到邮件。发送密钥仅存 PocketBase 设置；生产启动必须继续保留 `--encryptionEnv=YAOSHITU_SETTINGS_KEY`，不要更换现有两个密钥。

## 3. 升级 Ubuntu

先在 PocketBase 后台创建一次备份，并独立保管原 `.env`。把本次源码更新到 `/opt/yaoshitu` 后，在 `/opt/yaoshitu/server` 执行：

```sh
docker compose build pocketbase web
docker compose up -d --no-deps pocketbase
docker compose create --no-deps web
docker cp server-web-1:/srv/. /var/www/yaoshitu-v0.2.0-dev/
chmod -R a+rX /var/www/yaoshitu-v0.2.0-dev
curl -fsS https://yaoshitu.xyz/api/health
```

不要执行无服务名的 `docker compose up -d`，宿主 Nginx 占用 80/443。不要删除数据卷。`--automigrate=false` 只关闭开发自动生成迁移文件，启动仍会应用仓库内未执行的迁移。

新增迁移 `1792800000_email_auth.js` 只打开邮箱密码注册并修改验证/重置邮件模板，不覆盖已有 GitHub Client ID/Secret。确认 `users` 的 Password auth 已开启，identity field 为 email。原管理员密码登录不受邮箱验证钩子影响。

静态前端更新后，在浏览器 Service Workers 中更新并关闭旧标签页后重开；不要清除 IndexedDB 或整站数据。API 和管理路径已排除在 PWA 导航回退之外，邮件验证和重置使用应用首页的 hash 页面，无需公开 PocketBase 管理后台。

## 4. 上线验收

1. 桌面和手机均能看到“登录 / 注册”；游客任务仍可正常使用。
2. 注册新邮箱，验证前登录被拒绝；收到邮件后打开链接，点击确认验证，再登录成功。
3. 发起找回密码，邮件链接可设置新密码；旧密码失效，新密码可登录。链接过期、重复使用时有失败提示。
4. 在账号内创建任务，另一台设备邮箱登录能同步；退出后游客任务保持原样。
5. GitHub 登录继续验收。已有 GitHub 账号需要邮箱密码时，使用该账号已验证邮箱走找回密码，不重新注册重复邮箱；是否同一账号以后台用户 ID 为准，不手动复制合并数据。

自动化只验证临时 PocketBase 上的注册权限、验证前拒绝、验证后登录和用户隔离；正式 SMTP 投递、真实 GitHub、组件交互及双设备同步必须实际验收。
