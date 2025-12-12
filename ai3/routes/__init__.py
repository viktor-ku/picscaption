"""API routes."""

from routes.generate import router as generate_router
from routes.health import router as health_router
from routes.upscale import router as upscale_router

__all__ = ["health_router", "upscale_router", "generate_router"]
