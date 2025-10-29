# Helix AI

A modular GenAI orchestration platform for multi-model, multi-persona intelligence.

## COPILOT INSTRUCTIONS

You are assisting on a project named Helix. Follow these rules strictly.

### Project architecture
- Monorepo with apps/web (React, Vite, Tailwind), apps/api (Node/Express TypeScript), packages/{core, engines, personalities, orchestrator, tools, memory, telemetry}, infra/terraform, tests.
- Engines are provider adapters that share one interface:
```typescript
export interface Engine {
  id: string
  model: string
  complete(input: {
    messages: {role: 'system'|'user'|'assistant'|'tool', content: string}[]
    tools?: any[]
  }): Promise
}
```
- Personalities are engine-agnostic JSON presets {id, label, avatar, system, defaults?, toolWhitelist?}.
- Orchestrator merges personality system prompt with user messages and calls Engine.complete. It enforces toolWhitelist.
- API is JWT protected. /auth/verify returns a JWT. All /v1/* routes require a bearer token.

### Coding rules
- TypeScript: "strict": true. No any unless justified. Prefer explicit types and narrow unions.
- Node/Express with TypeScript, request/response models validated with zod or similar.
- Error handling: return typed errors, never swallow exceptions. In the API, return HTTP 400/401/500 with clear messages.
- Logging: produce structured logs with trace_id and engine info.

## Tech Stack

- **Frontend**: Vite + React + Tailwind
  - Production: https://helixai.live (S3 + CloudFront)
- **Backend**: Node.js + Express + TypeScript
  - Production: https://api.helixai.live (API Gateway + Lambda)
- **Database**: PostgreSQL via Prisma ORM
  - Development: Docker PostgreSQL (local)
  - Production: RDS PostgreSQL (AWS)
- **Authentication**: JWT with bcryptjs email/password verification
- **Infrastructure**: AWS (managed via Terraform)
  - S3 + CloudFront with OAC for frontend static hosting
  - API Gateway (HTTP API) + Lambda (container image from ECR)
  - RDS PostgreSQL
  - Secrets Manager (JWT_SECRET, DATABASE_URL)
  - Route53 + ACM (SSL certificates)
  - CloudWatch logs

## Environment Configuration

### Local Development
`.env` in `apps/api/`:
```
DATABASE_URL=postgresql://helix:helix@localhost:5432/helix?schema=public
JWT_SECRET=your-local-dev-secret
ALLOWED_ORIGINS=http://localhost:5173
```

### Production (AWS Lambda)
Environment variables set via Terraform:
- `SECRETS_NAME`: Points to AWS Secrets Manager secret containing `JWT_SECRET` and `DATABASE_URL`
- `ALLOWED_ORIGIN`: https://helixai.live

Secrets are loaded at Lambda cold start via `apps/api/src/config/secrets.ts`

## Database Schema (Prisma)

Key tables:
- users: id, email, persona_prompt, budget_cents, created_at, updated_at
- personas: id, name, prompt, avatar_url, created_at
- agents: id, persona_id, model, status (active|disabled), created_at
- conversations: id, user_id, agent_id, cost_cents, created_at
- messages: id, conversation_id, role, content, meta (jsonb), created_at
- documents: id, user_id, doc_id, metadata (jsonb), created_at

Budget system:
- After each call, the API decrements `users.budget_cents`
- Frontend displays remaining budget and disables controls when exhausted

## Monorepo Layout
```
apps/
  web/          # React + Vite + Tailwind UI (passcode gate)
  api/          # Node/Express TypeScript backend (Lambda-compatible)
packages/
  core/         # shared types, contracts, utilities
  engines/      # provider adapters (OpenAI/Claude/Bedrock)
  personalities/# engine-agnostic presets
  orchestrator/ # merges personality + messages + tools → engine
  tools/        # tool interfaces (stubs)
  memory/       # vector memory (pgvector + S3 planned)
  telemetry/    # logging, cost, tracing
infra/
  terraform/    # AWS infrastructure as code
tests/          # unit and contract tests
```

## Quick Start (Local Development)

### Prerequisites
- Node.js 20+
- pnpm 10+
- Docker Desktop (for local PostgreSQL)
- PowerShell (Windows) or bash (Unix)

### 1. Clone and Install
```powershell
git clone https://github.com/rjbeery/helix.git
cd helix
pnpm install
```

### 2. Database Setup
Start PostgreSQL with Docker Compose:
```powershell
docker compose up -d postgres
```

This starts PostgreSQL on `localhost:5432` with:
- Database: `helix`
- User: `helix`
- Password: `helix`

### 3. Initialize Database
```powershell
cd apps/api
pnpm prisma migrate deploy
```

### 4. Seed Admin User (Optional)
```powershell
# Set credentials in .env or export as env vars
$env:ADMIN_EMAIL = "admin@example.com"
$env:ADMIN_PASSWORD = "your-secure-password"
pnpm tsx scripts/ensureAdmin.ts
```

### 5. Run API
```powershell
cd apps/api
pnpm dev
```
API runs on http://localhost:8081

### 6. Run Frontend
```powershell
cd apps/web
pnpm dev
```
Frontend runs on http://localhost:5173

Vite dev server proxies `/auth` and `/v1` requests to the API at http://localhost:8081

## Deployment

### Production Architecture
- **Frontend**: https://helixai.live
  - S3 bucket with CloudFront distribution
  - Origin Access Control (OAC) for secure S3 access
  - Route53 A/AAAA records
- **API**: https://api.helixai.live
  - Lambda function (container image from ECR)
  - API Gateway HTTP API with custom domain
  - Route53 A/AAAA records
- **Database**: RDS PostgreSQL
  - Instance: `helixai-postgres.ca5ogg4aalo0.us-east-1.rds.amazonaws.com`
  - Database: `helix`
- **Secrets**: AWS Secrets Manager
  - Secret: `helixai-secrets`
  - Contains: `JWT_SECRET`, `DATABASE_URL`

### Deployment Scripts

**Deploy Frontend:**
```powershell
.\deploy-frontend.ps1 -AwsProfile helix -AwsRegion us-east-1
```
Syncs `apps/web/dist` to S3 and invalidates CloudFront cache.

**Deploy All (API + Frontend):**
```powershell
.\deploy-all.ps1 -AwsProfile helix -AwsRegion us-east-1 -EcrAccountId 541064517863 -EcrApiRepo helixai-api
```
Builds Docker images, pushes Lambda image to ECR, updates Lambda function, and deploys frontend.

**Seed Production Database:**
```powershell
.\seed-prod.ps1 -DbSecretId helixai-secrets -AwsProfile helix -AwsRegion us-east-1 -AdminEmail "admin@example.com" -AdminPassword (ConvertTo-SecureString "password" -AsPlainText -Force)
```

### Infrastructure as Code

Terraform configuration in `infra/terraform/`:
- `main.tf`: Core infrastructure (S3, CloudFront, Lambda, API Gateway, RDS, Secrets Manager)
- `acm.tf`: SSL certificate for both `helixai.live` and `api.helixai.live`
- `route53.tf`: DNS zone and records

**Apply Infrastructure:**
```powershell
cd infra/terraform
terraform init
terraform plan -out=tfplan
terraform apply tfplan
```

**Note:** Set `TF_VAR_db_master_password` environment variable for database password.

## Development Status

### Completed ✅
- [x] JWT authentication with email/password (bcryptjs)
- [x] Prisma schema with users table
- [x] Seed scripts for admin and demo users
- [x] Express API with `/health`, `/auth/login`, `/auth/verify`, `/v1/me`
- [x] JWT middleware for protected routes
- [x] React frontend with login, logout, role display
- [x] AWS infrastructure via Terraform
  - S3 + CloudFront (OAC) for frontend
  - API Gateway + Lambda (container image)
  - RDS PostgreSQL
  - Route53 + ACM (SSL)
  - Secrets Manager
- [x] Deployment scripts (PowerShell)
- [x] Production deployment at helixai.live and api.helixai.live

### In Progress 🚧
- [ ] Agent conversation interface
- [ ] Provider adapters (OpenAI, Anthropic, Bedrock)
- [ ] Orchestrator with personality merging
- [ ] Tool invocation system

### Planned 📋
- [ ] Budget tracking and cost calculation
- [ ] Vector memory with pgvector
- [ ] Multi-persona management UI
- [ ] Conversation history
- [ ] Document upload and RAG
- [ ] GitHub Actions CI/CD pipeline

## License

MIT