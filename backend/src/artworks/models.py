import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.core.database import Base


class Artist(Base):
    __tablename__ = "artists"

    id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    slug: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    canonical_name: Mapped[str] = mapped_column(String(512), nullable=False)
    bio_short: Mapped[str | None] = mapped_column(Text, nullable=True)
    cover_artwork_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), nullable=True
    )
    last_searched_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    sync_status: Mapped[str] = mapped_column(String(50), default="ready", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    artworks: Mapped[list["Artwork"]] = relationship(
        back_populates="artist", cascade="all, delete-orphan"
    )


class Artwork(Base):
    __tablename__ = "artworks"

    id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    artist_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("artists.id", ondelete="CASCADE"),
        nullable=False,
    )
    title: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    source_page_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    source_image_url: Mapped[str] = mapped_column(String(2048), nullable=False)
    image_original: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    image_large: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    image_thumb: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    width: Mapped[int | None] = mapped_column(nullable=True)
    height: Mapped[int | None] = mapped_column(nullable=True)
    dominant_colors: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    phash: Mapped[str | None] = mapped_column(String(32), nullable=True)
    is_downloaded: Mapped[bool] = mapped_column(default=False, nullable=False)
    is_pinned: Mapped[bool] = mapped_column(default=False, server_default="false", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    artist: Mapped["Artist"] = relationship(back_populates="artworks")

    __table_args__ = (
        UniqueConstraint("artist_id", "phash", name="uq_artwork_artist_phash"),
    )


class Collection(Base):
    __tablename__ = "collections"

    id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(512), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    items: Mapped[list["CollectionItem"]] = relationship(
        back_populates="collection", cascade="all, delete-orphan"
    )


class CollectionItem(Base):
    __tablename__ = "collection_items"

    id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    collection_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("collections.id", ondelete="CASCADE"),
        nullable=False,
    )
    artwork_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("artworks.id", ondelete="CASCADE"),
        nullable=False,
    )
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # Moodboard spatial data
    x: Mapped[float] = mapped_column(Float, server_default="0.0", nullable=False)
    y: Mapped[float] = mapped_column(Float, server_default="0.0", nullable=False)
    width: Mapped[float | None] = mapped_column(Float, nullable=True)
    height: Mapped[float | None] = mapped_column(Float, nullable=True)
    z_index: Mapped[int] = mapped_column(Integer, server_default="1", nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    collection: Mapped["Collection"] = relationship(back_populates="items")
    artwork: Mapped["Artwork"] = relationship()

    __table_args__ = (
        UniqueConstraint("collection_id", "artwork_id", name="uq_collection_artwork"),
    )
