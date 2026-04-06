# Implementation Plan: Fix Radix UI Select Import Error in OCI Container

**Branch**: `005-fix-radix-select-import` | **Date**: 2026-04-06 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `/specs/005-fix-radix-select-import/spec.md`

## Summary

The `@radix-ui/react-select` package fails to resolve at runtime inside the Podman dev container. The root cause is a **stale anonymous volume** combined with **pnpm v10's isolated (symlink-based) node linker**: after the shadcn/ui migration added new packages and the image was rebuilt, the pre-existing anonymous volume for `/app/node_modules` was never refreshed, so it still contains the old `node_modules` without the new packages. The fix replaces the anonymous volume with a named volume and configures pnpm to use a flat, symlink-free `node_modules` layout (`node-linker=hoisted`), making the container's module resolution reliable and reproducible.

## Technical Context

**Language/Version**: TypeScript 5 / Node.js 22-alpine  
**Primary Dependencies**: Vite 8, pnpm 10.33.0, React 19, shadcn/ui (Radix UI + CVA + Tailwind)  
**Storage**: N/A  
**Testing**: Vitest (no new tests required — this is a container config fix; acceptance tested by running the container)  
**Target Platform**: OCI container runtime (Podman + podman-compose), Linux Alpine  
**Project Type**: Frontend web application — dev container configuration fix  
**Performance Goals**: No runtime performance change. `node-linker=hoisted` may marginally affect install time in CI, which is acceptable.  
**Constraints**: Must not break local development (`node-linker=hoisted` is compatible with local pnpm usage); `pnpm-lock.yaml` must not change (no dependency additions/removals)  
**Scale/Scope**: Two configuration file changes + one new file; no source code changes

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
| --------- | ------ | ----- |
| I. Code Quality | ✅ PASS | Config-only changes. Each file has a single, clear responsibility. No dead code introduced. |
| II. Testing Standards | ✅ PASS | No new API endpoints or financial data components. Acceptance test: start container, load page with Select component, verify no console errors. |
| III. User Experience Consistency | ✅ PASS | No UX changes. shadcn/ui Select component behavior unchanged. |
| IV. Performance Requirements | ✅ PASS | No request path changes. `node-linker=hoisted` does not affect runtime performance. |
| Technology Constraints | ✅ PASS | Fix is Podman + pnpm compatible. No new external dependencies. No lock file changes. |
| Development Workflow | ✅ PASS | No schema changes, no migration required, no new dependencies. |

**Post-design re-check**: ✅ All gates still pass. The fix is confined to `frontend/.npmrc` and `podman-compose.yml`. No architectural additions.

## Project Structure

### Documentation (this feature)

```text
specs/005-fix-radix-select-import/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── quickstart.md        # Phase 1 output — verification steps
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code Changes

```text
frontend/
└── .npmrc               # NEW — sets node-linker=hoisted for pnpm

podman-compose.yml       # MODIFIED — replace anonymous volume with named volume
```

No changes to:

- `frontend/Dockerfile` — Dockerfile naming is fine for Podman; no structural changes needed
- `frontend/vite.config.ts` — `optimizeDeps.include` entries are correct and should be kept
- `frontend/package.json` — no dependency changes
- `frontend/pnpm-lock.yaml` — no lock file changes
- Any source files under `frontend/src/`

**Structure Decision**: Single-project layout. Frontend configuration only. The backend and classifier services are unaffected.

## Complexity Tracking

No constitution violations. No complexity justification required.

---

## Phase 0: Research

See [research.md](research.md) for full findings.

### Key Decisions from Research

| Unknown | Resolution |
| ------- | ---------- |
| Root cause of import failure | Stale anonymous OCI volume; pnpm v10 isolated linker symlinks are not refreshed when image is rebuilt |
| `node-linker=hoisted` vs `shamefully-hoist=true` | Use `node-linker=hoisted` — fully eliminates symlinks. `shamefully-hoist` keeps symlinks and does not fix the problem. |
| Anonymous vs named volume | Named volume preferred — explicit, inspectable, deliberately removable |
| `Dockerfile` vs `Containerfile` | Keep `Dockerfile` — Podman accepts both; renaming has no functional benefit |
| `vite.config.ts` changes needed | None — `optimizeDeps.include` is correct as-is and should be kept |

---

## Phase 1: Design

### Change 1: `frontend/.npmrc` (new file)

```ini
node-linker=hoisted
```

**Effect**: pnpm installs packages into a flat `node_modules/` directory — no `.pnpm` virtual store, no symlinks. Every package is a real directory directly under `node_modules/`. This is compatible with:

- Vite's import analysis (no symlink traversal needed)
- Local development (works identically to npm/yarn layout)
- `pnpm install --frozen-lockfile` (lockfile format is unaffected by the linker setting)

### Change 2: `podman-compose.yml` — Named Volume

Replace:

```yaml
    volumes:
      - ./frontend:/app
      - /app/node_modules              # anonymous volume — stale after rebuild
```

With:

```yaml
    volumes:
      - ./frontend:/app
      - frontend_node_modules:/app/node_modules   # named volume — inspectable
```

And in the top-level `volumes:` block, add the declaration:

```yaml
volumes:
  balance_pg_data:
  frontend_node_modules:              # declare the named volume
```

**Effect**: The named volume is explicitly managed. After applying the fix, developers remove the old volume once and the new named volume is populated correctly on the next build with the flat `node_modules` layout.

### One-Time Migration Command

After applying the two changes, run once to clear the stale volume and rebuild:

```bash
podman-compose down -v
podman-compose up --build
```

`down -v` removes all volumes including the old anonymous one. `up --build` rebuilds the image and populates the new named volume from the rebuilt image layer (with the correct flat `node_modules`).

### No Changes Required To

- `frontend/vite.config.ts`: The `optimizeDeps.include` array is correct and should remain. It pre-bundles the Radix UI packages for Vite's dev server — a useful hint once the packages are correctly installed.
- `frontend/Dockerfile`: No structural issues. The build sequence (`pnpm install --frozen-lockfile` → `COPY . .`) is correct.
- Any source files.

### Agent Context Update

Run after Phase 1:

```bash
.specify/scripts/bash/update-agent-context.sh opencode
```
