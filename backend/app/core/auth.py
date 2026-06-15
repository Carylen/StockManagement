from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Optional, List
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.config import settings
from app.core.database import get_db

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/v1/auth/login")

# Normalize legacy/alias role values to canonical role names
_ROLE_NORM: dict[str, str] = {
    "teknisi":      "user",
    "gl":           "group_leader",
    "group leader": "group_leader",
}


@dataclass
class Principal:
    """Unified auth principal — one identity model, two auth methods.

    auth_method is 'password' (email login) or 'nrp' (passwordless login).
    Fields not used by a given auth method are simply None.
    """
    id: str
    name: str
    role: str
    site: str
    auth_method: str  # "password" | "nrp"
    email: Optional[str] = None
    nrp: Optional[str] = None
    position: Optional[str] = None
    password: Optional[str] = None  # only set for password accounts (change-password)
    permissions: List[str] = field(default_factory=list)  # from JWT payload


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(hours=settings.ACCESS_TOKEN_EXPIRE_HOURS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> "User":  # type: ignore[name-defined]
    """Returns the User ORM object for the authenticated principal."""
    from app.models.user import User

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: Optional[str] = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == user_id, User.is_active == True))
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception
    return user


async def get_current_principal(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> Principal:
    """Returns the unified Principal for the authenticated account."""
    from app.models.user import User

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        subject_id: Optional[str] = payload.get("sub")
        permissions: List[str] = payload.get("permissions", []) or []
        if subject_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    result = await db.execute(
        select(User).where(User.id == subject_id, User.is_active == True)
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception

    return Principal(
        id=user.id,
        name=user.name,
        role=_ROLE_NORM.get((user.role or "").lower(), user.role or "user"),
        site=user.site,
        auth_method=user.auth_method,
        email=user.email,
        nrp=user.nrp,
        position=user.position,
        password=user.password,
        permissions=permissions,
    )


def require_role(*roles: str):
    async def role_checker(principal: Principal = Depends(get_current_principal)):
        if principal.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {', '.join(roles)}",
            )
        return principal

    return role_checker


# Retained for compatibility with existing routers. Since identity is now unified,
# this is a plain role check (the old principal_type gate is gone). Fase 2 replaces
# these call sites with require_permission().
require_user_role = require_role
