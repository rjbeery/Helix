Helix repository structure

apps/
  api/
  web/

packages/
  core/
  engines/
  memory/
  utils/

infra/
  terraform/

scripts/

Important runtime entry points

apps/api/src/app.ts
apps/api/src/lambda.ts
apps/web/src/main.tsx
packages/engines/src/index.ts
apps/api/prisma/schema.prisma
infra/terraform/main.tf
