import uuid
from datetime import datetime

from fastapi_users import schemas
from pydantic import BaseModel, EmailStr, Field, field_validator


class UserRead(schemas.BaseUser[uuid.UUID]):
    username: str
    display_name: str | None
    role: str
    locale: str
    created_at: datetime
    last_login_at: datetime | None


class UserCreate(schemas.BaseUserCreate):
    username: str
    display_name: str | None = None
    locale: str = "pt-BR"

    @field_validator("username")
    @classmethod
    def username_valid(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3 or len(v) > 64:
            raise ValueError("Username must be 3-64 characters")
        if not v.replace("_", "").replace("-", "").replace(".", "").isalnum():
            raise ValueError("Username may only contain letters, digits, _ - .")
        return v.lower()


class UserUpdate(schemas.BaseUserUpdate):
    display_name: str | None = None
    locale: str | None = None


class MeUpdate(BaseModel):
    """Self-service profile patch. Limits what the logged-in user can
    edit on their own row to non-sensitive fields — no email, role,
    password, or active flags. Those go through dedicated flows
    (password reset, admin demote/promote) so we never accidentally
    let a regular member elevate themselves via PATCH /me."""

    display_name: str | None = None
    locale: str | None = Field(None, pattern=r"^[a-z]{2}-[A-Z]{2}$")


class RegisterWithInviteRequest(BaseModel):
    code: str
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    username: str
    display_name: str | None = None
    locale: str = "pt-BR"


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=1, max_length=4096)
    password: str = Field(min_length=8, max_length=128)


class InviteCreate(BaseModel):
    email_hint: str | None = None
    expires_in_days: int = 7


class InviteRead(BaseModel):
    id: uuid.UUID
    code: str
    email_hint: str | None
    expires_at: datetime
    used_at: datetime | None
    used_by: uuid.UUID | None
    created_at: datetime

    model_config = {"from_attributes": True}
