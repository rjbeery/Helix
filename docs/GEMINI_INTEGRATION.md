# Gemini Engine Integration

This document describes the Gemini (Google AI) engine integration for Helix.

## What Was Added

### 1. Engine Implementation
- **File**: `packages/engines/src/gemini.ts`
- Implements the `Engine` interface for Google's Gemini API
- Supports models:
  - `gemini-1.5-pro` - Most capable model
  - `gemini-1.5-flash` - Fast, efficient model
  - `gemini-1.5-flash-8b` - Fastest, lightweight model
  - `gemini-2.0-flash-exp` - Experimental latest model (free)

### 2. Type Updates
- **File**: `packages/core/src/types.ts`
- Added `'gemini'` to the `Engine` provider type

### 3. Engine Registry
- **File**: `packages/engines/src/index.ts`
- Registered all Gemini models in `EngineRegistry`
- Added pricing information
- Added to available models list

### 4. Database Seeding
- **File**: `apps/api/prisma/seed.ts`
- Added Gemini engines to seed data
- **File**: `apps/api/scripts/add-gemini-engines.ts`
- Standalone script to add Gemini engines to production database

## Setup Instructions

### 1. Get a Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Get API Key" or "Create API Key"
4. Copy the API key

### 2. Configure Local Development

Add to `apps/api/.env`:

```bash
GEMINI_API_KEY=your_api_key_here
# or
GOOGLE_API_KEY=your_api_key_here
```

### 3. Configure Production (AWS)

Add the Gemini API key to AWS Systems Manager Parameter Store:

```powershell
# Add Gemini API key to Parameter Store
aws ssm put-parameter \
  --name "/helix/prod/GEMINI_API_KEY" \
  --value "your_api_key_here" \
  --type "SecureString" \
  --description "Google Gemini API key" \
  --region us-east-1 \
  --overwrite
```

Then update the secrets loading code to include Gemini API key:

In `apps/api/src/config/secrets.ts`, add to the `parameterNames` array:
```typescript
`${prefix}/GEMINI_API_KEY`
```

### 4. Add Engines to Database

**For Production** (requires DATABASE_URL to production):

```bash
cd apps/api
DATABASE_URL="postgresql://..." pnpm tsx scripts/add-gemini-engines.ts
```

**Or run full seed**:

```bash
cd apps/api
pnpm tsx prisma/seed.ts
```

### 5. Rebuild and Deploy

```bash
# Build packages
cd packages/core && pnpm build
cd ../engines && pnpm build

# Build API
cd ../../apps/api && pnpm build

# Deploy (if needed)
cd ../..
.\redeploy-api-lambda.ps1 -AwsRegion us-east-1
```

## Usage

Once configured, Gemini models will appear in the engine selection dropdown when creating or editing personas.

## Pricing (as of 2024)

- **Gemini 1.5 Pro**: $0.35 / 1M input tokens, $1.05 / 1M output tokens
- **Gemini 1.5 Flash**: $0.0075 / 1M input tokens, $0.03 / 1M output tokens
- **Gemini 1.5 Flash 8B**: $0.00375 / 1M input tokens, $0.015 / 1M output tokens
- **Gemini 2.0 Flash Exp**: Free (experimental)

## Features

- ✅ System messages (via `systemInstruction`)
- ✅ Message history
- ✅ Temperature control
- ✅ Token limits
- ✅ Usage tracking
- ✅ Function calling support
- ✅ Automatic retry with exponential backoff
- ✅ Timeout protection

## API Reference

The Gemini engine uses Google's Generative Language API:
- Base URL: `https://generativelanguage.googleapis.com/v1beta`
- Authentication: API key in query parameter
- Documentation: https://ai.google.dev/api/rest
