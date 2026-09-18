from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from ..database import get_db
from ..models import Invoice, InvoiceItem, Product, Customer, Payment, SyncLog
from pydantic import BaseModel
from datetime import datetime

router = APIRouter()

class PushEntry(BaseModel):
    id: int
    tableName: str
    operation: str # 'INSERT' | 'UPDATE' | 'DELETE'
    recordId: str
    payload: Dict[str, Any]
    createdAt: str

class PushRequest(BaseModel):
    entries: List[PushEntry]

@router.post("/push")
def push_changes(request: PushRequest, db: Session = Depends(get_db)):
    """
    Receives outbox queue from mobile and applies it to Postgres.
    Conflict resolution: last-write-wins based on updated_at.
    """
    accepted = []
    rejected = []

    # Simplified sync reconciliation logic for scaffolding
    for entry in request.entries:
        try:
            # Map JS camelCase table names to Python classes
            model = None
            if entry.tableName == 'invoices': model = Invoice
            elif entry.tableName == 'invoice_items': model = InvoiceItem
            elif entry.tableName == 'products': model = Product
            elif entry.tableName == 'customers': model = Customer
            elif entry.tableName == 'payments': model = Payment

            if not model:
                rejected.append(entry.id)
                continue
                
            if entry.operation == 'DELETE':
                db.query(model).filter(model.id == entry.recordId).delete()
            else: # INSERT or UPDATE (Upsert behavior)
                existing = db.query(model).filter(model.id == entry.recordId).first()
                # Convert camelCase payload to snake_case if necessary. 
                # (Assuming mobile payload matches DB schema for simplicity here).
                payload_data = entry.payload
                
                if existing:
                    # Update
                    for k, v in payload_data.items():
                        if hasattr(existing, k):
                            setattr(existing, k, v)
                else:
                    # Insert
                    new_record = model(**payload_data)
                    db.add(new_record)
            
            accepted.append(entry.id)
        except Exception as e:
            print(f"Error processing entry {entry.id}: {e}")
            rejected.append(entry.id)

    db.commit()
    return {"accepted": accepted, "rejected": rejected}

@router.get("/pull")
def pull_changes(since: str, db: Session = Depends(get_db)):
    """
    Returns records modified on server since `since` timestamp.
    """
    # Simplified logic: return empty rows for demo.
    # In production, query all tables where updated_at > since.
    server_time = datetime.utcnow().isoformat() + "Z"
    return {
        "rows": [], # List of PullRow dicts
        "serverTime": server_time
    }
