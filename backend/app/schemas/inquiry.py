from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel


class InquiryCreate(BaseModel):
    part_name: str
    part_number: Optional[str] = None
    qty_needed: int
    unit_asset: Optional[str] = None
    date_needed: Optional[date] = None
    notes: Optional[str] = None


class InquiryApprove(BaseModel):
    pass


class InquiryReject(BaseModel):
    rejection_reason: str


class InquiryRespond(BaseModel):
    status: str  # available, unavailable, partial
    supplier_notes: Optional[str] = None


class InquiryUserInfo(BaseModel):
    id: str
    name: str
    role: str

    model_config = {"from_attributes": True}


class InquiryResponse(BaseModel):
    id: str
    submitted_by: str
    reviewed_by: Optional[str]
    site: str
    part_name: str
    part_number: Optional[str]
    qty_needed: int
    unit_asset: Optional[str]
    date_needed: Optional[date]
    notes: Optional[str]
    status: str
    rejection_reason: Optional[str]
    supplier_notes: Optional[str]
    reviewed_at: Optional[datetime]
    responded_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    submitter_name: Optional[str] = None
    reviewer_name: Optional[str] = None

    model_config = {"from_attributes": True}


class PaginatedInquiries(BaseModel):
    items: List[InquiryResponse]
    total: int
    page: int
    limit: int
    pages: int
