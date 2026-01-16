import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, update
import sys
import os

# Add the project root to sys.path
sys.path.append('/home/zaibaki/github_projects/client-server/ResilientTask/api')

from models import User, Base

DATABASE_URL = "postgresql+asyncpg://postgres:postgres@localhost:5432/postgres"

async def promote_user(username):
    engine = create_async_engine(DATABASE_URL, echo=True)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        async with session.begin():
            result = await session.execute(select(User).where(User.username == username))
            user = result.scalar_one_or_none()
            if user:
                print(f"Promoting user {username} to admin...")
                user.is_admin = True
                await session.commit()
                print("Done.")
            else:
                print(f"User {username} not found.")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        asyncio.run(promote_user(sys.argv[1]))
    else:
        print("Please provide a username.")
