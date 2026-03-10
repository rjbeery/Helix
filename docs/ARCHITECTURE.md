# Helix Architecture

Helix is a multi-LLM orchestration system.

User → Web UI → API → Orchestrator → Engine Adapter → Model Provider → Response

Major layers:

apps/web
React + Vite UI

apps/api
Express API deployed as AWS Lambda

packages/core
shared types

packages/engines
model provider adapters

packages/memory
RAG and embeddings

packages/utils
shared helpers

packages/telemetry
token and cost tracking

infra/terraform
AWS infrastructure
