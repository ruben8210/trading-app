from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from trading_api.database import get_db
from trading_api.models import Order, Alert, User
from trading_api.auth import get_current_user

router = APIRouter(prefix="/api/v1", tags=["orders"])

@router.post("/orders")
def create_order(data: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        market_type = (data.get('market_type') or 'spot').lower()
        leverage = float(data.get('leverage') or 1)
        if market_type == 'spot':
            leverage = 1.0
        order = Order(
            user_id=current_user.id,
            symbol=data.get('symbol').upper(),
            side=data.get('side').lower(),
            quantity=data.get('quantity'),
            entry_price=data.get('entry_price'),
            market_type=market_type,
            leverage=leverage,
            stop_loss=data.get('stop_loss'),
            take_profit=data.get('take_profit'),
            notes=data.get('notes'),
            status="filled"
        )
        db.add(order)
        db.commit()
        db.refresh(order)
        return order
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/orders")
def get_orders(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Order).filter(Order.user_id == current_user.id).all()

@router.patch("/orders/{order_id}")
def close_order(order_id: int, data: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id, Order.user_id == current_user.id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    order.exit_price = data.get('exit_price')
    order.status = "closed"
    order.closed_at = datetime.utcnow()

    leverage = float(order.leverage or 1)

    if order.side == "buy":
        pnl = (order.exit_price - order.entry_price) * order.quantity
        raw_pct = ((order.exit_price - order.entry_price) / order.entry_price) * 100
    else:
        pnl = (order.entry_price - order.exit_price) * order.quantity
        raw_pct = ((order.entry_price - order.exit_price) / order.entry_price) * 100

    order.pnl = pnl
    order.pnl_percent = raw_pct * leverage

    db.commit()
    db.refresh(order)
    return order

@router.delete("/orders/{order_id}")
def cancel_order(order_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id, Order.user_id == current_user.id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    order.status = "cancelled"
    db.commit()
    return {"message": "Order cancelled"}

@router.post("/alerts")
def create_alert(data: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    alert = Alert(
        user_id=current_user.id,
        symbol=data.get('symbol').upper(),
        alert_type=data.get('alert_type'),
        price=data.get('price')
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert

@router.get("/alerts")
def get_alerts(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Alert).filter(Alert.user_id == current_user.id).all()

@router.delete("/alerts/{alert_id}")
def delete_alert(alert_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    alert = db.query(Alert).filter(Alert.id == alert_id, Alert.user_id == current_user.id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    db.delete(alert)
    db.commit()
    return {"message": "Alert deleted"}
