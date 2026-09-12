"""Password hashing (bcrypt) and JWT issuing/verification (PyJWT, HS256)."""

from __future__ import annotations

import re
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from .config import get_settings

USERNAME_RE = re.compile(r"^[a-z0-9_]{3,24}$")
MIN_PASSWORD_LEN = 6
#: bcrypt refuses secrets longer than 72 bytes.
MAX_PASSWORD_BYTES = 72


def hash_password(password: str) -> str:
    """Hash a plaintext password with a fresh bcrypt salt."""
    raw = password.encode("utf-8")[:MAX_PASSWORD_BYTES]
    return bcrypt.hashpw(raw, bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str | None) -> bool:
    """Constant-time password check; False for players without credentials."""
    if not password_hash:
        return False
    try:
        return bcrypt.checkpw(password.encode("utf-8")[:MAX_PASSWORD_BYTES], password_hash.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def create_token(player_id: str) -> str:
    """Issue a 30-day HS256 bearer token with payload ``{sub, iat, exp}``."""
    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": player_id,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(days=settings.jwt_expiry_days)).timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret_effective, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> str | None:
    """Return the player id from a valid token, or None when it is unusable."""
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret_effective, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError:
        return None
    sub = payload.get("sub")
    return sub if isinstance(sub, str) and sub else None


def guest_display_name() -> str:
    """Anonymous display name such as ``Cadet-4f3a``."""
    return f"Cadet-{secrets.token_hex(2)}"


def new_share_slug() -> str:
    """8-character url-safe showcase slug."""
    alphabet = "abcdefghijkmnopqrstuvwxyz23456789"
    return "".join(secrets.choice(alphabet) for _ in range(8))
