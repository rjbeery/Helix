FROM node:20-alpine
WORKDIR /workspace
ENV CI=true
# Make pnpm available in this container
RUN corepack enable

# Bring the whole repo (monorepo install needs workspace files)
COPY . .

# Install deps for the workspace (from repo root), then run API
WORKDIR /workspace/apps/api
RUN pnpm -w install --frozen-lockfile

ENV PORT=3001
EXPOSE 3001
CMD ["pnpm","start"]
