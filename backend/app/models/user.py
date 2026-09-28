"""
User model.

Represents any authenticated actor in the system.
Actual password hashing (bcrypt) is implemented in Phase 3.
"""

import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, String, TypeDecorator, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class UserRole(str, enum.Enum):
    """Roles available in the system.

    ADMIN     — system administrator, full access
    DEVELOPER — assigned issue investigator, tester, and verifier
    USER      — issue reporter (public portal user)

    Note: The PostgreSQL 'userrole' enum also contains 'TESTER' for backward
    compatibility.  Existing TESTER rows are transparently read as DEVELOPER
    by SafeUserRoleType.  New rows are written as DEVELOPER.
    """
    ADMIN     = "ADMIN"
    DEVELOPER = "DEVELOPER"
    USER      = "USER"


class SafeUserRoleType(TypeDecorator):
    """SQLAlchemy type decorator that transparently upgrades legacy TESTER DB
    values to the canonical DEVELOPER role.

    The PostgreSQL 'userrole' enum contains both TESTER and DEVELOPER.
    All Python code uses DEVELOPER; the DB shim handles both directions.
    """

    impl = Enum("ADMIN", "TESTER", "USER", "DEVELOPER", name="userrole", create_type=True)
    cache_ok = True

    def process_result_value(self, value, dialect):
        """Map DB value → Python UserRole.  TESTER (legacy) → DEVELOPER."""
        if value is None:
            return None
        if value == "TESTER":
            return UserRole.DEVELOPER
        return UserRole(value)

    def process_bind_param(self, value, dialect):
        """Map Python UserRole → DB string.  DEVELOPER is stored as DEVELOPER."""
        if value is None:
            return None
        if isinstance(value, UserRole):
            return value.value
        return str(value)


class User(Base):
    """Registered user / team member."""

    __tablename__ = "users"

    # ------------------------------------------------------------------ #
    # Primary key                                                          #
    # ------------------------------------------------------------------ #
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # ------------------------------------------------------------------ #
    # Identity                                                             #
    # ------------------------------------------------------------------ #
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False
    )
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)

    # ------------------------------------------------------------------ #
    # Role & status                                                        #
    # ------------------------------------------------------------------ #
    role: Mapped[UserRole] = mapped_column(
        SafeUserRoleType,
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_email_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # ------------------------------------------------------------------ #
    # Timestamps                                                           #
    # ------------------------------------------------------------------ #
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # ------------------------------------------------------------------ #
    # Relationships                                                        #
    # ------------------------------------------------------------------ #
    reported_issues: Mapped[list["Issue"]] = relationship(
        "Issue",
        back_populates="reporter",
        foreign_keys="Issue.reporter_id",
    )
    assigned_issues: Mapped[list["Issue"]] = relationship(
        "Issue",
        back_populates="assignee",
        foreign_keys="Issue.assignee_id",
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email!r} role={self.role}>"
