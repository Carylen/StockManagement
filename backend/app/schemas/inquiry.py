from datetime import datetime
from typing import Optional, List, Literal
from pydantic import BaseModel, field_validator, model_validator


class InquiryItemCreate(BaseModel):
    part_number: str
    qty: int

    @field_validator("part_number")
    @classmethod
    def _pn_strip(cls, v: str) -> str:
        v = v.strip().upper()
        if not v:
            raise ValueError("part_number cannot be blank")
        return v

    @field_validator("qty")
    @classmethod
    def _qty_positive(cls, v: int) -> int:
        if v < 1:
            raise ValueError("qty must be at least 1")
        return v


class InquiryCreate(BaseModel):
    parts: List[InquiryItemCreate]

    @field_validator("parts")
    @classmethod
    def _parts_not_empty(cls, v: list) -> list:
        if not v:
            raise ValueError("parts cannot be empty — provide at least one part")
        return v


# ── Item-level respond ────────────────────────────────────────────────────────

class InquiryItemRespondInput(BaseModel):
    item_id: str
    status: Literal["valid", "invalid"]
    replacement_pn: Optional[str] = None
    ut_site_code: Optional[str] = None
    ut_note: Optional[str] = None

    @field_validator("replacement_pn")
    @classmethod
    def _rp_upper(cls, v: Optional[str]) -> Optional[str]:
        return v.strip().upper() if v and v.strip() else None

    @field_validator("ut_site_code")
    @classmethod
    def _code_upper(cls, v: Optional[str]) -> Optional[str]:
        return v.strip().upper() if v and v.strip() else None

    @model_validator(mode="after")
    def _invalid_needs_replacement(self) -> "InquiryItemRespondInput":
        if self.status == "invalid" and not self.replacement_pn:
            raise ValueError("replacement_pn is required when status is 'invalid'")
        return self


class InquiryRespond(BaseModel):
    responses: List[InquiryItemRespondInput]

    @field_validator("responses")
    @classmethod
    def _not_empty(cls, v: list) -> list:
        if not v:
            raise ValueError("responses cannot be empty")
        return v


# ── Response schemas ──────────────────────────────────────────────────────────

class InquiryItemResponse(BaseModel):
    id: str
    part_number: str
    part_name: Optional[str]
    qty: int
    status: str
    replacement_pn: Optional[str]
    ut_site_code: Optional[str]
    ut_note: Optional[str]
    responded_at: Optional[datetime]
    responded_by: Optional[str]

    model_config = {"from_attributes": True}


class InquiryListItem(BaseModel):
    id: str
    site: str
    submitted_by_nrp: Optional[str]
    submitted_by_name: Optional[str]
    # computed from items
    status: str
    total_unique_parts: int
    total_qty: int
    total_pending_items: int
    total_valid_items: int
    total_invalid_items: int
    created_at: datetime
    responded_at: Optional[datetime] = None   # latest item.responded_at

    model_config = {"from_attributes": True}


class InquiryDetail(BaseModel):
    id: str
    site: str
    submitted_by_nrp: Optional[str]
    submitted_by_name: Optional[str]
    status: str   # computed from items
    created_at: datetime
    updated_at: datetime
    items: List[InquiryItemResponse]

    model_config = {"from_attributes": True}


class PaginatedInquiries(BaseModel):
    items: List[InquiryListItem]
    total: int
    page: int
    limit: int
    pages: int
