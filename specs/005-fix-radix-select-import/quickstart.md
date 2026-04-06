# Quickstart: Verifying the Fix

**Feature**: 005-fix-radix-select-import  
**Date**: 2026-04-06

## What Was Changed

| File | Change |
| ---- | ------ |
| `frontend/.npmrc` | New file — sets `node-linker=hoisted` so pnpm installs flat, symlink-free `node_modules` |
| `podman-compose.yml` | Anonymous volume `/app/node_modules` replaced with named volume `frontend_node_modules:/app/node_modules` |

## One-Time Setup After Applying the Fix

Run this once to remove the stale anonymous volume and rebuild the image with the corrected layout:

```bash
podman-compose down -v
podman-compose up --build
```

> `down -v` removes all named and anonymous volumes (including the old stale one). `up --build` rebuilds the image and populates the new `frontend_node_modules` named volume from the rebuilt image layer.

## Verification Steps

### 1. Confirm the container starts without errors

```bash
podman-compose up --build
```

Watch the frontend container log. You should NOT see:

```
[plugin:vite:import-analysis] Failed to resolve import "@radix-ui/react-select"
```

You SHOULD see Vite's normal startup output:

```
  VITE v8.x.x  ready in XXX ms

  ➜  Local:   http://localhost:5173/
```

### 2. Open the application and check the Select component

Navigate to `http://localhost:5173` in a browser and open any page that uses the Select UI component (e.g., transaction entry forms).

- Open the browser developer console (F12 → Console tab)
- Confirm there are **no import resolution errors**
- Confirm the Select dropdown opens, displays options, and accepts a selection

### 3. Verify local development still works

After the container test, confirm local dev is unaffected:

```bash
cd frontend
pnpm install   # optional — only if you haven't installed locally yet
pnpm run dev
```

Navigate to the same page and confirm the Select component works identically.

## Inspecting the Named Volume (Optional)

To confirm the named volume exists and is populated:

```bash
podman volume ls | grep frontend
podman volume inspect my-personal-balance_frontend_node_modules
```

To force a clean reinstall (e.g., after future dependency changes):

```bash
podman volume rm my-personal-balance_frontend_node_modules
podman-compose up --build
```

## Troubleshooting

| Symptom | Likely cause | Fix |
| ------- | ------------ | --- |
| Same import error after rebuild | Old anonymous volume still present | Run `podman-compose down -v` then `up --build` |
| `pnpm-lock.yaml` conflict on `pnpm install` | Lock file generated with different linker | Delete `node_modules` locally and run `pnpm install` again |
| Other Radix UI packages missing | The same root cause applies | All Radix UI packages are in `package.json`; `node-linker=hoisted` resolves them all |
