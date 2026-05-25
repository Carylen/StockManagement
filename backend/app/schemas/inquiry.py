from datetime import datetime, date
from typing import Optional, List, Literal
from pydantic import BaseModel, field_validator


class InquiryCreate(BaseModel):
    part_name: str
    part_number: Optional[str] = None
    qty_needed: int
    unit_asset: Optional[str] = None
    date_needed: Optional[date] = None
    notes: Optional[str] = None

    @field_validator("part_name")
    @classmethod
    def part_name_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("part_name cannot be blank")
        return v.strip()

    @field_validator("qty_needed")
    @classmethod
    def qty_positive(cls, v: int) -> int:
        if v < 1:
            raise ValueError("qty_needed must be at least 1")
        return v


class InquiryRespond(BaseModel):
    """v2.0: only valid | invalid. replacement_pn required when invalid."""
    result: Literal["valid", "invalid"]
    ut_site_code: Optional[str] = None         # warehouse code, e.g. RTT / SMR / BTL
    replacement_pn: Optional[str] = None       # required when result == "invalid"
    note: Optional[str] = None

    @field_validator("ut_site_code")
    @classmethod
    def _ut_site_upper(cls, v: Optional[str]) -> Optional[str]:
        return v.strip().upper() if v else v

    @field_validator("replacement_pn")
    @classmethod
    def _replacement_pn_upper(cls, v: Optional[str]) -> Optional[str]:
        return v.strip().upper() if v else v


class InquiryResponse(BaseModel):
    id: str
    submitted_by: Optional[str]
    submitted_by_employee_id: Optional[str]
    site: str
    kelas: str
    part_name: str
    part_number: Optional[str]
    qty_needed: int
    unit_asset: Optional[str]
    date_needed: Optional[date]
    notes: Optional[str]
    status: str
    ut_site_code: Optional[str] = None
    replacement_pn: Optional[str] = None
    respond_notes: Optional[str]
    responded_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    submitter_name: Optional[str] = None

    model_config = {"from_attributes": True}


class PaginatedInquiries(BaseModel):
    items: List[InquiryResponse]
    total: int
    page: int
    limit: int
    pages: int
