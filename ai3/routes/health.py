"""Health check routes."""

from fastapi import APIRouter

from services.capabilities import get_capabilities

router = APIRouter(prefix="/api")


@router.get("/ping")
async def ping():
    """Health check endpoint."""
    return {"status": "ok"}


@router.get("/capabilities")
async def capabilities():
    """Get available capabilities based on GPU memory."""
    return get_capabilities()
