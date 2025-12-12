"""Services for AI operations."""

from services.capabilities import (
    CapabilitiesResponse,
    Capability,
    ImageCapability,
    UpscaleCapability,
    get_capabilities,
    get_device,
    has_capability,
    require_generate,
    require_upscale,
)
from services.generator import generator
from services.queue import gpu_queue
from services.upscaler import upscaler

__all__ = [
    "Capability",
    "CapabilitiesResponse",
    "ImageCapability",
    "UpscaleCapability",
    "get_capabilities",
    "get_device",
    "has_capability",
    "require_upscale",
    "require_generate",
    "gpu_queue",
    "upscaler",
    "generator",
]
