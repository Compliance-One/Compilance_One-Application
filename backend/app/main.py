from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.sync import router as sync_router

app = FastAPI(
    title="Compliance One Gateway API",
    description="Offline-first GST Invoicing & Sync Engine",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sync_router, prefix="/api/v1/sync")

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "compliance-one-gateway"}
