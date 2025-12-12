"""API routes."""

from routes.caption import router as caption_router
from routes.generate import router as generate_router
from routes.health import router as health_router
from routes.upscale import router as upscale_router

__all__ = ["health_router", "upscale_router", "generate_router", "caption_router"]
