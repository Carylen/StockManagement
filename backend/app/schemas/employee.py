from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, field_validator

_ROLE_NORMALIZE = {
    "mekanik":      "user",
    "mechanic":     "user",
    "teknisi":      "user",
    "gl":           "user",
    "group leader": "user",
    "group_leader": "user",
    "kepala group": "user",
    "user":         "user",
}

_POSITION_NORMALIZE = {
    "mekanik":      "mechanic",
    "mechanic":     "mechanic",
    "teknisi":      "mechanic",
    "gl":           "group_leader",
    "group leader": "group_leader",
    "group_leader": "group_leader",
    "kepala group": "group_leader",
    "dept head":    "dept_head",
    "dept_head":    "dept_head",
}


def _normalize_role(v: str) -> str:
    normalized = _ROLE_NORMALIZE.get(v.strip().lower())
    if normalized is None:
        raise ValueError("Role harus 'user' (Mekanik / GL)")
    return normalized


def _normalize_position(v: str) -> str:
    normalized = _POSITION_NORMALIZE.get(v.strip().lower())
    if normalized is None:
        raise ValueError("Position harus mechanic, group_leader, atau dept_head")
    return normalized


class EmployeeCreate(BaseModel):
    nrp: str
    name: str
    role: str = "user"
    position: Optional[str] = None
    # site is injected from JWT, not accepted from body

    @field_validator("role", mode="before")
    @classmethod
    def validate_role(cls, v: str) -> str:
        return _normalize_role(v)

    @field_validator("position", mode="before")
    @classmethod
    def validate_position(cls, v: Optional[str]) -> Optional[str]:
        if v is None or str(v).strip() == "":
            return None
        return _normalize_position(str(v))


class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    position: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator("role", mode="before")
    @classmethod
    def validate_role(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        return _normalize_role(v)

    @field_validator("position", mode="before")
    @classmethod
    def validate_position(cls, v: Optional[str]) -> Optional[str]:
        if v is None or str(v).strip() == "":
            return None
        return _normalize_position(str(v))


class EmployeeResponse(BaseModel):
    id: str
    nrp: str
    name: str
    site: str
    role: str
    position: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class EmployeeSummary(BaseModel):
    total: int
    active: int
    inactive: int
    dept_head_count: int


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
