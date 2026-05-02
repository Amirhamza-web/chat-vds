FROM node:20-bookworm-slim AS deps
RUN corepack enable && corepack prepare pnpm@9.15.1 --activate
WORKDIR /app
COPY package.json pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile=false --prod=false

FROM deps AS builder
ARG VITE_API_URL=http://localhost:3001
ARG VITE_SFU_URL=http://localhost:3002
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SFU_URL=$VITE_SFU_URL
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN pnpm --filter @chat-vds/web build

FROM nginx:alpine AS runtime
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
