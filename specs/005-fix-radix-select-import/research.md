# Research: Fix Radix UI Select Import Error in OCI Container

**Feature**: 005-fix-radix-select-import  
**Date**: 2026-04-06

---

## Finding 1: pnpm v10 Default Node Linker

**Decision**: pnpm v10's default `node-linker` is `isolated` — a symlink-based layout using a content-addressable store.

**Rationale**: Under the isolated linker, `node_modules` looks like:

```
node_modules/
  .pnpm/
    @radix-ui+react-select@2.2.6/node_modules/@radix-ui/react-select/  ← real files
    ...
  @radix-ui/
    react-select → ../.pnpm/@radix-ui+react-select@2.2.6/...            ← symlink
```

Every top-level package entry in `node_modules/` is a symlink into `.pnpm/`. Vite's `import-analysis` plugin walks these symlinks during dev server startup. Inside a container, symlink resolution depends on the real targets also being present in the same volume. When the anonymous volume is stale (see Finding 2), symlinks exist but point to a location that was never populated — so Vite reports the package as not found.

**Alternatives considered**: The `hoisted` linker produces a flat, symlink-free layout identical to npm/yarn v1. The `pnp` linker (Plug'n'Play) is incompatible with Vite without additional plugins.

---

## Finding 2: Why the Anonymous Volume Causes the Failure

**Decision**: The anonymous volume `/app/node_modules` is the root cause of the resolution failure after new packages were added in the shadcn/ui migration.

**Rationale**: The OCI container volume lifecycle with the current compose configuration is:

1. `podman-compose up --build` (first run): image builds, `pnpm install --frozen-lockfile` runs inside the image layer at `/app/node_modules`, populating it with all packages and symlinks.
2. On container start: `./frontend:/app` (bind mount) overlays the host source; then `/app/node_modules` anonymous volume is created by copying from the image layer — **only on first creation**.
3. After `@radix-ui/react-select` was added in commit `1ea3219` and the image was rebuilt: the **new image layer** contains the updated `node_modules`, but the **existing anonymous volume was not refreshed** — OCI runtimes populate anonymous volumes from the image only on first creation, not on rebuild.
4. The stale anonymous volume (without the new packages) shadows the rebuilt image layer. `vite.config.ts` references `@radix-ui/react-select`, pnpm's `node_modules` symlink points to a `.pnpm` directory that doesn't contain it, and Vite's import analysis fails.

**Alternatives considered**: Running `pnpm install` in a startup entrypoint script works around stale volumes but adds startup latency. Deleting the anonymous volume manually (`podman volume prune`) is a valid one-time fix but operationally fragile — the problem recurs on every dependency change.

---

## Finding 3: `node-linker=hoisted` vs `shamefully-hoist=true`

**Decision**: Use `node-linker=hoisted` in `frontend/.npmrc`. Do NOT use `shamefully-hoist=true`.

**Rationale**:

| Option | Effect in pnpm v10 |
|--------|--------------------|
| `shamefully-hoist=true` | Keeps `node-linker=isolated` (symlink store). Adds additional hoisted symlinks to root. The `.pnpm` virtual store and all symlinks still exist. Does NOT solve the symlink volume issue. |
| `node-linker=hoisted` | Changes the linker to produce a **flat, symlink-free** `node_modules` — identical to what npm/yarn v1 produce. No `.pnpm` store. Real files, real directories. Fully robust inside containers. |

`node-linker=hoisted` is the correct fix because it eliminates symlinks entirely. Vite's import analysis resolves packages via a simple filesystem walk, which works reliably inside containers with no cross-layer symlink dependencies.

**Tradeoff**: `node-linker=hoisted` loses pnpm's phantom dependency protection (packages not in `package.json` become importable). Acceptable for a dev-only container; does not affect CI or production builds.

---

## Finding 4: Anonymous Volume vs Named Volume Best Practice

**Decision**: Replace the anonymous volume with a named volume `frontend_node_modules` in `podman-compose.yml`.

**Rationale**: The anonymous volume pattern (`- /app/node_modules`) is fragile:
- Anonymous volumes are identified by an opaque hash. If the container service is recreated (e.g., compose service recreation), a new empty anonymous volume can shadow the installed `node_modules`.
- Anonymous volumes cannot be selectively managed (`podman volume ls` does not show human-readable names).
- There is no trigger to refresh them when the image is rebuilt.

A named volume is explicit, inspectable (`podman volume inspect my-personal-balance_frontend_node_modules`), and can be deliberately removed when a clean install is needed (`podman volume rm my-personal-balance_frontend_node_modules`).

With `node-linker=hoisted` applied, the volume is populated with flat real files — no symlink fragility.

**Alternatives considered**: Entrypoint install guard (runs `pnpm install --frozen-lockfile` on startup when `node_modules` is stale). Useful as belt-and-suspenders but adds startup overhead. Keep as optional future improvement.

---

## Finding 5: `Containerfile` vs `Dockerfile` Naming for Podman

**Decision**: Keep the existing `Dockerfile` name. No rename needed.

**Rationale**: Podman's build tooling (`podman build`, `podman-compose`) searches for `Containerfile` first, then `Dockerfile`. Both are functionally identical. Since `podman-compose.yml` specifies only `context: ./frontend` (no explicit `dockerfile:` key), Podman will locate `frontend/Dockerfile` automatically. Renaming to `Containerfile` is a cosmetic OCI convention choice with no functional impact for this project.

**Alternatives considered**: Rename `Dockerfile` → `Containerfile` and add `dockerfile: Containerfile` to `podman-compose.yml`. Unnecessary for correctness; deferred as an optional housekeeping task.

---

## Summary: Recommended Fix

Two file changes address the root cause structurally:

1. **Create `frontend/.npmrc`** with `node-linker=hoisted` → eliminates pnpm symlinks, making `node_modules` portable across container volume layers.
2. **Update `podman-compose.yml`** → replace anonymous volume with named volume `frontend_node_modules:/app/node_modules` and declare it under the top-level `volumes:` key.

After applying, run:
```bash
# Remove the old anonymous volume (one-time cleanup)
podman-compose down -v
# Rebuild and start
podman-compose up --build
```

The `vite.config.ts` `optimizeDeps.include` entries are a **Vite performance hint** (pre-bundling), not a resolution fix. They remain useful and should be kept, but they cannot resolve a package that is genuinely missing from `node_modules`. No changes to `vite.config.ts` are required.
