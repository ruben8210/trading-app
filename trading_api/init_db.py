from trading_api.database import SessionLocal, Base, engine
from trading_api.models import User
from trading_api.auth import hash_password

Base.metadata.create_all(bind=engine)

db = SessionLocal()

existing_user = db.query(User).filter(User.username == "Ruben").first()
if not existing_user:
    user = User(
        username="Ruben",
        hashed_password=hash_password("ruben1643"),
        role="admin"
    )
    db.add(user)
    db.commit()
    print("✅ Usuario Ruben creado")
else:
    print("✅ Usuario Ruben ya existe")

db.close()
