# leitstand-frontend

Frontend for the leitstand fleet control center. Built with Vite,
React 19, TypeScript, Tailwind, and MapLibre GL.

## Prerequisites

- Node 24 or newer.
- A running [leitstand-backend](https://gitlab.hs-osnabrueck.de/agro-technicum/ag-intelligente-agrarsysteme/workinggroup-projects/leitstand/leitstand-backend). The dev server proxies to `http://localhost:8080` by default. Change `vite.config.ts` if it lives elsewhere.

## Getting Started

```bash
npm install
npm run dev
```

Open http://localhost:5173. The dev server proxies `/api` and `/ws` to the backend and attaches
the backend's bearer token from `../leitstand-backend/secrets/leitstand_auth_bearer_token`
(override the path with the shell variable `LEITSTAND_AUTH_TOKEN_FILE`; a missing file means
an open backend, and the dev server prints which it found at startup).

## Available Scripts

| Script                 | What it does                                               |
| ---------------------- | ---------------------------------------------------------- |
| `npm run dev`          | Vite dev server on `:5173`                                 |
| `npm run dev:host`     | Vite dev server bound to `0.0.0.0` (for LAN testing)       |
| `npm run build`        | TypeScript project build, then Vite bundle into `dist/`    |
| `npm run preview`      | Serve the production bundle locally                        |
| `npm run typecheck`    | TypeScript project build, no emit                          |
| `npm run lint`         | Run ESLint                                                 |
| `npm run format`       | Run Prettier with `--write`                                |
| `npm run format:check` | Run Prettier with `--check`                                |
| `npm run codegen`      | Regenerate `src/api/generated.ts` from the backend OpenAPI |
| `npm run ci`           | typecheck + lint + format:check + build                    |

## Codegen

`src/api/generated.ts` is the committed wire-contract artifact,
generated from the leitstand-backend OpenAPI spec. To regenerate it
from a running backend:

```bash
npm run codegen
```

`BACKEND_URL` overrides the default of `http://localhost:8080`. Commit
the regenerated file together with the consuming UI in the same PR.
Never edit `generated.ts` by hand.

## Configuration

See `.env.example`.

**Frontend bundle** (`VITE_*`, baked in by Vite, exposed to the browser):

| Var                 | Default                | Purpose               |
| ------------------- | ---------------------- | --------------------- |
| `VITE_API_BASE_URL` | `/api/v1` (Vite proxy) | Backend REST base URL |
| `VITE_WS_URL`       | `/ws/v1` (Vite proxy)  | Backend WS URL        |
| `VITE_MAP_TILE_URL` | OSM                    | Map tile XYZ template |

For production traffic, point `VITE_MAP_TILE_URL` at a paid or self-hosted tile service. The OSM Tile Usage Policy prohibits heavy production use of their public free tile servers.

**Production container** (`docker-compose.yaml` here; read by `docker compose` and nginx, not Vite):

| Var                    | Default                        | Purpose                                              |
| ---------------------- | ------------------------------ | ---------------------------------------------------- |
| `BACKEND_URL`          | `http://backend:8080`          | Upstream origin; the default is the backend stack's service on the shared network |
| `FRONTEND_HOST_PORT`   | `80`                           | Host port to publish nginx on                        |
| `FRONTEND_BIND_ADDR`   | `0.0.0.0`                      | Interface to publish it on                            |
| `LEITSTAND_SECRETS_DIR`| `../leitstand-backend/secrets` | Where the backend's bearer token file lives          |

## Production Deploy

Builds the Vite bundle and serves it via nginx, reverse-proxying `/api/` and `/ws/` to the backend.
The stack joins the `leitstand` network the backend's compose stack creates, so start that first:

```bash
cd ../leitstand-backend && docker compose up -d --build   # creates the network, starts the backend
cd ../leitstand-frontend && docker compose up -d --build  # UI at http://<host>/
```

The backend's bearer token is mounted into the container as a secret and attached upstream by
`docker-entrypoint.d/15-auth-include.sh`, so the browser never holds it and rotating it is a
restart, not a rebuild. nginx resolves `backend` per request, so the frontend may come up before
the backend is healthy and simply answers 502 until it is.

There is no login: nginx attaches the bearer to every request it proxies, so whoever can reach
the UI port can operate the fleet. Publish it only on a network you trust (`FRONTEND_BIND_ADDR`
narrows the interface). nginx refuses requests whose `Origin` is another site, so a foreign web
page open in an operator's browser cannot use the bearer.

## Pre-commit Hooks

`npm install` wires husky via the `prepare` script. The hook runs
`lint-staged`, applying ESLint and Prettier to staged files only.

## Contact

Jannik Jose, jannik.jose@hs-osnabrueck.de
