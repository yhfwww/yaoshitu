FROM alpine:3.22 AS download
ARG PB_VERSION=0.40.5
ARG TARGETARCH
RUN PB_ARCH="${TARGETARCH:-}" \
    && if [ -z "$PB_ARCH" ]; then \
         case "$(uname -m)" in \
           x86_64) PB_ARCH=amd64 ;; \
           aarch64|arm64) PB_ARCH=arm64 ;; \
           *) echo "Unsupported PocketBase architecture" >&2; exit 1 ;; \
         esac; \
       fi \
    && case "$PB_ARCH" in amd64|arm64) ;; *) echo "Unsupported PocketBase architecture: $PB_ARCH" >&2; exit 1 ;; esac \
    && apk add --no-cache ca-certificates curl unzip \
    && curl -fsSL --retry 3 "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${PB_ARCH}.zip" -o /tmp/pb.zip \
    && unzip /tmp/pb.zip -d /tmp/pb

FROM alpine:3.22
RUN apk add --no-cache ca-certificates \
    && adduser -D -H -u 10001 yaoshitu \
    && mkdir -p /pb/pb_data && chown -R yaoshitu:yaoshitu /pb
COPY --from=download /tmp/pb/pocketbase /usr/local/bin/pocketbase
COPY pb_hooks /pb/pb_hooks
COPY pb_migrations /pb/pb_migrations
RUN find /pb/pb_hooks /pb/pb_migrations -type d -exec chmod 755 {} \; \
    && find /pb/pb_hooks /pb/pb_migrations -type f -exec chmod 644 {} \;
USER yaoshitu
WORKDIR /pb
EXPOSE 8090
ENTRYPOINT ["pocketbase"]
CMD ["serve", "--http=0.0.0.0:8090", "--automigrate=false", "--encryptionEnv=YAOSHITU_SETTINGS_KEY"]
