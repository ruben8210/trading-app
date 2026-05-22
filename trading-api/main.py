import os
from dotenv import load_dotenv
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

load_dotenv()

from trading_api.database import get_db, Base, engine
from trading_api.models import User
from trading_api.schemas import LoginRequest, TokenResponse, UserMe
from trading_api.auth import verify_password, create_access_token, get_current_user
from trading_api.routes import users, preferences, stocks, orders

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Trading API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://trading.rbonilla.com","http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router, prefix="/api/v1")
app.include_router(preferences.router, prefix="/api/v1")
app.include_router(stocks.router, prefix="/api/v1")
app.include_router(orders.router)

@app.get("/")
def root():
    return {"message": "Trading API funcionando"}

@app.post("/auth/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == payload.username).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(401, "Credenciales inválidas")
    token = create_access_token({"sub": user.id})
    return TokenResponse(access_token=token)

@app.post("/auth/logout")
def logout():
    return {"message": "Sesión cerrada"}

@app.get("/auth/me", response_model=UserMe)
def me(current_user: User = Depends(get_current_user)):
    return current_user
