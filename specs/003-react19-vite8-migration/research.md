# Research: React 19 + Vite 8 Migration

**Feature**: 003-react19-vite8-migration  
**Date**: 2026-04-06

---

## Decision 1: Target Version Numbers

| Package | Current | Target |
|---|---|---|
| `react` | `^18.3.1` | `^19.2.4` |
| `react-dom` | `^18.3.1` | `^19.2.4` |
| `@types/react` | `^18.3.24` | `^19.0.0` |
| `@types/react-dom` | `^18.3.7` | `^19.0.0` |
| `vite` | `^7.1.3` | `^8.0.3` |
| `@vitejs/plugin-react` | `^5.0.4` | `^6.0.1` |
| `lucide-react` | `^0.544.0` | `^1.7.0` |

**Rationale**: React 19.2.4 is the latest stable release. Versions 19.0.0–19.2.2 have a known critical security vulnerability (CVE-2025-55182) — the target must be `^19.2.4` explicitly. Vite 8.0.3 is stable as of 2026-03-12. `@vitejs/plugin-react` v6 is required for Vite 8 (v5 has a compatibility layer but v6 is the first-class Vite 8 target, drops Babel in favour of Oxc). `lucide-react` v1.7.0 has cleaner React 19 type definitions vs. the older `^0.544.0` range.

**Alternatives considered**: Staying on `^18.x` / Vite 7 — rejected as it is the problem being solved. Upgrading to React 19 RC — rejected; stable release is available.

---

## Decision 2: `@vitejs/plugin-react` v6 replaces Babel with Oxc

**Decision**: Upgrade to `@vitejs/plugin-react@^6.0.1`.

**Rationale**: v6 is built specifically for Vite 8 and removes the Babel dependency entirely. React Refresh is now handled by the Oxc transformer. The `vite.config.ts` API is unchanged (`plugins: [react()]`) — no config file modifications are required.

**Alternatives considered**: Keep v5 — it works via a Vite 8 backward-compatibility shim but is not the intended path and will eventually be dropped.

---

## Decision 3: `@types/react` and `@types/react-dom` Still Required

**Decision**: Update to `^19.0.0` for both, do not remove them.

**Rationale**: React 19 does not bundle its own TypeScript types. The `@types/react@19.x` packages are required and must be updated alongside the runtime. React 19 significantly reworked the type definitions (see Breaking Changes below).

**Alternatives considered**: Remove `@types/react` — not valid; types are still shipped separately.

---

## Decision 4: Compatibility of Existing Dependencies

**Decision**: No version change required for `@tanstack/react-query`, `react-router-dom`, `react-hook-form`, `axios`, `clsx`, `tailwind-merge`, `class-variance-authority`, `date-fns`, `tailwindcss`, `postcss`, `autoprefixer`, or `typescript`.

**Rationale**:
- `react-router-dom ^7.x` explicitly targets React 18 and 19.
- `@tanstack/react-query ^5.x` supports React 19.
- `react-hook-form ^7.x` is compatible. The `watch()` API has a known React 19 re-render issue, but **no usages of `watch()` were found in the codebase** — no migration needed.
- `tailwindcss ^3.x` uses the PostCSS plugin path, which Vite 8 still supports. No breaking change.
- `typescript ^5.9.x` is unaffected.

**Alternatives considered**: Bumping react-hook-form to v8 (not yet released) — rejected; not necessary.

---

## Decision 5: Codebase Breaking Changes to Address

**Decision**: One source change is required before the upgrade can compile cleanly.

| Location | Issue | Fix |
|---|---|---|
| `frontend/src/components/ProtectedRoute.tsx:4` | Uses `JSX.Element` (global JSX namespace removed in React 19) | Replace with `React.JSX.Element` or `React.ReactNode` |

**Rationale**: React 19 removes the global `JSX` namespace. Any code that uses `JSX.Element`, `JSX.IntrinsicElements`, etc. must qualify them as `React.JSX.*`. This is the only occurrence in the codebase.

**Additional automated codemods** (recommended before bumping versions):
1. `npx codemod@latest react/19/migration-recipe` — handles `forwardRef` deprecation, prop type removals, etc. Safe to run even if the codebase has no violations; it is a no-op if nothing applies.
2. `npx types-react-codemod@latest preset-19 ./src` — handles `@types/react@18 → 19` type-level breaking changes (ref callback syntax, `useRef` argument requirement, etc.). No instances found in the codebase, but running it is defensive.

**Alternatives considered**: Skip codemods — rejected; running them is low-risk and avoids latent issues.

---

## Decision 6: `vite.config.ts` and `tsconfig.json` Changes

**Decision**: No changes required to either file.

**Rationale**:
- `vite.config.ts` only contains `plugins: [react()]` and a path alias. It has no `rollupOptions`, `esbuild` options, or custom minification. Fully forward-compatible with Vite 8.
- `tsconfig.json` already sets `"jsx": "react-jsx"` (required by React 19's new JSX transform), `"moduleResolution": "Bundler"` (correct for Vite), and `"lib": ["ES2020", "DOM", "DOM.Iterable"]`. No changes needed.

**Alternatives considered**: Rename `rollupOptions` → `rolldownOptions` — cosmetic only; the old key still works in Vite 8 (deprecated warning). Deferred; not blocking.

---

## Decision 7: `package.json` `pnpm.onlyBuiltDependencies` Update

**Decision**: Remove `"esbuild"` from `pnpm.onlyBuiltDependencies`.

**Rationale**: Vite 8 no longer depends on esbuild directly (Rolldown/Oxc handles the transform). Keeping `esbuild` in the allow-list is harmless but misleading; removing it is cleaner.

**Alternatives considered**: Leave as-is — acceptable but not ideal.

---

## Decision 8: No Docker/Container Changes Required

**Decision**: The `frontend/Dockerfile` requires no changes.

**Rationale**: It uses `node:22-alpine` and `corepack enable pnpm`. Node.js 22 supports React 19 and Vite 8. The updated `pnpm-lock.yaml` will be copied in at build time as usual.

---

## Decision 9: No Test Suite Changes Required for This Migration

**Decision**: No new tests need to be added as part of this migration task.

**Rationale**: The codebase currently has no automated tests. The spec's requirement "100% of previously passing tests continue to pass" is vacuously satisfied (0 tests, 0 failures). The constitution's test requirements apply to *new functional code*; a dependency upgrade does not introduce new functional code. No new API endpoints, components, or business logic are added.

**Alternatives considered**: Add a vitest smoke test harness during this migration — desirable as a future chore but out of scope here per the spec's "pure dependency upgrade" assumption.
