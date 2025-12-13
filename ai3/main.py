"""FastAPI application entry point."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes import caption_router, generate_router, health_router, upscale_router
from services.capabilities import get_capabilities
from services.captioner import captioner
from services.queue import gpu_queue
from services.upscaler import upscaler

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan - startup and shutdown events."""
    # Startup
    caps = get_capabilities()
    logger.info(f"Detected capabilities: {caps}")

    # Extract capability lists
    upscale_caps = [c for c in caps["capabilities"] if c["kind"] == "upscale"]
    image_caps = [c for c in caps["capabilities"] if c["kind"] == "image"]
    caption_caps = [c for c in caps["capabilities"] if c["kind"] == "caption"]

    # Preload models based on capabilities
    # Note: Generator uses lazy loading, so we don't preload image models
    if upscale_caps:
        logger.info("Preloading upscaler models...")
        await upscaler.load()

    if image_caps:
        logger.info(
            f"Image generation available (lazy loading): {[c['model'] for c in image_caps]}"
        )

    if caption_caps:
        logger.info("Preloading caption models...")
        models = [c["model"] for c in caption_caps]
        await captioner.load(models)

    await gpu_queue.start()
    logger.info("AI server ready")

    yield

    # Shutdown
    await gpu_queue.stop()
    logger.info("AI server shutdown complete")


app = FastAPI(
    title="AI Image Server",
    description="AI-powered image upscaling and generation",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS - allow all origins for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health_router)
app.include_router(upscale_router)
app.include_router(generate_router)
app.include_router(caption_router)
