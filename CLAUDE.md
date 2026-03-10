# Helix AI — Claude Code Context

## Project Overview
Multi-model, multi-persona AI orchestration platform. Users chat with AI "personas" (Feynman, Newton, Einstein) each backed by a different LLM provider.

**Live URLs**
- Frontend: https://helixai.live
- API: https://api.helixai.live

## Stack
- **Monorepo**: pnpm workspaces — `apps/api`, `apps/web`, `packages/engines`, `packages/core`, `packages/utils`, `packages/memory`
- **API**: Express + Prisma + PostgreSQL, deployed as AWS Lambda (container image via ECR)
- **Frontend**: React + Vite, deployed to S3 + CloudFront
- **CI/CD**: GitHub Actions auto-deploys on push to `main` (frontend + Lambda)
- **IaC**: Terraform in `infra/terraform/`

## AWS Infrastructure
- **Account ID**: 541064517863, **Region**: us-east-1
- **Lambda**: `helixai-api` (1024MB, 30s timeout)
- **ECR repo**: `helixai-api` (image tag: `latest-lambda`)
- **CloudFront distribution**: `E1WTW4Q4V8UY5C`
- **S3 buckets**: `helixai-site-helixai-live` (frontend), `helixai-avatars-helixai-live` (avatars)
- **RDS**: `helixai-postgres.ca5ogg4aalo0.us-east-1.rds.amazonaws.com` (PostgreSQL 16, db: `helix`, user: `postgres`)
- **API Gateway**: HTTP API `r4zbqkpnu8` with `allow_credentials=true` CORS

## Secrets & Config
- **Secrets**: API keys stored in SSM Parameter Store at `/helix/prod/*`
  - `JWT_SECRET`, `DATABASE_URL`, `GEMINI_API_KEY`, `GROK_API_KEY`, `GLOBAL_SYSTEM_PROMPT`
  - `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` (added manually)
- **Model IDs**: Set as Lambda env vars in `infra/terraform/main.tf` under `MODEL_*` keys
  - To upgrade a model: edit `main.tf` → `terraform apply -target=aws_lambda_function.api` (~10s, no rebuild)
- **SSM fetch**: Batched in chunks of 10 (API limit) in `apps/api/src/config/secrets.ts`

## Engine / Model Architecture
- `packages/engines/src/` — one file per provider: `openai.ts`, `anthropic.ts`, `gemini.ts`, `grok.ts`, `bedrock.ts`
- `packages/engines/src/index.ts` — `EngineRegistry` maps DB `engineId` strings to factory functions
- Each factory checks `process.env.MODEL_*` before falling back to hardcoded default
- **package.json main**: `./dist/packages/engines/src/index.js` (tsconfig uses `rootDir: "../../"` so output nests under `dist/packages/engines/src/`)

## Database Personas (current)
| Persona | engineId | Provider |
|---------|----------|----------|
| Feynman | `gpt-4o` | OpenAI |
| Newton  | `claude-sonnet-4-6` | Anthropic |
| Einstein| `gemini-1.5-pro` | Gemini (maps to `gemini-1.5-pro-latest`) |

## Key Files
- `apps/api/src/app.ts` — Express app, CORS config, route setup
- `apps/api/src/lambda.ts` — Lambda handler wrapping Express via `serverless-http`
- `apps/api/src/config/secrets.ts` — SSM/Secrets Manager loader
- `apps/api/prisma/schema.prisma` — DB schema (User, Engine, Persona, Conversation, Message)
- `infra/terraform/main.tf` — All AWS infrastructure
- `Dockerfile.lambda` — Lambda container image build
- `.github/workflows/ci.yml` — CI: build → deploy-frontend → deploy-api

## Deployment
```bash
# Frontend auto-deploys via CI on push to main
# API auto-deploys via CI on push to main (builds Docker image, pushes to ECR, updates Lambda)

# Manual model upgrade (no rebuild needed):
cd infra/terraform
# Edit MODEL_* value in main.tf
terraform apply -target=aws_lambda_function.api

# Manual full Terraform apply:
terraform apply

# Force Lambda cold start (picks up new SSM secrets):
aws lambda update-function-configuration --function-name helixai-api --description "restart-$(date +%s)"
```

## Pre-commit Hook
False-positive secret scanner blocks commits with env var references. Bypass with:
```bash
SKIP_SECRET_SCAN=1 git commit -m "..."
```

## Common Debugging
```bash
# Check Lambda logs (last 10 min):
powershell -Command "aws logs filter-log-events --log-group-name '/aws/lambda/helixai-api' --start-time ([DateTimeOffset]::UtcNow.AddMinutes(-10).ToUnixTimeMilliseconds()) --query 'events[*].message' --output text"

# Test CORS preflight:
curl -s -X OPTIONS https://api.helixai.live/auth/login -H "Origin: https://helixai.live" -H "Access-Control-Request-Method: POST"

# List SSM parameters:
aws ssm get-parameters-by-path --path '/helix/prod' --with-decryption --query 'Parameters[*].Name'

# Add/update SSM parameter:
aws ssm put-parameter --name "/helix/prod/KEY_NAME" --value "value" --type SecureString --overwrite
```

## Known Issues / Watch Out For
- `AWS_REGION` is a reserved Lambda env var — do not set it in Terraform
- SSM `GetParameters` max 10 names per call — batched in secrets.ts
- Prisma `Persona.engineId` is a FK to `Engine.id` — update Engine table before changing persona engineIds
- `@helix/engines` dist path is `dist/packages/engines/src/index.js` (not `dist/index.js`) due to tsconfig rootDir
