from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import bcrypt
from app.core.database import get_db
from app.core.auth import create_access_token, get_current_user
from app.core.config import settings
from app.models.user import User
from app.schemas.auth import LoginRequest, TokenResponse, UserInfo

router = APIRouter(prefix="/auth", tags=["auth"])


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
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
        {"sub": user.id, "role": user.role, "site": user.site},
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


@router.get("/me", response_model=UserInfo)
async def me(current_user: User = Depends(get_current_user)):
    return UserInfo(
        id=current_user.id,
        name=current_user.name,
        email=current_user.email,
        role=current_user.role,
        site=current_user.site,
    )
