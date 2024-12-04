from datetime import datetime
from enum import Enum
from sqlalchemy import Enum as SQLAlchemyEnum
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import Text, DateTime


class Base(DeclarativeBase):
    pass


class EventType(str, Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class EventLog(Base):
    __tablename__ = "eventLogs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    type: Mapped[EventType] = mapped_column(
        SQLAlchemyEnum(EventType, name="eventtype", create_constraint=False),
        nullable=False,
    )
    message: Mapped[str] = mapped_column(Text, nullable=False)
    date_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=datetime.utcnow
    )

