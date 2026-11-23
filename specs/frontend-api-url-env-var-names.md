# Spec: Align frontend API URL environment variable names with the project

## Assumptions (correct before implementation)

1. **New names follow the compose container names.** `balance-api` becomes `VITE_BALANCE_API_URL`, and `balance-classifier` becomes `VITE_BALANCE_CLASSIFIER_URL`.
2. **Hard rename, with no fallback to the old names.** This is a self-hosted project, and the only configuration in the repo that sets these variables is `podman-compose.yml`.
3. **Values and defaults stay the same.** Only the names change.
4. **`frontend/.env.example` lists both variables.** It lists only the backend URL today, so the classifier URL is added as part of this rename.

## Objective

The frontend reads two URLs from the environment: `VITE_API_URL` for the backend and `VITE_CLASSIFIER_API_URL` for the classifier. The names do not match how the project names these services, and `VITE_API_URL` does not say which of the two APIs it points to.

Rename both variables so a developer can match each one to its compose container:

| Old name | New name | Compose container | Client | Value (unchanged) |
| --- | --- | --- | --- | --- |
| `VITE_API_URL` | `VITE_BALANCE_API_URL` | `balance-api` | `src/api/client.ts` | `http://localhost:8000/api` |
| `VITE_CLASSIFIER_API_URL` | `VITE_BALANCE_CLASSIFIER_URL` | `balance-classifier` | `src/api/classifierClient.ts` | `http://localhost:8001` |

This is a configuration rename. Users see no change, and every request goes to the same URL as before.

**Out of scope:**

- The difference where the backend URL includes `/api` and the classifier URL does not
- Backend and classifier environment variables
- Typing `ImportMetaEnv` in `src/vite-env.d.ts`
- Removing the hardcoded default URLs in the clients

## Tech Stack

Vite 8 exposes variables with the `VITE_` prefix through `import.meta.env`. Tests use Vitest with happy-dom.

## Commands

```bash
cd frontend && pnpm test
cd frontend && pnpm run build
git grep -n -E 'VITE_API_URL|VITE_CLASSIFIER_API_URL' -- ':!specs/' ':!frontend/tests/apiClients.test.ts'
podman-compose -f podman-compose.yml up --build
```

## Project Structure

| File | Change |
| --- | --- |
| `frontend/src/api/client.ts` | Read `VITE_BALANCE_API_URL` |
| `frontend/src/api/classifierClient.ts` | Read `VITE_BALANCE_CLASSIFIER_URL` |
| `frontend/tests/apiClients.test.ts` | New test for both clients |
| `frontend/.env.example` | Use the new backend name and add the classifier variable |
| `podman-compose.yml` | Rename both variables under the `frontend` service |
| `AGENTS.md` | Update the references on lines 43, 44, and 196 |

## Code Style

Keep the existing client pattern and change only the variable name:

```ts
export const api = axios.create({
  baseURL: import.meta.env.VITE_BALANCE_API_URL ?? "http://localhost:8000/api",
  headers: token ? { Authorization: `Bearer ${token}` } : undefined
});
```

## Testing Strategy

Add `frontend/tests/apiClients.test.ts`. For each client, use `vi.stubEnv`, `vi.resetModules`, and a dynamic import to check that:

- The new variable sets `baseURL`.
- Setting only the old variable has no effect, and the client uses its default URL.

A missed rename does not fail loudly, because the clients fall back to their defaults. These tests catch that in the source. The compose file and `.env.example` are covered by the `git grep` check and the manual run.

## Boundaries

- **Always:** Run `pnpm test` and `pnpm run build` before the `[tech]` commit.
- **Always:** Keep the `[specs]`, `[tech]`, and `[docs]` changes in separate commits. `.env.example` and `podman-compose.yml` go in the `[tech]` commit, and `AGENTS.md` goes in the `[docs]` commit.
- **Ask first:** Any change to a URL value or default, or any scope beyond the files listed above.
- **Never:** Commit `.env` files or edit other environment variables as part of this change.

## Success Criteria

- [ ] Both clients read only the new variable names.
- [ ] `git grep` for the old names, excluding `specs/` and the new test that checks they are ignored, returns no matches.
- [ ] `frontend/.env.example` lists `VITE_BALANCE_API_URL` and `VITE_BALANCE_CLASSIFIER_URL`.
- [ ] `podman-compose.yml` sets both new names under the `frontend` service, with the same values as before.
- [ ] `AGENTS.md` uses the new names, and its `.env.example` entry lists both.
- [ ] The new client tests pass, along with the rest of `pnpm test`, and `pnpm run build` succeeds.
- [ ] Manual: after recreating the frontend container, login and the Classifier page's account flow both work, and requests go to ports 8000 and 8001.

## Upgrade Note

Anyone with a local `frontend/.env` or their own deployment settings must rename these variables. If they don't, the frontend silently uses the localhost defaults. That is harmless with the default ports but sends requests to the wrong place on any other setup. The repo's working copy has no `frontend/.env`. A running compose container must be recreated to pick up the new names.

## Decisions

- **Keep the `VITE_` prefix.** Vite only exposes variables with this prefix to browser code by default. A custom `envPrefix` such as `BALANCE_` would make any future `BALANCE_*` variable public, including a secret.
- **Use `VITE_BALANCE_API_URL` and `VITE_BALANCE_CLASSIFIER_URL`.** They follow the compose container names, and both variables change. `VITE_BACKEND_API_URL` and `VITE_CLASSIFIER_API_URL` would have left the classifier variable unchanged.
