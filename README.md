# leitstand-frontend

Operator interface of the Leitstand fleet control center for field robots. Operators follow the
robots on a live map, define fields, sites and missions, dispatch missions and follow their runs,
and work with an AI assistant whose proposed fleet changes wait for their approval. Built with Vite,
React 19, TypeScript, Tailwind, and MapLibre GL.

## Prerequisites

- Node 24 or newer.
- A running [leitstand-backend](https://github.com/AI-RLA/leitstand-backend). The dev server proxies to `http://localhost:8080` by default. Change `vite.config.ts` if it lives elsewhere.

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

The maps draw the application's data on top of a basemap, a street map or aerial imagery that
operators select with the map's layer button. The basemaps are configured at runtime, not at build
time, as documented in [docs/map-config.md](docs/map-config.md).

**Production container** (`docker-compose.yaml` here; read by `docker compose` and nginx, not Vite):

| Var                     | Default                        | Purpose                                                                           |
| ----------------------- | ------------------------------ | --------------------------------------------------------------------------------- |
| `BACKEND_URL`           | `http://backend:8080`          | Upstream origin; the default is the backend stack's service on the shared network |
| `FRONTEND_HOST_PORT`    | `80`                           | Host port to publish nginx on                                                     |
| `FRONTEND_BIND_ADDR`    | `0.0.0.0`                      | Interface to publish it on                                                        |
| `LEITSTAND_SECRETS_DIR` | `../leitstand-backend/secrets` | Where the backend's bearer token file lives                                       |

## Production Deploy

The Leitstand is a research prototype. The connection between the backend and the robots is
neither authenticated nor encrypted, and the operator interface has no user accounts. Run all
components on a private network or behind a VPN.

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

## License

Copyright 2026 Osnabrück University of Applied Sciences.
Apache License 2.0, see [LICENSE](LICENSE).
