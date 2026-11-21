"""Test setup.

API tests use a real Postgres database, `balance_test`, separate from the app's
`balance` database. It is created on first use. Override the URL with
TEST_DATABASE_URL. Tests that only exercise pure functions need no database.
"""

import os

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker

TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL", "postgresql+psycopg2://balance:balance@localhost:5432/balance_test"
)


def _ensure_database(url: str) -> None:
    target = make_url(url)
    admin = create_engine(target.set(database="postgres"), isolation_level="AUTOCOMMIT")
    with admin.connect() as conn:
        exists = conn.execute(text("SELECT 1 FROM pg_database WHERE datname = :n"), {"n": target.database}).scalar()
        if not exists:
            conn.execute(text(f'CREATE DATABASE "{target.database}"'))
    admin.dispose()


@pytest.fixture(scope="session")
def engine():
    from app.core.database import Base
    import app.models  # noqa: F401  (registers every table on Base.metadata)

    try:
        _ensure_database(TEST_DATABASE_URL)
    except Exception as exc:  # pragma: no cover - environment dependent
        pytest.skip(f"Postgres test database unavailable: {exc}")
    eng = create_engine(TEST_DATABASE_URL, future=True)
    Base.metadata.drop_all(eng)
    Base.metadata.create_all(eng)
    yield eng
    Base.metadata.drop_all(eng)
    eng.dispose()


@pytest.fixture
def db(engine):
    Session = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = Session()
    yield session
    session.close()
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE transactions, account_import_mappings, tags, accounts, users RESTART IDENTITY CASCADE"))


@pytest.fixture
def client(db):
    from fastapi.testclient import TestClient

    from app.core.database import get_db
    from app.main import app

    app.dependency_overrides[get_db] = lambda: db
    yield TestClient(app)
    app.dependency_overrides.clear()
