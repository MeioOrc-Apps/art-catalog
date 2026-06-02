"""add rotation to collection_items

Revision ID: dbd8259be32e
Revises: b2a87db06dfd
Create Date: 2026-06-02 20:00:48.749495

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'dbd8259be32e'
down_revision: str | Sequence[str] | None = 'b2a87db06dfd'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column('collection_items', sa.Column('rotation', sa.Float(), server_default='0.0', nullable=False))


def downgrade() -> None:
    op.drop_column('collection_items', 'rotation')
