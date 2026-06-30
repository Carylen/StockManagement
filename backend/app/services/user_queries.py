from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.user import User


async def get_password_user_by_email(db: AsyncSession, email: str) -> Optional[User]:
    """Fetch a password-auth user by email. Returns None if not found."""
    result = await db.execute(
        select(User).where(User.email == email, User.auth_method == "password")
    )
    return result.scalar_one_or_none()
