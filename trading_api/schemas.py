from pydantic import BaseModel
from typing import Optional
from datetime import datetime


# ─── Auth ───────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ─── User ───────────────────────────────────────────────────────

class UserCreate(BaseModel):
    username: str
    password: str
    role: str = "user"


class UserOut(BaseModel):
    id: int
    username: str
    role: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class UserMe(BaseModel):
    id: int
    username: str
    role: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ─── Preferences ────────────────────────────────────────────────

class PreferenceData(BaseModel):
    watchlist: list[str] = []
    activeIndicators: dict[str, bool] = {}
    selectedSymbol: str = ""
    timeframe: str = "1D"


class PreferenceOut(BaseModel):
    user_id: int
    data: PreferenceData
