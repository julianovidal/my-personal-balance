import re
from datetime import datetime, timedelta, timezone

import bcrypt
from jose import jwt

from app.core.config import settings

ALGORITHM = "HS256"

# bcrypt reads only the first 72 bytes of a password. New passwords longer than
# that are rejected (RegisterRequest checks it first, so the API returns a 422).
# Verifying cuts the input to 72 bytes, the same way passlib did when it made
# every stored hash, so existing users with longer passwords can still log in.
BCRYPT_MAX_PASSWORD_BYTES = 72

# $2b$12$ + 22-character salt + 31-character digest, in bcrypt's base64 alphabet.
BCRYPT_HASH = re.compile(r"\$2[abxy]\$\d{2}\$[./A-Za-z0-9]{53}")


def password_byte_length(password: str) -> int:
    return len(password.encode("utf-8"))


def hash_password(password: str) -> str:
    encoded = password.encode("utf-8")
    if len(encoded) > BCRYPT_MAX_PASSWORD_BYTES:
        raise ValueError(f"Password must be at most {BCRYPT_MAX_PASSWORD_BYTES} bytes")
    return bcrypt.hashpw(encoded, bcrypt.gensalt()).decode("ascii")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    # Check the shape first: bcrypt 4 panics (PanicException, not an Exception)
    # on some malformed hashes instead of raising ValueError.
    if not BCRYPT_HASH.fullmatch(hashed_password):
        return False
    candidate = plain_password.encode("utf-8")[:BCRYPT_MAX_PASSWORD_BYTES]
    try:
        return bcrypt.checkpw(candidate, hashed_password.encode("ascii"))
    except ValueError:
        return False


def create_access_token(subject: str) -> str:
    expires_delta = timedelta(minutes=settings.access_token_expire_minutes)
    expire = datetime.now(timezone.utc) + expires_delta
    payload = {"sub": subject, "exp": expire}
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)
