# Helix

A modular GenAI orchestration platform for multi-model, multi-persona intelligence.

## Technology Stack

### Frontend
- **React** - UI framework
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first styling

### Backend
- **Node.js/Express** (TypeScript) or **FastAPI** (Python) - REST API
- **JWT** - Authentication with bearer tokens
- **bcrypt** - Password hashing

### Database & Storage
- **PostgreSQL** - Primary database
- **Prisma** - TypeScript ORM
- **pgvector** - Vector embeddings for semantic search
- **AWS Aurora PostgreSQL** - Production database
- **AWS S3** - Object storage (planned for memory)

### AI/ML Integration
- **OpenAI API** - GPT models
- **Anthropic API** - Claude models
- **AWS Bedrock** - Multi-model access
- Modular engine adapters with unified interface

### Infrastructure (AWS)
- **Terraform** - Infrastructure as Code
- **Lambda/Fargate** - Serverless/container compute
- **API Gateway** - API management
- **CloudFront** - CDN
- **Secrets Manager** - Credential management
- **CloudWatch** - Logging and metrics

### DevOps
- **GitHub Actions** - CI/CD pipelines
- **Docker** - Local PostgreSQL development
- Structured JSON logging with trace IDs

## Architecture

Monorepo structure with clear separation of concerns:
```
apps/
  web/          # React frontend
  api/          # Express/FastAPI backend
packages/
  core/         # Shared TypeScript types and utilities
  engines/      # AI model provider adapters
  personalities/# Engine-agnostic prompt presets
  orchestrator/ # Request routing and tool enforcement
  tools/        # Tool interface definitions
  memory/       # Vector memory implementation
  telemetry/    # Logging, cost tracking, tracing
infra/
  terraform/    # AWS infrastructure definitions
tests/          # Unit and integration tests
```

## Key Features

- **Multi-model support** - Unified interface for OpenAI, Claude, and Bedrock
- **Personality system** - JSON-based prompt presets with tool whitelisting
- **Budget tracking** - Per-user cost accounting with automatic lockout
- **JWT authentication** - Passcode-based access with bcrypt verification
- **Vector memory** - pgvector-powered semantic storage
- **Structured telemetry** - CloudWatch integration with trace correlation

## Local Development

**API:**
```bash
cd apps/api
npm install
pnpm exec tsx src/server.ts  # Runs on :3001
```

**Web:**
```bash
cd apps/web
npm install
npm run dev  # Runs on :5173
```

**Database:**
```bash
docker run -e POSTGRES_PASSWORD=helix -p 5432:5432 postgres:latest
```

## Environment Variables

Required in `apps/api/.env`:
- `JWT_SECRET` - Token signing key
- `TOKEN_TTL` - JWT expiration (e.g., "6h")
- `MASTER_PASS_HASH` - bcrypt hash for admin passcode
- `DATABASE_URL` - PostgreSQL connection string

## License

MIT