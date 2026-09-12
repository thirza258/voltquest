"""Declarative base shared by the persisted models."""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Declarative base for every VoltQuest model."""
