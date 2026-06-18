from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel


class OverrideCreate(BaseModel):
    permission_code: str
    effect: Literal["ALLOW", "DENY"]
    reason: Optional[str] = None
    expires_at: Optional[datetime] = None


class OverrideInfo(BaseModel):
    id: str
    user_id: str
    permission_code: str
    effect: str
    reason: Optional[str] = None
    granted_by: Optional[str] = None
    expires_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}
