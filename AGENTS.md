# My Personal Balance Agent Instructions

My Personal Balance is a project focused on the management of a persons financial health.
It aims to be a way for a person to better manage ther bank accounts and their financial spendings.

## Development Guidelines

### Git branch

A git branch should use the following pattern:

`${work-type}/brief-description-from-spec`

#### Work types

- feat: a new feature to be developed in the project. It is a feature related to the project. If this is something that is related to the project architecture, or something related to the tools/libraries used in the project this is not a new feature.
- chore: A chore is a work that is not a feature, it is a change that is not adding, nor removing a feature. It might be something related to the architecture of the project, or a change in the project structure. For example, could be used in a library update.
- fix: A fix is used when we are fixing something that is broken. Maybe because we missed a test or we changed something and a feature is no longer working as expected.
- docs: A docs change is used when we are adding or updating documentation. This includes README files, AGENTS.md files, specs, and other documentation artifacts.
- other: All other types of changes.

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
