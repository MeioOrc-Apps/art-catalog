import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

DEFAULT_QUOTAS: dict[str, int] = {
    "enrichment_per_month": 50,
    "summaries_per_month": 10,
    "stt_minutes_per_month": 60,
}

_OPERATION_TO_QUOTA: dict[str, str] = {
    "enrich_session": "enrichment_per_month",
    "media_summary": "summaries_per_month",
    "transcribe_audio": "stt_minutes_per_month",
}

# Single source of truth for the STT operation name (must match what
# `record_llm_usage` writes — see sessions/service.py and routes.py).
STT_OPERATION = "transcribe_audio"


async def check_count_quota(
    db: AsyncSession,
    user_id: uuid.UUID,
    operation: str,
    quota_key: str,
) -> None:
    """Raise ValueError if user has exceeded monthly operation count."""
    from src.enrichment.models import LLMUsage

    month_start = datetime.now(UTC).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    limit = DEFAULT_QUOTAS[quota_key]

    result = await db.execute(
        select(func.count(LLMUsage.id)).where(
            LLMUsage.user_id == user_id,
            LLMUsage.operation == operation,
            LLMUsage.created_at >= month_start,
        )
    )
    count = result.scalar_one()
    if count >= limit:
        raise ValueError(f"Monthly quota exceeded: {quota_key} ({count}/{limit})")


async def check_stt_quota(db: AsyncSession, user_id: uuid.UUID) -> None:
    """Raise ValueError if user has exceeded monthly STT minutes."""
    from src.enrichment.models import LLMUsage

    month_start = datetime.now(UTC).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    limit = DEFAULT_QUOTAS["stt_minutes_per_month"]

    result = await db.execute(
        select(func.coalesce(func.sum(LLMUsage.audio_seconds), 0)).where(
            LLMUsage.user_id == user_id,
            LLMUsage.operation == STT_OPERATION,
            LLMUsage.created_at >= month_start,
        )
    )
    total_seconds = result.scalar_one() or 0
    used_minutes = total_seconds // 60
    if used_minutes >= limit:
        raise ValueError(
            f"Monthly quota exceeded: stt_minutes_per_month ({used_minutes}/{limit})"
        )


async def get_user_quota_status(db: AsyncSession, user_id: uuid.UUID) -> dict:
    """Return current quota usage for a user."""
    from src.enrichment.models import LLMUsage

    month_start = datetime.now(UTC).replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    enrichments = (
        await db.execute(
            select(func.count(LLMUsage.id)).where(
                LLMUsage.user_id == user_id,
                LLMUsage.operation == "enrich_session",
                LLMUsage.created_at >= month_start,
            )
        )
    ).scalar_one()

    summaries = (
        await db.execute(
            select(func.count(LLMUsage.id)).where(
                LLMUsage.user_id == user_id,
                LLMUsage.operation == "media_summary",
                LLMUsage.created_at >= month_start,
            )
        )
    ).scalar_one()

    stt_seconds = (
        await db.execute(
            select(func.coalesce(func.sum(LLMUsage.audio_seconds), 0)).where(
                LLMUsage.user_id == user_id,
                LLMUsage.operation == STT_OPERATION,
                LLMUsage.created_at >= month_start,
            )
        )
    ).scalar_one() or 0

    return {
        "enrichment": {
            "used": enrichments,
            "limit": DEFAULT_QUOTAS["enrichment_per_month"],
        },
        "summaries": {
            "used": summaries,
            "limit": DEFAULT_QUOTAS["summaries_per_month"],
        },
        "stt_minutes": {
            "used": stt_seconds // 60,
            "limit": DEFAULT_QUOTAS["stt_minutes_per_month"],
        },
    }
