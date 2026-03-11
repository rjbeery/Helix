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

## Multi-Agent Chat Modes

### Panel Mode
All selected personas respond to the user's message independently and simultaneously.

### Baton Mode
Personas respond sequentially. The first persona answers the original question. Each subsequent persona reviews the previous answer and either approves it (`APPROVE: <reason>`) or revises it (`REVISE: <improved answer>`).

After each pass (starting from the second), the answer is evaluated against a truthiness rubric (relevance, correctness, completeness, clarity, brevity). If the weighted score meets the user's configured threshold (default 0.77), the chain stops early with `finalReason: 'truthiness'`.

**Important:** The truthiness check is intentionally skipped after the first persona's response to guarantee at least one baton pass occurs. Early termination only applies from the second persona onward.
