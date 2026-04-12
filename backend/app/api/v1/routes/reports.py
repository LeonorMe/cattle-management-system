import io
import csv
from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import openpyxl
from datetime import date

from app.api import deps
from app.models.animal import Animal
from app.models.event import Event
from app.models.user import User

router = APIRouter()

@router.get("/herd", status_code=200)
def export_herd(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    format: str = Query("xlsx", description="Format: xlsx or csv")
) -> StreamingResponse:
    """Export all animals in the farm."""
    if not current_user.farm_id:
        raise HTTPException(status_code=400, detail="Not assigned to a farm")

    animals = db.query(Animal).filter(Animal.farm_id == current_user.farm_id).all()
    
    headers = ["ID Registro", "Nome", "Raça", "Género", "Data Nasc.", "Estado", "Mãe", "Pai"]

    if format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(headers)
        for a in animals:
            writer.writerow([
                a.registration_id, a.name or "", a.breed or "", 
                a.gender.value, a.birth_date or "", a.status.value,
                a.mother_id or "", a.father_id or ""
            ])
        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=herd_report.csv"}
        )
    else:
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Herd"
        ws.append(headers)
        for a in animals:
            ws.append([
                a.registration_id, a.name or "", a.breed or "", 
                a.gender.value, str(a.birth_date) if a.birth_date else "", a.status.value,
                a.mother_id or "", a.father_id or ""
            ])
        
        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=herd_report.xlsx"}
        )

@router.get("/events", status_code=200)
def export_events(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    format: str = Query("xlsx")
) -> StreamingResponse:
    """Export events within a date range."""
    if not current_user.farm_id:
        raise HTTPException(status_code=400, detail="Not assigned to a farm")

    # Get animal IDs for this farm
    animal_ids = [a.id for a in db.query(Animal.id).filter(Animal.farm_id == current_user.farm_id).all()]
    
    query = db.query(Event).filter(Event.animal_id.in_(animal_ids))
    if start_date:
        query = query.filter(Event.event_date >= start_date)
    if end_date:
        query = query.filter(Event.event_date <= end_date)
        
    events = query.order_by(Event.event_date.desc()).all()
    
    headers = ["Data", "Animal (ID)", "Tipo de Evento", "Descrição"]

    if format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(headers)
        for e in events:
            # Need to get animal reg_id for the report to be useful
            animal = db.query(Animal).filter(Animal.id == e.animal_id).first()
            writer.writerow([
                e.event_date, animal.registration_id if animal else "N/A", 
                e.event_type.value, e.description or ""
            ])
        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=events_report.csv"}
        )
    else:
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Events"
        ws.append(headers)
        for e in events:
            animal = db.query(Animal).filter(Animal.id == e.animal_id).first()
            ws.append([
                str(e.event_date), animal.registration_id if animal else "N/A", 
                e.event_type.value, e.description or ""
            ])
        
        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=events_report.xlsx"}
        )
