# My Personal Balance - Backend

This project is the backend for My Personal Balance

## Project Specification

- FastAPI
- SQLAlchemy
- JWT auth
- Database: Postgres

## Database Domain model

- users (`id`, `name`, `email`, `password`)
- accounts (`id`, `name`, `currency`, `user_id`)
- tags (`id`, `label`, `user_id`)
- transactions (`id`, `date`, `description`, `account_id`, `tag_id`, `amount`, `currency`)

## Database migrations

The backend container runs migrations at startup via:

- `alembic upgrade head`

To run manually:

```bash
cd backend
alembic upgrade head
```

## Seed demo data

Run seed in the backend container:

```bash
podman exec -it balance-api python -m app.scripts.seed
```

Demo login:

- Email: `demo@balance.local`
- Password: `demo1234`

## CSV/XLSX import format

Required columns:

- `date`
- `description`
- `amount`

Optional:

- `currency` (defaults to selected account currency if missing/blank)
- `tag_id`

## Development Guidelines

### Code Standards

### File Organization
