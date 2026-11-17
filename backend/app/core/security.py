"""Password hashing (passlib/bcrypt) and JWT helpers."""

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from uuid import UUID

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

# passlib 1.7 + bcrypt 4.1+/5 can disagree on wrap detection. Prefer
# passlib, and fall back to the bcrypt library if initialization fails.
_pwd_context: Optional[CryptContext] = None
try:
    _pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    # Probe once so a broken backend fails at import/test time, not mid-request.
    _pwd_context.hash("probe")
except Exception:  # pragma: no cover - environment-specific
    _pwd_context = None

try:
    import bcrypt as _bcrypt
except Exception:  # pragma: no cover
    _bcrypt = None


def hash_password(password: str) -> str:
    if _pwd_context is not None:
        return _pwd_context.hash(password)
    if _bcrypt is None:
        raise RuntimeError("No password hashing backend is available")
    return _bcrypt.hashpw(password.encode("utf-8"), _bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    if _pwd_context is not None:
        try:
            return _pwd_context.verify(password, password_hash)
        except Exception:
            pass
    if _bcrypt is None:
        return False
    try:
        return _bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: UUID, extra: Optional[dict[str, Any]] = None) -> str:
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "typ": "access",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)).timestamp()),
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.JWT_ALGORITHM])


def generate_refresh_token() -> tuple[str, str]:
    """Return (raw_token, sha256_hex) — store only the hash."""
    raw = secrets.token_urlsafe(48)
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()
    return raw, digest


def hash_refresh_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()
