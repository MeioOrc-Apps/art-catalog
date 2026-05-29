from fastapi import Depends, HTTPException

from src.auth.manager import current_active_user
from src.auth.models import User


async def require_admin(user: User = Depends(current_active_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="ADMIN_ONLY")
    return user
