"""
Run once to seed the initial admin account:
  cd backend
  python scripts/seed_admin.py
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from passlib.context import CryptContext
from sqlalchemy import select
from app.core.database import AsyncSessionLocal, engine, Base
from app.models.user import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        existing = await db.execute(select(User).where(User.email == "admin@kpp.co.id"))
        if existing.scalar_one_or_none():
            print("Admin already exists.")
            return

        admin = User(
            name="Admin AGMR",
            email="admin@kpp.co.id",
            password=pwd_context.hash("admin123"),
            role="admin",
            site="AGMR",
        )
        db.add(admin)
        await db.commit()
        print("Admin created: admin@kpp.co.id / admin123")
        print("IMPORTANT: Change this password immediately in production!")


asyncio.run(seed())
