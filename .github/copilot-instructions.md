COPILOT INSTRUCTIONS FOR HELIX

These notes are for AI coding agents editing the Helix monorepo. Keep changes minimal, typed, and runnable.

- Overview: Helix is a monorepo for a GenAI orchestration platform. Key areas:
  - `apps/web` — React + Vite front-end. See `package.json` for scripts.
  - `apps/api` — FastAPI backend (JWT auth). Entry point: `apps/api/main.py` and Pydantic shapes in `apps/api/schemas.py`.
  - `packages` — shared code: `core` (types), `engines` (model adapters), `orchestrator` (merge personality + messages), `personalities`, `tools`, `memory`, `telemetry`.
  - `infra/terraform` — deployment stubs.

- Style & constraints (discoverable from code):
  - TypeScript uses strict typing. Preserve and reuse `packages/core/types.ts` shapes (Message, Engine, Personality).
  - Python API uses FastAPI + Pydantic. Use the request/response models in `apps/api/schemas.py` for route signatures.
  - Engines implement an `Engine.complete(...)` contract: return { text, usage?, tool_calls? } (see README snippets and `packages/core/types.ts`).

- Security & env: `apps/api` expects JWT-backed routes. Local dev env variables mentioned in README: `JWT_SECRET`, `USER_PASSCODE_HASH`, `MASTER_PASSCODE_HASH`.

- How to add features (practical rules):
  1. Prefer adding typed interfaces in `packages/core` before implementing behavior in `packages/engines` or `orchestrator`.
  2. For new engine adapters, implement `Engine` interface and map provider responses to { text, usage, tool_calls }.
  3. When adding API routes, use Pydantic models from `apps/api/schemas.py` and wire auth via the existing JWT pattern in `apps/api/main.py`.
  4. Personalities are JSON presets under `personalities/`; orchestrator merges personality.system into the system message.

- Tests & local run (what worked in repo):
  - API: run in `apps/api` after installing `requirements.txt`. Example dev run in README: start uvicorn on port 8081. Use `.venv\Scripts\activate` on Windows.
  - Web: run `npm install` then `npm run dev` in `apps/web` (Vite default port 5173).

- Examples to copy or reference:
  - API auth flow: `apps/api/main.py` — POST `/auth/verify` -> returns JWT; protect `/v1/*` with bearer token dependency.
  - Turn request/response shapes: `apps/api/schemas.py` (Message, TurnReq, TurnResp, Usage).
  - Shared types: `packages/core/types.ts` (Role, Message, Engine contract, Personality shape).

- Conventions and gotchas (observed):
  - Do not introduce `any` in TypeScript; prefer expanding `packages/core/types.ts` if shapes are missing.
  - Keep orchestrator logic engine-agnostic; enforce `toolWhitelist` from personality JSONs.
  - Keep API route handlers pure — call into `orchestrator`/`packages` for business logic; routes should validate and translate models only.

- When committing code changes: add or update a minimal unit test under the appropriate `tests/` folder (see `apps/api/tests/test_auth.py` for an example of auth tests).

If any instruction here is unclear or you'd like me to include additional examples (file snippets or tests), tell me what to expand and I'll iterate.
