# My Personal Balance Agent Instructions

My Personal Balance is a project focused on the management of a persons financial health.
It aims to be a way for a person to better manage ther bank accounts and their financial spendings.

## Project Specifications

### Backend

Backend specifications are based on `./backend/AGENTS.md`

### Frontent

Frontend specifications are based on `./frontend/AGENTS.md`

### Classifier

Classifier specifications are based on `./classifier/AGENTS.md`

## Run locally with Podman

Prerequisites:

- podman
- podman-compose

From project root:

```bash
podman-compose -f podman-compose.yml up --build
```

Apps:

- Frontend: [http://localhost:5173](http://localhost:5173)
- Backend docs: [http://localhost:8000/docs](http://localhost:8000/docs)
- Classifier health: [http://localhost:8001/health](http://localhost:8001/health)
- Health: [http://localhost:8000/health](http://localhost:8000/health)

## Active Technologies
- Python 3.12 (both backend and classifier) (001-migrate-python-uv)
- PostgreSQL 16 (unchanged) (001-migrate-python-uv)
- Node.js 22 (via `node:22-alpine` Docker image); TypeScript 5.9 + pnpm (latest stable via `corepack enable pnpm`); React 19, Vite 8, Tailwind 3, TanStack Query 5 (002-frontend-pnpm-migration → updated by 003-react19-vite8-migration)
- N/A — no storage layer involved (002-frontend-pnpm-migration)
- TypeScript 5.9 / Node.js 22 + React 19.2.4, Vite 8.0.3, @vitejs/plugin-react 6.0.1, pnpm 10 (003-react19-vite8-migration)

## Recent Changes
- 001-migrate-python-uv: Added Python 3.12 (both backend and classifier)
