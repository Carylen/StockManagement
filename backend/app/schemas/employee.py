from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, field_validator

_ROLE_NORMALIZE = {
    "mekanik": "mechanic",
    "mechanic": "mechanic",
    "teknisi": "mechanic",
    "gl": "group_leader",
    "group leader": "group_leader",
    "group_leader": "group_leader",
    "kepala group": "group_leader",
}


def _normalize_role(v: str) -> str:
    normalized = _ROLE_NORMALIZE.get(v.strip().lower())
    if normalized is None:
        raise ValueError("Role harus salah satu dari: mechanic (Mekanik) atau group_leader (GL)")
    return normalized


class EmployeeCreate(BaseModel):
    nrp: str
    name: str
    role: str = "mechanic"
    # site is injected from JWT, not accepted from body

    @field_validator("role", mode="before")
    @classmethod
    def validate_role(cls, v: str) -> str:
        return _normalize_role(v)


class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator("role", mode="before")
    @classmethod
    def validate_role(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        return _normalize_role(v)


class EmployeeResponse(BaseModel):
    id: str
    nrp: str
    name: str
    site: str
    role: str
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
