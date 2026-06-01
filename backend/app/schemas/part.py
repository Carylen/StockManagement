from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel


class StockInfo(BaseModel):
    rtt_qty: int
    tbd_qty: int
    total_qty: int
    min_qty: float
    max_qty: float
    status: Optional[str]
    estimated_date: Optional[date] = None

    model_config = {"from_attributes": True}


class PartResponse(BaseModel):
    """Detail view — joins tb_t_stock_levels + tb_m_parts for master metadata."""
    id: str
    part_number: str
    description: Optional[str]
    producer: Optional[str]
    commodity: Optional[str]
    kelas: str
    is_active: bool
    current_stock: Optional[StockInfo] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PartListResponse(BaseModel):
    """Catalog list — data purely from tb_t_stock_levels (daily upload)."""
    id: str
    part_number: str
    description: Optional[str]
    commodity: Optional[str]
    rtt_qty: Optional[int] = None
    tbd_qty: Optional[int] = None
    total_qty: Optional[int] = None
    min_qty: Optional[float] = None
    max_qty: Optional[float] = None
    status: Optional[str] = None
    estimated_date: Optional[date] = None

    model_config = {"from_attributes": True}


class PaginatedParts(BaseModel):
    items: List[PartListResponse]
    total: int
    page: int
    limit: int
    pages: int


class StockHistoryItem(BaseModel):
    id: str
    warehouse: str
    old_qty: Optional[int]
    new_qty: int
    delta: int
    source_file: Optional[str]
    synced_at: datetime

    model_config = {"from_attributes": True}
