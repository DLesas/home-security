from datetime import datetime
from sqlalchemy import Enum as SQLAlchemyEnum
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import Text, DateTime, Float


class Base(DeclarativeBase):
    pass


class DetectionLogs(Base):
    __tablename__ = "detectionLogs"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    detectedClass: Mapped[str] = mapped_column(Text, nullable=False)
    model: Mapped[str] = mapped_column(Text, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    date_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=datetime.utcnow
    )
