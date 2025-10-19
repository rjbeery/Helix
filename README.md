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

- **Frontend**: Vite + React + Tailwind (passcode gate)
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL via Prisma ORM
  - Development: Docker PostgreSQL
  - Production: Aurora PostgreSQL with pgvector
- **Authentication**: JWT with bcrypt passcode verification
- **Infrastructure**: AWS (managed via Terraform)
  - S3 + CloudFront for frontend
  - Lambda or Fargate for API
  - Aurora PostgreSQL + pgvector
  - Secrets Manager
  - CloudWatch logs & metrics

## Environment Configuration

`.env` for local development:
```
PORT=3001
JWT_SECRET=change-me
TOKEN_TTL=6h
MASTER_PASS_HASH=$2b$10$...
FNBO_PASS_HASH=$2b$10$...
DATABASE_URL=postgresql://helix:helix@localhost:5432/helix?schema=public
```

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
- Node.js 18+
- pnpm
- Docker (for PostgreSQL)
- PowerShell (Windows) or bash (Unix)

### Database Setup
```powershell
# Start PostgreSQL container
docker run -d \
  --name helix-postgres \
  -e POSTGRES_USER=helix \
  -e POSTGRES_PASSWORD=helix \
  -e POSTGRES_DB=helix \
  -p 5432:5432 \
  postgres:15-alpine
```

### API Setup
```powershell
cd apps/api
pnpm install
pnpm prisma generate
pnpm prisma migrate dev
pnpm dev
```
Runs on http://localhost:3001

### Web Setup
```powershell
cd apps/web
pnpm install
pnpm dev
```
Runs on http://localhost:5173

Vite proxy configuration in `vite.config.ts` forwards API calls to http://localhost:3001

## CI/CD

GitHub Actions workflows:
- `.github/workflows/build.yml` - Build and test
- `.github/workflows/deploy.yml` - Deploy to AWS

Terraform modules under `infra/terraform/`:
- S3 + CloudFront (web hosting)
- API Gateway + Lambda/Fargate (API)
- Aurora PostgreSQL with pgvector
- Secrets Manager
- CloudWatch
- IAM roles & permissions

## TODO

### Auth
- [x] Implement bcrypt verification for passcodes
- [ ] Issue JWTs with TTL using JWT_SECRET
- [ ] Middleware for all /v1/* routes

### Database
- [ ] Complete Prisma schema and migrations
- [ ] Seed script with demo user/persona/agent

### Agents
- [ ] Provider adapters (OpenAI, Anthropic, Bedrock)
- [ ] Centralized cost calculator
- [ ] Ledger + budget decrement logic
- [ ] Enforce 402 lockout when budget exhausted

### Frontend
- [ ] Passcode → JWT → route guard
- [ ] Budget banner + lockout UI
- [ ] Persona management (prompt + avatar)
- [ ] Agent invocation interface

### Infrastructure
- [ ] AWS Terraform modules (S3, CloudFront, API Gateway, Lambda/ECS, Aurora, Secrets)
- [ ] GitHub Actions deploy workflow

## License

MIT