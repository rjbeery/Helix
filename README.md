COPILOT INSTRUCTIONS:
You are assisting on a project named Helix. Follow these rules strictly.

# Helix
Project architecture
- Monorepo with apps/web (React, Vite, Tailwind), apps/api (Node/Express (TypeScript)), packages/{core, engines, personalities, orchestrator, tools, memory, telemetry}, infra/terraform, tests.
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

A modular GenAI orchestration platform for multi-model, multi-persona intelligence.

## Monorepo layout
```
apps/
  web/           # React + Vite + Tailwind UI (passcode gate)
  api/           # Node/Express (TypeScript) backend (Lambda-compatible)
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
Node runtime main:app --reload --port 8081
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

