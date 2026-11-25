"""Register and login through the API, against Postgres."""

from app.models.user import User

from tests.test_security import STORED_HASH, STORED_PASSWORD


def register(client, password: str, email: str = "ana@example.com"):
    return client.post("/api/auth/register", json={"name": "Ana", "email": email, "password": password})


def login(client, password: str, email: str = "ana@example.com"):
    return client.post("/api/auth/login", json={"email": email, "password": password})


def test_register_then_login(client):
    assert register(client, "s3cret-pass").status_code == 200

    response = login(client, "s3cret-pass")

    assert response.status_code == 200
    assert response.json()["token_type"] == "bearer"
    assert response.json()["access_token"]


def test_login_with_wrong_password_is_401(client):
    register(client, "s3cret-pass")

    assert login(client, "wrong").status_code == 401


def test_register_with_a_72_byte_password_is_accepted(client):
    assert register(client, "a" * 72).status_code == 200
    assert login(client, "a" * 72).status_code == 200


def test_register_with_a_password_over_72_bytes_is_422(client, db):
    response = register(client, "ñ" * 37)  # 74 bytes

    assert response.status_code == 422
    assert "at most 72 bytes" in response.text
    assert db.query(User).count() == 0


def test_user_hashed_by_passlib_can_still_log_in(client, db):
    db.add(User(name="Old", email="old@example.com", password=STORED_HASH))
    db.commit()

    assert login(client, STORED_PASSWORD, email="old@example.com").status_code == 200
    assert login(client, "nope", email="old@example.com").status_code == 401


def test_user_with_a_malformed_stored_hash_gets_401_not_500(client, db):
    db.add(User(name="Broken", email="broken@example.com", password="not-a-hash"))
    db.commit()

    assert login(client, "anything", email="broken@example.com").status_code == 401
