from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from datetime import datetime
import uuid

class SyncItemIn(BaseModel):
    outbox_id: int
    entity_type: str
    entity_id: str
    operation: str
    data: Dict[str, Any]

class SyncPushRequest(BaseModel):
    items: List[SyncItemIn]

class SyncBatchResult(BaseModel):
    processed_ids: List[int]
    failed_ids: List[int]

class SyncPullResponse(BaseModel):
    server_time: datetime
    changes: Dict[str, List[Dict[str, Any]]]
