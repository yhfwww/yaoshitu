# 邮箱密码登录部署（当前阶段）

2026-10-24 决策：仅提供邮箱 + 密码直接注册登录、GitHub 登录和游客模式。首页显著入口保留。邮箱验证、找回密码、SMTP 和邮件通知均后置，当前上线无需配置发信服务。邮箱地址目前只是登录标识，不能当作已验证身份；注册不会把 verified 改为 true。

## 更新 Ubuntu

先在 PocketBase 后台创建备份，独立保管原 .env。将本次源码更新到 /opt/yaoshitu 后，在 /opt/yaoshitu/server 执行：

```sh
docker compose build pocketbase web
docker compose up -d --no-deps pocketbase
docker compose create --no-deps web
docker cp server-web-1:/srv/. /var/www/yaoshitu-v0.2.0-dev/
chmod -R a+rX /var/www/yaoshitu-v0.2.0-dev
curl -fsS https://yaoshitu.xyz/api/health
```

不要执行无服务名的 docker compose up -d，避免 Caddy 与 Nginx 冲突。不要删除数据卷、重建账号或更换现有数据密钥。已有迁移保留，新增迁移关闭 users 的新设备登录邮件通知；移除密码登录的邮箱验证钩子，已有未验证邮箱账号也能登录。GitHub 配置保持原样。

前端更新后更新 Service Worker，并关闭旧标签页后重开；不要清除整站数据或 IndexedDB。仅替换静态前端不够，必须更新 PocketBase hooks 和迁移。

## 验收

1. 桌面和手机首页可找到“登录 / 注册”。
2. 新邮箱注册成功后可直接密码登录，不收取或要求任何验证邮件。
3. 错误密码登录失败，重复邮箱注册失败；注册不能自行设置 verified=true。
4. 退出账号返回原游客数据；另一台设备登录同一账号可同步。
5. GitHub 登录仍可用，注册后没有“忘记密码”或“发送验证邮件”入口。

当前没有自助找回密码，请妥善保管密码；需要恢复时由管理员核实身份后处理。邮箱输入本身不能用于核实身份，不可据此直接重置账号密码。不要自动合并不同账号数据。后续接入邮件服务时再补充验证和找回流程。
