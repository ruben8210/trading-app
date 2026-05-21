import bcrypt
import sys
sys.path.insert(0, '/app')
from database import SessionLocal, Base, engine
from models import User

Base.metadata.create_all(bind=engine)

db = SessionLocal()

# Crear usuario Ruben si no existe
if not db.query(User).filter(User.username == 'Ruben').first():
    user = User(
        username='Ruben',
        hashed_password=bcrypt.hashpw('ruben1643'.encode(), bcrypt.gensalt()).decode(),
        role='admin'
    )
    db.add(user)
    db.commit()
    print("Usuario Ruben creado")
else:
    print("Usuario Ruben ya existe")

db.close()
