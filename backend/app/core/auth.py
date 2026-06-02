from dataclasses import dataclass
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
    "mekanik":      "user",
    "mechanic":     "user",
    "teknisi":      "user",
    "gl":           "group_leader",
    "group leader": "group_leader",
}


@dataclass
class Principal:
    """Unified auth principal — wraps both User and Employee."""
    id: str
    name: str
    role: str
    site: str
    principal_type: str  # "user" | "employee"
    email: Optional[str] = None
    nrp: Optional[str] = None
    password: Optional[str] = None  # only set for User, used by change-password


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
    """Returns User ORM object. Only valid for user-based tokens (admin/GL/supplier)."""
    from app.models.user import User

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: Optional[str] = payload.get("sub")
        principal_type: str = payload.get("principal_type", "user")
        if user_id is None or principal_type != "user":
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
    """Returns unified Principal. Accepts both user and employee tokens."""
    from app.models.user import User
    from app.models.employee import Employee

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        subject_id: Optional[str] = payload.get("sub")
        principal_type: str = payload.get("principal_type", "user")
        if subject_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    if principal_type == "employee":
        result = await db.execute(
            select(Employee).where(Employee.id == subject_id, Employee.is_active == True)
        )
        emp = result.scalar_one_or_none()
        if emp is None:
            raise credentials_exception
        return Principal(
            id=emp.id,
            name=emp.name,
            role=_ROLE_NORM.get((emp.role or "").lower(), emp.role or "user"),
            site=emp.site,
            principal_type="employee",
            nrp=emp.nrp,
        )
    else:
        result = await db.execute(
            select(User).where(User.id == subject_id, User.is_active == True)
        )
        user = result.scalar_one_or_none()
        if user is None:
            raise credentials_exception
        return Principal(
            id=user.id,
            name=user.name,
            role=user.role,
            site=user.site,
            principal_type="user",
            email=user.email,
            password=user.password,
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


def require_user_role(*roles: str):
    """Like require_role but also enforces principal_type == 'user' (for admin endpoints)."""
    async def role_checker(principal: Principal = Depends(get_current_principal)):
        if principal.principal_type != "user":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This endpoint requires a user account login",
            )
        if principal.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {', '.join(roles)}",
            )
        return principal

    return role_checker
