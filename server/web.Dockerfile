FROM node:24-alpine AS build
WORKDIR /app
COPY src/package.json src/package-lock.json ./
RUN npm ci
COPY src/ ./
ARG VITE_POCKETBASE_URL
ENV VITE_POCKETBASE_URL=$VITE_POCKETBASE_URL
RUN npm run build
FROM caddy:2-alpine
COPY --from=build /app/dist /srv
COPY server/Caddyfile /etc/caddy/Caddyfile
