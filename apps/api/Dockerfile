# apps/api/Dockerfile
FROM node:22-alpine
WORKDIR /app
RUN npm i -g pnpm
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install
COPY . .
EXPOSE 3001
# dev-friendly run; assumes TS sources under src/
RUN pnpm add -D typescript ts-node
CMD ["npx","ts-node","src/server.ts"]
