from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel


class StockLevelResponse(BaseModel):
    id: str
    part_id: str
    site: str
    min_qty: float
    max_qty: float
    rtt_qty: int
    tbd_qty: int
    total_qty: int
    status: Optional[str]
    readyness_oh: bool
    readyness_min: bool
    readyness_fb: bool
    snapshot_date: date
    updated_at: datetime

    model_config = {"from_attributes": True}
