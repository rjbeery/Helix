# Helix AI — Claude Code Context

## Autonomy

Operate autonomously. Do not ask for confirmation before running commands, editing files, pushing code, or deploying. Execute the full task end-to-end without pausing for approval unless you hit a genuine blocker that requires a decision only the user can make.

## Project Overview
Helix is a multi-model, multi-persona AI orchestration platform. Users chat with AI personas (Feynman, Newton, Einstein), each backed by a different LLM provider.

Helix is architected as a modular monorepo with clear separation between:

- engine adapters (LLM providers)
- orchestration logic
- memory systems
- personalities
- utilities and telemetry
- frontend UI
- backend API

Claude should prioritize **small, targeted improvements** that preserve the existing architecture.

Do not collapse packages or restructure the monorepo unless explicitly instructed.

---

# Live URLs
Frontend: https://helixai.live  
API: https://api.helixai.live

---

# Stack

## Monorepo
pnpm workspaces

apps/api  
apps/web  

packages/core  
packages/engines  
packages/memory  
packages/utils  

Additional internal packages:

packages/orchestrator  
packages/personalities  
packages/telemetry  
packages/tools  

---

# Backend API

apps/api

Express server running inside AWS Lambda using `serverless-http`.

Key files:

apps/api/src/app.ts  
Express app, middleware, routes, CORS

apps/api/src/lambda.ts  
Lambda entrypoint

apps/api/src/config/secrets.ts  
Loads secrets from AWS SSM Parameter Store

Database via Prisma:

apps/api/prisma/schema.prisma

Tables include:

User  
Engine  
Persona  
Conversation  
Message

---

# Frontend

apps/web

React + Vite frontend.

Deployed to:

S3 → CloudFront

CloudFront distribution:

E1WTW4Q4V8UY5C

---

# AWS Infrastructure

Account: 541064517863  
Region: us-east-1

Lambda:
helixai-api  
1024MB  
30s timeout

ECR repo:
helixai-api

Frontend bucket:
helixai-site-helixai-live

Avatar bucket:
helixai-avatars-helixai-live

RDS PostgreSQL:

helixai-postgres.ca5ogg4aalo0.us-east-1.rds.amazonaws.com  
Database: helix  
User: postgres

API Gateway:

HTTP API r4zbqkpnu8

CORS enabled with:

allow_credentials=true

---

# Infrastructure as Code

Terraform location:

infra/terraform/

Main file:

infra/terraform/main.tf

All AWS resources are defined here.

Model IDs are configured through Lambda environment variables using keys:

MODEL_*

Updating a model requires only Terraform apply targeting the Lambda.

Example:

cd infra/terraform

terraform apply -target=aws_lambda_function.api

This avoids rebuilding the container image.

---

# CI/CD

GitHub Actions:

.github/workflows/ci.yml

Pipeline:

1. build
2. deploy frontend
3. deploy API

Deploy triggers on push to main.

---

# Secrets

Secrets stored in AWS SSM Parameter Store:

/helix/prod/*

Examples:

JWT_SECRET  
DATABASE_URL  
OPENAI_API_KEY  
ANTHROPIC_API_KEY  
GEMINI_API_KEY  
GROK_API_KEY  
GLOBAL_SYSTEM_PROMPT

SSM fetch is batched in groups of 10 due to API limits.

Implementation:

apps/api/src/config/secrets.ts

---

# Engine / Model Architecture

Engine adapters live in:

packages/engines/src/

One file per provider:

openai.ts  
anthropic.ts  
gemini.ts  
grok.ts  
bedrock.ts

Registry:

packages/engines/src/index.ts

The EngineRegistry maps database `engineId` values to provider factories.

Factories check:

process.env.MODEL_*

before falling back to hardcoded defaults.

Important build detail:

package.json main points to

dist/packages/engines/src/index.js

because tsconfig rootDir is "../../".

---

# Personas

Personas define system behavior for each AI.

Location:

packages/personalities/

Example:

default.json

Personas control:

system prompts  
behavioral style  
persona tone  
multi-agent roles

Current database personas:

Feynman  
engineId: gpt-4o  
provider: OpenAI

Newton  
engineId: claude-sonnet-4-6  
provider: Anthropic

Einstein  
engineId: gemini-1.5-pro  
provider: Gemini

---

# Helix Execution Flow

High-level flow:

User message  
↓  
API receives request  
↓  
Orchestrator selects persona + engine  
↓  
Engine adapter builds model request  
↓  
Model provider API call  
↓  
Response returned  
↓  
Telemetry + message persistence  
↓  
Conversation returned to client

The orchestrator is the **system boundary**.  
Claude should not bypass it.

---

# Memory System

Location:

packages/memory/src

Capabilities:

chunking  
embedding  
vector storage

Supported backends:

Pinecone  
Postgres

Memory should only be accessed through defined memory interfaces.

---

# Utilities

packages/utils

Shared helpers and scoring utilities.

packages/core

Shared types and interfaces used by all packages.

---

# Telemetry

packages/telemetry

Handles logging and token usage tracking.

Claude should prefer extending telemetry rather than introducing ad-hoc logging.

---

# Deployment

Frontend and API deploy automatically via CI.

Manual commands:

Force Lambda cold start:

aws lambda update-function-configuration --function-name helixai-api --description "restart-$(date +%s)"

---

# Pre-commit Hook

False-positive secret scanner sometimes blocks commits.

Bypass with:

SKIP_SECRET_SCAN=1 git commit -m "..."

---

# Common Debugging

Lambda logs (last 10 minutes):

powershell -Command "aws logs filter-log-events --log-group-name '/aws/lambda/helixai-api' --start-time ([DateTimeOffset]::UtcNow.AddMinutes(-10).ToUnixTimeMilliseconds()) --query 'events[*].message' --output text"

CORS test:

curl -X OPTIONS https://api.helixai.live/auth/login \
-H "Origin: https://helixai.live" \
-H "Access-Control-Request-Method: POST"

List SSM parameters:

aws ssm get-parameters-by-path --path '/helix/prod' --with-decryption --query 'Parameters[*].Name'

Add or update SSM parameter:

aws ssm put-parameter --name "/helix/prod/KEY_NAME" --value "value" --type SecureString --overwrite

---

# Known Issues

Do not set AWS_REGION in Terraform.  
Lambda sets this automatically.

SSM GetParameters max is 10 names per call.

Prisma Persona.engineId is a foreign key to Engine.id.

Update Engine table before changing persona engineId values.

@helix/engines build output path:

dist/packages/engines/src/index.js

---

# Claude Operating Guidelines

Claude should follow these principles when modifying this repository:

1. Inspect the relevant package before making changes.
2. Follow existing patterns rather than introducing new architecture.
3. Avoid cross-package refactors unless absolutely necessary.
4. Prefer minimal targeted edits.
5. Do not restructure the monorepo.
6. Do not bypass the orchestrator.
7. Do not hardcode secrets or model IDs.

If uncertain about architecture decisions, ask before proceeding.