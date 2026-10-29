"""store amount as integer paise

Revision ID: d88a1b7651b9
Revises: 6e67c8e07b16
Create Date: 2026-10-28 05:38:51.438726

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'd88a1b7651b9'
down_revision: str | None = '6e67c8e07b16'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. add the new column as nullable so existing rows are allowed
    op.add_column("expenses", sa.Column("amount_paise", sa.BigInteger(), nullable=True))
    # 2. convert existing data
    op.execute("UPDATE expenses SET amount_paise = ROUND(amount * 100)::bigint")
    # 3. now every row has a value, so enforce it
    op.alter_column("expenses", "amount_paise", nullable=False)
    op.create_check_constraint("ck_expenses_amount_positive", "expenses", "amount_paise > 0")
    # 4. remove the old float column
    op.drop_column("expenses", "amount")


def downgrade() -> None:
    op.add_column("expenses", sa.Column("amount", sa.Float(), nullable=True))
    op.execute("UPDATE expenses SET amount = amount_paise / 100.0")
    op.alter_column("expenses", "amount", nullable=False)
    op.drop_constraint("ck_expenses_amount_positive", "expenses", type_="check")
    op.drop_column("expenses", "amount_paise")
