"""Password hashing in app/core/security.py, without a database.

These tests pinned passlib's behavior before it was replaced with direct bcrypt
calls, ahead of the move from bcrypt 4 to 5 (specs/python-3-14-backend-and-classifier.md).
The only expectation that changed is that hashing a password longer than 72
bytes is now rejected.
"""

import pytest

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


def test_password_of_exactly_72_bytes_hashes_and_verifies():
    password = "a" * 72
    hashed = hash_password(password)

    assert verify_password(password, hashed)
    assert not verify_password("a" * 71, hashed)


def test_password_longer_than_72_bytes_is_rejected_when_hashing():
    # bcrypt reads only 72 bytes. Rejecting longer passwords is the one planned
    # change from passlib, which cut them off silently.
    with pytest.raises(ValueError, match="at most 72 bytes"):
        hash_password("a" * 73)


def test_multibyte_characters_count_as_bytes_not_characters():
    with pytest.raises(ValueError, match="at most 72 bytes"):
        hash_password("ñ" * 37)  # 37 characters, 74 bytes


def test_long_password_still_verifies_against_a_hash_passlib_cut_at_72():
    # passlib hashed only the first 72 bytes of a longer password. Verifying
    # cuts the same way, so those users can still log in with what they typed.
    hash_of_first_72_bytes = hash_password("a" * 72)

    assert verify_password("a" * 73, hash_of_first_72_bytes)
    assert verify_password("a" * 200, hash_of_first_72_bytes)


@pytest.mark.parametrize(
    "bad_hash",
    [
        "",
        "not-a-hash",
        "$2b$12$short",  # bcrypt 4.0.1 panics on this one
        STORED_HASH[:-1],
        STORED_HASH + "x",
        "$1$" + STORED_HASH[3:],
        "plaintext-password",
        "contraseña",
    ],
)
def test_malformed_stored_hash_does_not_verify(bad_hash):
    assert verify_password("anything", bad_hash) is False
