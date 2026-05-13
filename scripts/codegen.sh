#!/usr/bin/env bash
# Pull the OpenAPI spec from a running backend and regenerate
# src/api/generated.ts. Defaults to a local backend on :8080.
# Override BACKEND_URL to point at staging, prod, a teammate's tunnel, etc.
set -euo pipefail
BACKEND_URL="${BACKEND_URL:-http://localhost:8080}"
mkdir -p src/api
curl -fsSL "$BACKEND_URL/openapi.json" -o /tmp/openapi.json
npx --yes openapi-typescript@^7 /tmp/openapi.json -o src/api/generated.ts
echo "[codegen] wrote src/api/generated.ts (from $BACKEND_URL)"
