"""Password hashing in app/core/security.py, without a database.

These tests pin current behavior so passlib can be replaced with direct bcrypt
calls and bcrypt can move from 4 to 5 (specs/python-3-14-backend-and-classifier.md).
"""

from app.core.security import hash_password, verify_password

# Made by passlib 1.7.4 with bcrypt 4.0.1, which is how every stored password was
# hashed. It must keep verifying after the library changes.
STORED_PASSWORD = "correct horse battery staple"
STORED_HASH = "$2b$12$Zugr0OLPhzuFVGYarW1J2ur8NFggsnaDo1/JNAQc1vtoZvI5L2coK"


def test_hash_then_verify():
    hashed = hash_password("s3cret-pass")

    assert hashed.startswith("$2b$")
    assert hashed != "s3cret-pass"
    assert verify_password("s3cret-pass", hashed)


def test_wrong_password_does_not_verify():
    assert not verify_password("wrong", hash_password("s3cret-pass"))


def test_hashes_are_salted():
    assert hash_password("same") != hash_password("same")


def test_stored_hash_still_verifies():
    assert verify_password(STORED_PASSWORD, STORED_HASH)
    assert not verify_password(STORED_PASSWORD + "!", STORED_HASH)


def test_non_ascii_password_round_trips():
    hashed = hash_password("contraseña-ñandú-€")

    assert verify_password("contraseña-ñandú-€", hashed)
    assert not verify_password("contrasena-nandu-E", hashed)


def test_current_password_longer_than_72_bytes_is_cut_at_72():
    # bcrypt only uses the first 72 bytes. passlib with bcrypt 4 cuts the rest
    # off silently, so the 72-byte prefix verifies too.
    long_password = "a" * 73
    hashed = hash_password(long_password)

    assert verify_password(long_password, hashed)
    assert verify_password("a" * 72, hashed)
    assert not verify_password("a" * 71, hashed)
