from datetime import date, timedelta
from typing import Any, List, Dict
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.api import deps
from app.models.animal import Animal, AnimalStatus, AnimalGender
from app.models.event import Event, EventType
from app.models.user import User

router = APIRouter()

@router.get("/", response_model=List[Dict[str, Any]])
def get_notifications(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Get active notifications dynamically calculated for the farm's animals."""
    if not current_user.farm_id:
        raise HTTPException(status_code=400, detail="Not assigned to a farm")

    notifications = []
    today = date.today()

    active_females = db.query(Animal).filter(
        Animal.farm_id == current_user.farm_id,
        Animal.status == AnimalStatus.ACTIVE,
        Animal.gender == AnimalGender.FEMALE
    ).all()

    for animal in active_females:
        events = db.query(Event).filter(
            Event.animal_id == animal.id,
            Event.event_type.in_([EventType.PREGNANCY, EventType.BIRTH, EventType.HEAT])
        ).order_by(desc(Event.event_date)).all()
        
        if not events: continue

        latest_event = events[0]
        
        # Checking for Births
        if latest_event.event_type == EventType.PREGNANCY:
            expected_date = latest_event.event_date + timedelta(days=283)
            days_until = (expected_date - today).days
            
            if -60 <= days_until <= 14:
                title = "Parto esperado" if days_until >= 0 else "Parto atrasado"
                desc_str = f"Previsto para {expected_date.strftime('%d/%m/%Y')} ({abs(days_until)} dias {'restantes' if days_until >= 0 else 'em atraso'})."
                if days_until == 0:
                    desc_str = "Previsto para hoje!"
                    
                notifications.append({
                    "id": f"birth_{animal.id}",
                    "type": "Birth",
                    "title": title,
                    "animal_id": animal.id,
                    "animal_name": animal.name or f"#{animal.registration_id}",
                    "expected_date": expected_date.isoformat(),
                    "days_until": days_until,
                    "description": desc_str
                })
        
        # Checking for Heat return (Cio)
        elif latest_event.event_type == EventType.HEAT:
            expected_date = latest_event.event_date + timedelta(days=21)
            days_until = (expected_date - today).days
            
            if -7 <= days_until <= 3:
                title = "Retorno ao cio"
                desc_str = f"Previsto para {expected_date.strftime('%d/%m/%Y')} ({abs(days_until)} dias {'restantes' if days_until >= 0 else 'em atraso'})."
                if days_until == 0:
                    desc_str = "Previsto para hoje!"
                    
                notifications.append({
                    "id": f"heat_{animal.id}",
                    "type": "Heat",
                    "title": title,
                    "animal_id": animal.id,
                    "animal_name": animal.name or f"#{animal.registration_id}",
                    "expected_date": expected_date.isoformat(),
                    "days_until": days_until,
                    "description": desc_str
                })

    # Future scheduled events
    upcoming_events = db.query(Event).join(Animal).filter(
        Animal.farm_id == current_user.farm_id,
        Event.event_date >= today
    ).order_by(Event.event_date).all()

    for ev in upcoming_events:
        days_until = (ev.event_date - today).days
        if days_until <= 14:
            animal = ev.animal
            notifications.append({
                "id": f"event_{ev.id}",
                "type": "Event",
                "title": f"Evento: {ev.event_type.value}",
                "animal_id": animal.id,
                "animal_name": animal.name or f"#{animal.registration_id}",
                "expected_date": ev.event_date.isoformat(),
                "days_until": days_until,
                "description": f"Marcado para {ev.event_date.strftime('%d/%m/%Y')}." + (f" Nota: {ev.description}" if ev.description else "")
            })

    # Sort notifications by expected date ascending
    notifications.sort(key=lambda x: x["expected_date"])

    return notifications
