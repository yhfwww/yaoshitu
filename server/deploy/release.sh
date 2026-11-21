#!/usr/bin/env bash
# Tag 发布脚本。由 GitHub Actions 在服务器运行，不读取或打印任何密钥。
set -euo pipefail

TAG="${1:?用法：release.sh vX.Y.Z}"
case "$TAG" in v[0-9]*) ;; *) echo "非法发布 Tag: $TAG" >&2; exit 2;; esac

APP_ROOT="${YAOSHITU_APP_ROOT:-/opt/yaoshitu}"
RELEASES_ROOT="${YAOSHITU_RELEASES_ROOT:-/opt/yaoshitu-releases}"
RELEASE_DIR="$RELEASES_ROOT/$TAG"
STATIC_ROOT="${YAOSHITU_STATIC_ROOT:-/var/www/yaoshitu-releases}"
# 链接所在目录由部署用户拥有；不要直接在 root 拥有的 /var/www 下改名。
CURRENT_LINK="${YAOSHITU_CURRENT_LINK:-/var/www/yaoshitu/current}"
STATE_DIR="${YAOSHITU_DEPLOY_STATE_DIR:-/var/lib/yaoshitu-deploy}"
ENV_FILE="${YAOSHITU_ENV_FILE:-$APP_ROOT/server/.env}"

test -e "$RELEASE_DIR/.git"
test -r "$ENV_FILE"
mkdir -p "$STATIC_ROOT" "$STATE_DIR"

# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a
: "${APP_DOMAIN:?server/.env 缺少 APP_DOMAIN}"

compose() {
  docker compose --project-name server --env-file "$ENV_FILE" -f "$RELEASE_DIR/server/compose.yaml" "$@"
}

old_static=""
if [ -L "$CURRENT_LINK" ]; then old_static="$(readlink -f "$CURRENT_LINK")"; fi
old_tag=""
if [ -f "$STATE_DIR/current-tag" ]; then old_tag="$(<"$STATE_DIR/current-tag")"; fi
old_container="$(docker compose --project-name server --env-file "$ENV_FILE" -f "$APP_ROOT/server/compose.yaml" ps -q pocketbase || true)"
old_image=""
if [ -n "$old_container" ]; then old_image="$(docker inspect --format '{{.Image}}' "$old_container")"; fi

rollback() {
  status=$?
  trap - ERR
  echo "发布 $TAG 失败，开始自动回滚" >&2
  if [ -n "$old_static" ] && [ -d "$old_static" ]; then
    ln -sfn "$old_static" "$CURRENT_LINK.next"
    mv -Tf "$CURRENT_LINK.next" "$CURRENT_LINK"
  fi
  if [ -n "$old_image" ]; then
    # Compose 项目固定为 server，镜像名与现有 server-pocketbase-1 保持一致。
    docker image tag "$old_image" server-pocketbase:latest
    rollback_compose="$APP_ROOT/server/compose.yaml"
    if [ -n "$old_tag" ] && [ -f "$RELEASES_ROOT/$old_tag/server/compose.yaml" ]; then
      rollback_compose="$RELEASES_ROOT/$old_tag/server/compose.yaml"
    fi
    docker compose --project-name server --env-file "$ENV_FILE" -f "$rollback_compose" up -d --no-deps --force-recreate pocketbase || true
  fi
  exit "$status"
}
trap rollback ERR

# 构建镜像但不启动 Caddy/web 服务；线上静态网页仍由宿主机 Nginx 提供。
compose build pocketbase web
compose create --force-recreate web >/dev/null
web_container="$(compose ps -aq web | tail -n 1)"
test -n "$web_container"

new_static="$STATIC_ROOT/$TAG"
test ! -e "$new_static"
stage="$(mktemp -d "$STATIC_ROOT/.${TAG}.XXXXXX")"
trap 'rm -rf "$stage"' EXIT
docker cp "$web_container:/srv/." "$stage/"
docker rm "$web_container" >/dev/null
mv "$stage" "$new_static"
trap - EXIT

compose up -d --no-deps --force-recreate pocketbase
for _ in $(seq 1 15); do
  if curl --fail --silent --show-error --max-time 5 http://127.0.0.1:8090/api/health >/dev/null; then break; fi
  sleep 2
done
curl --fail --silent --show-error --max-time 5 http://127.0.0.1:8090/api/health >/dev/null

# 软链接改名为同文件系统内原子操作；已有连接仍可读取旧静态文件。
ln -sfn "$new_static" "$CURRENT_LINK.next"
mv -Tf "$CURRENT_LINK.next" "$CURRENT_LINK"
printf '%s\n' "$TAG" > "$STATE_DIR/current-tag"
printf '发布成功：%s\n' "$TAG"
