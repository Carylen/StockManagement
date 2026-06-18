from pydantic import BaseModel, EmailStr
from typing import Optional


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class NRPLoginRequest(BaseModel):
    nrp: str


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str


class UserInfo(BaseModel):
    id: str
    name: str
    email: str
    role: str
    site: str
    permissions: list[str] = []

    model_config = {"from_attributes": True}


class EmployeeInfo(BaseModel):
    id: str
    name: str
    nrp: str
    role: str
    site: str
    permissions: list[str] = []

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Optional[UserInfo] = None
    employee: Optional[EmployeeInfo] = None
