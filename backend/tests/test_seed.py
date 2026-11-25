"""The demo seed (app/scripts/seed.py) produces a user who can log in."""

from app.models.user import User
from app.schemas.auth import LoginRequest
from app.scripts.seed import DEMO_EMAIL, DEMO_PASSWORD, seed_demo_data


def test_demo_email_passes_login_validation():
    assert LoginRequest(email=DEMO_EMAIL, password=DEMO_PASSWORD).email == DEMO_EMAIL


def test_seeded_demo_user_can_log_in(client, db):
    seed_demo_data(db)

    response = client.post("/api/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD})

    assert response.status_code == 200
    assert response.json()["access_token"]


def test_seeding_twice_keeps_one_demo_user(db):
    seed_demo_data(db)
    seed_demo_data(db)

    assert db.query(User).filter(User.email == DEMO_EMAIL).count() == 1
    assert db.query(User).count() == 1
