from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import bcrypt
from app.core.database import get_db
from app.core.auth import create_access_token, get_current_user, get_current_principal, Principal
from app.core.config import settings
from app.models.user import User
from app.models.employee import Employee
from app.schemas.auth import (
    LoginRequest, NRPLoginRequest, ChangePasswordRequest,
    TokenResponse, UserInfo, EmployeeInfo,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Email + password login for admin / group_leader / supplier."""
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(data.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive. Contact your site admin.",
        )
    token = create_access_token(
        {"sub": user.id, "role": user.role, "site": user.site, "principal_type": "user"},
        expires_delta=timedelta(hours=settings.ACCESS_TOKEN_EXPIRE_HOURS),
    )
    return TokenResponse(
        access_token=token,
        user=UserInfo(
            id=user.id,
            name=user.name,
            email=user.email,
            role=user.role,
            site=user.site,
        ),
    )


@router.post("/login-nrp", response_model=TokenResponse)
async def login_nrp(data: NRPLoginRequest, db: AsyncSession = Depends(get_db)):
    """NRP-based login for mechanic employees (no password required)."""
    result = await db.execute(
        select(Employee).where(
            Employee.nrp == data.nrp,
            Employee.site == data.site,
            Employee.is_active == True,
        )
    )
    employee = result.scalar_one_or_none()
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="NRP not found or not active at this site",
        )
    token = create_access_token(
        {"sub": employee.id, "role": employee.role, "site": employee.site, "principal_type": "employee"},
        expires_delta=timedelta(hours=settings.ACCESS_TOKEN_EXPIRE_HOURS),
    )
    return TokenResponse(
        access_token=token,
        employee=EmployeeInfo(
            id=employee.id,
            name=employee.name,
            nrp=employee.nrp,
            role=employee.role,
            site=employee.site,
        ),
    )


@router.post("/change-password", status_code=204)
async def change_password(
    data: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(get_current_principal),
):
    """Change password for user-account holders (admin / GL / supplier)."""
    if principal.principal_type != "user":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Password change is only available for user accounts",
        )
    result = await db.execute(select(User).where(User.id == principal.id))
    user = result.scalar_one_or_none()
    if not user or not verify_password(data.old_password, user.password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )
    if len(data.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="New password must be at least 8 characters",
        )
    from datetime import datetime, timezone
    user.password = hash_password(data.new_password)
    user.password_changed_at = datetime.now(timezone.utc)
    await db.flush()


@router.get("/me")
async def me(principal: Principal = Depends(get_current_principal)):
    if principal.principal_type == "employee":
        return EmployeeInfo(
            id=principal.id,
            name=principal.name,
            nrp=principal.nrp or "",
            role=principal.role,
            site=principal.site,
        )
    return UserInfo(
        id=principal.id,
        name=principal.name,
        email=principal.email or "",
        role=principal.role,
        site=principal.site,
    )
