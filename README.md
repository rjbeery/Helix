COPILOT INSTRUCTIONS:
You are assisting on a project named Helix. Follow these rules strictly.

# Helix
<<<<<<< HEAD
A modular GenAI orchestration platform for multi-model, multi-persona intelligence.

Project architecture
- Monorepo with apps/web (React, Vite, Tailwind), apps/api (Node/Express TypeScript), packages/{core, engines, personalities, orchestrator, tools, memory, telemetry}, infra/terraform, tests.
=======
Project architecture
- Monorepo with apps/web (React, Vite, Tailwind), apps/api (FastAPI), packages/{core, engines, personalities, orchestrator, tools, memory, telemetry}, infra/terraform, tests.
>>>>>>> origin/main
- Engines are provider adapters that share one interface:
  export interface Engine {
    id: string
    model: string
    complete(input: {
      messages: {role: 'system'|'user'|'assistant'|'tool', content: string}[]
      tools?: any[]
    }): Promise<{ text: string; usage?: any; tool_calls?: any[] }>
  }
- Personalities are engine-agnostic JSON presets {id, label, avatar, system, defaults?, toolWhitelist?}.
- Orchestrator merges personality system prompt with user messages and calls Engine.complete. It enforces toolWhitelist.
- API is JWT protected. /auth/verify returns a JWT. All /v1/* routes require a bearer token.

Coding rules
- TypeScript: "strict": true. No any unless justified. Prefer explicit types and narrow unions.
<<<<<<< HEAD
- Python: Node/Express (TypeScript) with pydantic models, mypy and ruff clean.
- Error handling: return typed errors, never swallow exceptions. In the API, raise HTTP 400/401/500 with clear messages.
- Logging: produce structured logs with trace_id and engine info.
<<<<<<< HEAD
- For Node/Express (TypeScript) routes, include request and response models.

Examples


<<<<<<< HEAD
---

- Vite + React + Tailwind (passcode gate)
- Proxy to API at http://localhost:3001 in vite.config.ts
- JWT authentication, bcrypt passcode verification
- Prisma ORM for database
- PostgreSQL in development via Docker
- Aurora PostgreSQL (with pgvector) in production
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
- CloudWatch logs & metrics
- Structured JSON logs with `trace_id` and engine metadata

---

- persona_prompt (text)
- budget_cents (int)
- prompt (text)
- avatar_url (string, nullable)
- model (string)
- status (enum: active | disabled)
- cost_cents (int)
- meta (jsonb)
- doc_id (string)
- metadata (jsonb)

---

- After each call, the API decrements `users.budget_cents`.
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
=======
A modular GenAI orchestration platform for multi-model, multi-persona intelligence.

## Monorepo layout
```
apps/
  web/           # React + Vite + Tailwind UI (passcode gate)
  api/           # FastAPI backend (Lambda-compatible)
packages/
  core/          # shared types, contracts, utilities
  engines/       # model adapters (OpenAI/Claude/Bedrock stubs)
  personalities/ # engine-agnostic presets
  orchestrator/  # merges personality + messages + tools → engine
  tools/         # tool interfaces (stubs)
  memory/        # vector memory facade (stubs)
  telemetry/     # logging, cost, tracing (stubs)
infra/
  terraform/     # AWS: S3, CloudFront, API GW, Lambda, Secrets, DDB (stubs)
tests/           # unit/contract tests
```

## Quick start (local dev)
### API
```bash
cd apps/api
python -m venv .venv && source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8081
```
API runs at http://localhost:8081

### Web
```bash
cd apps/web
npm install
npm run dev
```
Web runs at http://localhost:5173

## ENV (local)
Create `apps/api/.env` (optional) with:
```
JWT_SECRET=dev-secret-change-me
USER_PASSCODE_HASH=$2b$12$8kLx/4YtW1t4mQj2c7tQMeT2Qm1bW8pY2m0nX7dZ0S8zqzQeTn0J2
MASTER_PASSCODE_HASH=$2b$12$8kLx/4YtW1t4mQj2c7tQMeT2Qm1bW8pY2m0nX7dZ0S8zqzQeTn0J2
```
(These bcrypt hashes are placeholders; generate your own with `python -c "import bcrypt; print(bcrypt.hashpw(b'code', bcrypt.gensalt()).decode())"`.)

## CI/CD
- GitHub Actions workflow at `.github/workflows/deploy.yml` (skeleton).
- Terraform stubs under `infra/terraform`.

## License
MIT (replace as needed).
>>>>>>> origin/main
