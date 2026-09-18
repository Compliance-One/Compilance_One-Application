from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

from .sync import router as sync_router
# from .voice import router as voice_router # To be implemented by Member 2
# from .auth import router as auth_router # To be implemented by Member 2

app = FastAPI(title="GST VoiceBilling API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sync_router.router, prefix="/api/v1/sync", tags=["Sync"])
# app.include_router(voice_router.router, prefix="/api/v1/voice", tags=["Voice"])
# app.include_router(auth_router.router, prefix="/api/v1/auth", tags=["Auth"])

@app.get("/health")
def health_check():
    return {"status": "ok", "environment": os.getenv("ENVIRONMENT", "development")}
