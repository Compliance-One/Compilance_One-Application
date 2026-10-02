from enum import Enum
from typing import Any, Dict, List
from pydantic import BaseModel, Field

class SyncOperation(str, Enum):
    INSERT = "INSERT"
    UPDATE = "UPDATE"
    DELETE = "DELETE"

class SyncItemIn(BaseModel):
    outbox_id: int
    entity_type: str
    entity_id: str
    operation: SyncOperation
    data: Dict[str, Any]

class SyncBatchIn(BaseModel):
    items: List[SyncItemIn] = Field(default_factory=list)

class SyncPushResponse(BaseModel):
    processed_ids: List[int] = Field(default_factory=list)
    failed_ids: List[int] = Field(default_factory=list)