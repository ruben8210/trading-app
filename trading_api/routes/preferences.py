import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from trading_api.database import get_db
from trading_api.models import User, UserPreference
from trading_api.schemas import PreferenceData, PreferenceOut
from trading_api.auth import get_current_user

router = APIRouter(prefix="/preferences", tags=["preferences"])


@router.get("", response_model=PreferenceOut)
def get_preferences(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    pref = db.query(UserPreference).filter(UserPreference.user_id == user.id).first()
    if not pref:
        return PreferenceOut(user_id=user.id, data=PreferenceData())
    return PreferenceOut(user_id=user.id, data=PreferenceData(**json.loads(pref.data)))


@router.put("", response_model=PreferenceOut)
def save_preferences(
    payload: PreferenceData,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    pref = db.query(UserPreference).filter(UserPreference.user_id == user.id).first()
    if not pref:
        pref = UserPreference(user_id=user.id, data="{}")
        db.add(pref)
    pref.data = payload.model_dump_json()
    db.commit()
    db.refresh(pref)
    return PreferenceOut(user_id=user.id, data=PreferenceData(**json.loads(pref.data)))
