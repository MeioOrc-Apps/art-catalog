from datetime import datetime
from typing import TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class CursorPage[T](BaseModel):
    items: list[T]
    next_cursor: str | None
    total: int | None = None


def encode_cursor(dt: datetime) -> str:
    return dt.isoformat()


def decode_cursor(cursor: str) -> datetime:
    return datetime.fromisoformat(cursor)
