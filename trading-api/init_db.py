"""Inicializa la base de datos y crea el usuario admin por defecto.

Uso:
    python init_db.py
"""

from database import Base, engine, SessionLocal
from models import User
from auth import hash_password


def init():
    Base.metadata.create_all(bind=engine)
    print("✅ Tablas creadas")

    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.username == "admin").first()
        if existing:
            print("ℹ️  El usuario admin ya existe")
            return

        admin = User(
            username="admin",
            email="admin@tradingapp.com",
            hashed_password=hash_password("admin123"),
            role="admin",
        )
        db.add(admin)
        db.commit()
        print("✅ Usuario admin creado: admin / admin123")
    finally:
        db.close()


if __name__ == "__main__":
    init()
