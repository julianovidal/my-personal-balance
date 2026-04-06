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
