from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel


class EmployeeCreate(BaseModel):
    nrp: str
    name: str
    role: str = "mechanic"
    shift: Optional[str] = None
    # site is injected from JWT, not accepted from body


class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    shift: Optional[str] = None
    is_active: Optional[bool] = None


class EmployeeResponse(BaseModel):
    id: str
    nrp: str
    name: str
    site: str
    role: str
    shift: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PaginatedEmployees(BaseModel):
    items: List[EmployeeResponse]
    total: int
    page: int
    limit: int
    pages: int


class BulkUploadResult(BaseModel):
    inserted: int
    updated: int
    skipped: int
    errors: List[dict]
