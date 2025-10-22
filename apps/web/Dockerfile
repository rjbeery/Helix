FROM node:20-alpine AS build
WORKDIR /workspace
ENV CI=true
RUN corepack enable

# Monorepo context so pnpm sees workspace
COPY . .

# Install deps and build the web app
WORKDIR /workspace/apps/web
RUN pnpm install --frozen-lockfile --filter helix-web...
RUN pnpm build

FROM nginx:alpine
COPY --from=build /workspace/apps/web/dist /usr/share/nginx/html
EXPOSE 80
