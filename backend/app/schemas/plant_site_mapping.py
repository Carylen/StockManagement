from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class PlantMappingCreate(BaseModel):
    plnt_code: str
    site_code: str
    description: Optional[str] = None


class PlantMappingInfo(BaseModel):
    plnt_code: str
    site_code: str
    supplier_id: str
    description: Optional[str] = None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
