"""
Compliance One - FastAPI Application Entry Point.
Member 3: Transactional Workflows & Inventory Engine
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1 import api_v1_router

app = FastAPI(
    title="Compliance One - Transactional Workflows & GST Invoicing API",
    description="Backend API powering GST calculations, invoice generation, product catalog, payment reconciliation, inventory adjustments, and supplier master data.",
    version="1.0.0",
)

# Enable CORS for React Native mobile and web clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routes
app.include_router(api_v1_router, prefix="/api")


@app.get("/", tags=["Health"])
def health_check():
    return {
        "app": "Compliance One API",
        "status": "online",
        "version": "1.0.0",
        "role": "Member 3: Transactional Workflows & Inventory Engineer",
    }

