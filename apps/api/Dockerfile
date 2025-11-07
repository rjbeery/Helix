FROM node:20-alpine

WORKDIR /workspace
COPY . .

# Enable pnpm and install all dependencies (including devDependencies)
RUN corepack enable
RUN pnpm -w install --frozen-lockfile

# Navigate to apps/api and generate Prisma client using the local node_modules
WORKDIR /workspace/apps/api
RUN npx prisma generate

# Set production mode for runtime
ENV NODE_ENV=production

CMD ["pnpm", "exec", "tsx", "src/server.ts"]
