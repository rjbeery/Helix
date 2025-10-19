COPILOT INSTRUCTIONS:
You are assisting on a project named Helix. Follow these rules strictly.

# Helix
A modular GenAI orchestration platform for multi-model, multi-persona intelligence.

Project architecture
- Monorepo with apps/web (React, Vite, Tailwind), apps/api (Node/Express TypeScript), packages/{core, engines, personalities, orchestrator, tools, memory, telemetry}, infra/terraform, tests.
- Engines are provider adapters that share one interface:
  export interface Engine {
    id: string
    model: string
    complete(input: {
      messages: {role: 'system'|'user'|'assistant'|'tool', content: string}[]
      tools?: any[]
      temperature?: number
      max_tokens?: number
    }): Promise<{ text: string; usage?: any; tool_calls?: any[] }>
  }
- Personalities are engine-agnostic JSON presets {id, label, avatar, system, defaults?, toolWhitelist?}.
- Orchestrator merges personality system prompt with user messages and calls Engine.complete. It enforces toolWhitelist.
- API is JWT protected. /auth/verify returns a JWT. All /v1/* routes require a bearer token.

Coding rules
- TypeScript: "strict": true. No any unless justified. Prefer explicit types and narrow unions.
- Python: Node/Express (TypeScript) with pydantic models, mypy and ruff clean.
- Error handling: return typed errors, never swallow exceptions. In the API, raise HTTP 400/401/500 with clear messages.
- Logging: produce structured logs with trace_id and engine info.
- Tests: for each new module, create a minimal unit test or contract test.

What to generate
- Prefer minimal, production-grade code with correct imports and types.
- For TypeScript files, export types and default implementations.
- For Node/Express (TypeScript) routes, include request and response models.
- Include TODOs for secrets and environment variables where relevant.
- Use existing interfaces verbatim. Do not invent new shapes.

Examples
- If creating packages/engines/openai.ts, implement an Engine class OpenAIEngine with a constructor(model: string, client?: OpenAI). Pass through tools, temperature, and max_tokens to the API call and map the result to {text, usage, tool_calls}.
- If creating apps/api/routes/turns.py, define POST /v1/turns that validates JWT, parses body {engine, model?, personalityId, messages[], overrides?}, calls orchestrator.runTurn, and returns a typed response.

Do not generate placeholders with nonsense. Generate compilable code that respects the above contracts.

---

## Infrastructure overview

### Frontend
- Vite + React + Tailwind (passcode gate)
- Proxy to API at http://localhost:3001 in vite.config.ts
- In production, hosted on **S3 + CloudFront**

### API
- Node/Express (TypeScript)
- JWT authentication, bcrypt passcode verification
- Prisma ORM for database
- Hosted on **AWS Lambda or ECS/Fargate**

### Database
- PostgreSQL in development via Docker
- Aurora PostgreSQL (with pgvector) in production
- Prisma schema defines `users`, `personas`, `agents`, `usage_ledger`, and `embeddings`

### Secrets & Configuration
- Managed via AWS Secrets Manager
- `.env` for local development:
```
PORT=3001
JWT_SECRET=change-me
TOKEN_TTL=6h
MASTER_PASS_HASH=$2b$10$...
FNBO_PASS_HASH=$2b$10$...
DATABASE_URL=postgresql://helix:helix@localhost:5432/helix?schema=public
```

### Observability
- CloudWatch logs & metrics
- X-Ray (optional tracing)
- Structured JSON logs with `trace_id` and engine metadata

---

## Database schema (Prisma)

### users
- id (cuid, pk)
- email (unique)
- name (nullable)
- avatar_url (string; S3 path)
- persona_prompt (text)
- budget_cents (int)
- created_at, updated_at (timestamps)

### personas
- id (cuid, pk)
- user_id (fk → users.id)
- name (string)
- prompt (text)
- avatar_url (string, nullable)
- created_at, updated_at

### agents
- id (cuid, pk)
- user_id (fk → users.id)
- provider (enum: openai | anthropic | bedrock | local)
- model (string)
- status (enum: active | disabled)
- created_at, updated_at

### usage_ledger
- id (cuid, pk)
- user_id (fk)
- agent_id (fk)
- input_tokens (int)
- output_tokens (int)
- cost_cents (int)
- meta (jsonb)
- created_at

### embeddings (for RAG)
- id (cuid, pk)
- user_id (fk)
- doc_id (string)
- vector (pgvector)
- metadata (jsonb)

---

## Budgeting system

Each user has a `budget_cents` balance.
- Every agent call records a row in `usage_ledger` with its `cost_cents`.
- After each call, the API decrements `users.budget_cents`.
- If the balance is <= 0, API returns HTTP 402 (Payment Required) and denies further LLM calls.
- Frontend displays remaining budget and disables controls when exhausted.

---

## Monorepo layout
apps/
web/ # React + Vite + Tailwind UI (passcode gate)
api/ # Node/Express (TypeScript) backend (Lambda-compatible)
packages/
core/ # shared types, contracts, utilities
engines/ # provider adapters (OpenAI/Claude/Bedrock)
personalities/ # engine-agnostic presets
orchestrator/ # merges personality + messages + tools → engine
tools/ # tool interfaces (stubs)
memory/ # vector memory (pgvector + S3 planned)
telemetry/ # logging, cost, tracing
infra/
terraform/ # AWS: S3, CloudFront, API GW, Lambda, Secrets, Aurora
tests/ # unit and contract tests

---

## Quick start (local dev)

### API
cd apps/api
npm install
pnpm exec tsx src/server.ts
Runs on http://localhost:3001

### Web
cd apps/web
npm install
npm run dev
Runs on http://localhost:5173

## CI/CD

GitHub Actions: build + deploy pipelines (stubs)
Terraform under infra/terraform provisions:
S3 + CloudFront (web)
Lambda or Fargate (API)
Aurora PostgreSQL + pgvector
Secrets Manager + CloudWatch
IAM roles & permissions

## TODO

Auth

 Implement bcrypt verification for passcodes

 Issue JWTs with TTL using JWT_SECRET

 Middleware for all /v1/** routes

Database

 Implement Prisma schema and migration

 Seed script with demo user/persona/agent

Agents

 Provider adapters (OpenAI, Anthropic)

 Centralized cost calculator

 Ledger + budget decrement logic

 Enforce 402 lockout when budget exhausted

Frontend

 Passcode → JWT → route guard

 Budget banner + lockout UI

 Persona management (prompt + avatar)

 Agent invocation interface

Infrastructure

 AWS Terraform modules (S3, CloudFront, ECS/Lambda, Aurora, Secrets)

 GitHub Actions deploy workflow