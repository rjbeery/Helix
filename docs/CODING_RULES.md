Coding rules for Claude

Do not break monorepo package boundaries.

apps/web must not call model providers directly.

apps/api must call orchestrator.

packages/engines contains provider adapters only.

packages/core contains shared types.

Do not move build output paths without understanding tsconfig rootDir.

Prefer small targeted changes over broad refactors.
