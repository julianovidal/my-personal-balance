# Spec: Demo login uses an example.com address

## Problem

`python -m app.scripts.seed` creates the demo user as `demo@balance.local`, and the README lists that login. But `LoginRequest.email` and `RegisterRequest.email` are pydantic `EmailStr`, and email-validator rejects `.local` because it is a special-use domain. `POST /api/auth/login` therefore returns 422 for the demo user before the password is even checked. This happens on the current stack (Python 3.12, email-validator 2.2.0) and after the Python 3.14 upgrade.

## Change

- The demo user's email becomes `demo@example.com`. `example.com` is reserved for documentation and email-validator accepts it. The password stays `demo1234`.
- `app/scripts/seed.py` defines the address once, as `DEMO_EMAIL`, and uses it for the lookup, the insert, and the printed message.
- The README shows `demo@example.com` / `demo1234`.
- Login and register validation do not change.

## Existing databases

The seed script finds the demo user by email. On a database seeded before this change, re-running it would create a second demo user instead of reusing the old one. Rename the existing row once:

```sql
UPDATE users SET email = 'demo@example.com' WHERE email = 'demo@balance.local';
```

The demo user keeps its accounts, tags, and transactions.

## Tests

`backend/tests/test_seed.py`:

- `DEMO_EMAIL` passes `LoginRequest` validation.
- Seeding an empty database creates exactly one user, `DEMO_EMAIL`, who can log in through `POST /api/auth/login` with `demo1234`.
- Seeding twice still leaves one demo user.

## Out of scope

- Accepting reserved domains in login or register.
- Renaming the row automatically from the seed script.
