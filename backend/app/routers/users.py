from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import bcrypt
from app.core.database import get_db
from app.core.auth import Principal
from app.utils.permissions import require_permission, require_any_permission
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate, UserResponse
from app.services.user_queries import get_password_user_by_email

router = APIRouter(prefix="/users", tags=["users"])


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


@router.post("", response_model=UserResponse, status_code=201)
async def create_user(
    data: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Principal = Depends(require_permission("can_manage_all_users")),
):
    if await get_password_user_by_email(db, data.email):
        raise HTTPException(status_code=409, detail="Email is already registered")

    valid_roles = {"user", "admin", "supplier"}
    if data.role not in valid_roles:
        raise HTTPException(status_code=400, detail=f"Invalid role. Valid options: {', '.join(valid_roles)}")

    user = User(
        name=data.name,
        email=data.email,
        password=hash_password(data.password),
        auth_method="password",
        role=data.role,
        site=data.site,
        created_by=current_user.id,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return UserResponse.model_validate(user)


@router.get("", response_model=list[UserResponse])
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: Principal = Depends(require_permission("can_manage_all_users")),
):
    result = await db.execute(
        select(User).where(User.auth_method == "password").order_by(User.role, User.name)
    )
    return [UserResponse.model_validate(u) for u in result.scalars().all()]


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Principal = Depends(require_any_permission("can_manage_site_users", "can_manage_all_users")),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if data.name is not None:
        user.name = data.name
    if data.role is not None:
        valid_roles = {"user", "admin", "supplier"}
        if data.role not in valid_roles:
            raise HTTPException(status_code=400, detail="Invalid role")
        user.role = data.role
    if data.is_active is not None:
        user.is_active = data.is_active

    await db.flush()
    await db.refresh(user)
    return UserResponse.model_validate(user)


@router.delete("/{user_id}", status_code=204)
async def deactivate_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Principal = Depends(require_permission("can_manage_all_users")),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate your own account")
    user.is_active = False
    await db.flush()
