# Research: Frontend pnpm Migration

**Feature**: 002-frontend-pnpm-migration  
**Date**: 2026-04-06

## Decision 1: How to install pnpm in the Docker image

**Decision**: Use `corepack enable pnpm` in the Dockerfile.

**Rationale**: Node.js 22 ships with Corepack built-in. `corepack enable pnpm` activates the pnpm shim without requiring a separate `npm install -g pnpm` step, keeping the image lean and avoiding npm for the install itself. Corepack also pins the pnpm version declared in `package.json` (`packageManager` field), ensuring reproducible builds.

**Alternatives considered**:
- `npm install -g pnpm` — works but contradicts the goal of removing npm invocations from the build process.
- Downloading a standalone pnpm binary — more complex, requires curl/wget, no advantage over Corepack for this setup.

---

## Decision 2: pnpm-lock.yaml generation strategy

**Decision**: Generate `pnpm-lock.yaml` by running `pnpm import` (to convert from `package-lock.json`) or `pnpm install` from scratch after removing `package-lock.json`.

**Rationale**: `pnpm import` reads an existing `package-lock.json` or `yarn.lock` and produces an equivalent `pnpm-lock.yaml` with the same resolved versions, minimising dependency churn. If `pnpm import` produces any resolution differences, a clean `pnpm install` from `package.json` is the fallback.

**Alternatives considered**:
- Running `pnpm install` cold (ignoring existing lockfile) — valid but may upgrade transitive dependencies to newer patch/minor versions, which is undesirable during a tooling-only migration.

---

## Decision 3: Dockerfile CMD strategy

**Decision**: Replace `RUN npm install` with `RUN corepack enable pnpm && pnpm install --frozen-lockfile` and replace `CMD ["npm", "run", "dev"]` with `CMD ["pnpm", "run", "dev"]`.

**Rationale**: `--frozen-lockfile` (pnpm equivalent of `npm ci`) ensures the container build uses exactly the resolved versions in `pnpm-lock.yaml` and fails loudly if the lockfile is out of date, preventing silent dependency drift in container builds.

**Alternatives considered**:
- `pnpm install` without `--frozen-lockfile` — less strict; allows lockfile drift in containers, which is undesirable for reproducibility.

---

## Decision 4: `packageManager` field in package.json

**Decision**: Add a `"packageManager": "pnpm@<version>"` field to `frontend/package.json`.

**Rationale**: This field is read by Corepack to pin the exact pnpm version used by this project. It also signals to contributors and agents which package manager is expected, preventing accidental `npm install` or `yarn` invocations (Corepack will intercept and warn).

**Alternatives considered**:
- Not adding the field — Corepack still works but will use the system-default pnpm version, reducing reproducibility.

---

## Decision 5: Constitution amendment scope

**Decision**: PATCH version bump to `constitution.md`, updating the Node lockfile reference from `package-lock.json` to `pnpm-lock.yaml` and adding `pnpm` as the designated Node package manager.

**Rationale**: The change is a clarification of tooling — no Core Principle is added, removed, or redefined. PATCH is the correct semantic version per the amendment procedure in the constitution.

**Alternatives considered**:
- MINOR bump — not warranted; no new principle or materially expanded guidance.

---

## All NEEDS CLARIFICATION items resolved

No NEEDS CLARIFICATION markers were present in the spec. All research decisions above were determined from existing project context and pnpm best practices.
