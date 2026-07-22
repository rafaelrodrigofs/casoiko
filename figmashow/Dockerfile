# syntax=docker/dockerfile:1

FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/core/package.json ./packages/core/
COPY packages/mcp/package.json ./packages/mcp/
COPY apps/web/package.json ./apps/web/
COPY apps/server/package.json ./apps/server/

RUN npm ci

COPY packages/core ./packages/core
COPY packages/mcp ./packages/mcp
COPY apps/web ./apps/web
COPY apps/server ./apps/server

RUN npm run build -w @figmashow/web

FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV FIGMASHOW_DATA=/data

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/core ./packages/core
COPY --from=build /app/packages/mcp ./packages/mcp
COPY --from=build /app/apps/server ./apps/server
COPY --from=build /app/apps/web/package.json ./apps/web/package.json
COPY --from=build /app/apps/web/api-handler.js ./apps/web/api-handler.js
COPY --from=build /app/apps/web/dist ./apps/web/dist

RUN mkdir -p /data

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/server/server.js"]
