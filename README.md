# Helix

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
