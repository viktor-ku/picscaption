"""GPU capability detection and tier logic."""

import logging
from typing import Literal, TypedDict

from pydantic_settings import BaseSettings

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    """Server settings from environment variables."""

    gpu_memory_gb: float | None = None  # None = auto-detect

    model_config = {"env_prefix": ""}


settings = Settings()


class UpscaleCapability(TypedDict):
    """Upscale capability record."""

    kind: Literal["upscale"]
    model: str
    scale: Literal[2, 4]


class ImageCapability(TypedDict):
    """Image generation capability record."""

    kind: Literal["image"]
    model: str


class CaptionCapability(TypedDict):
    """Caption capability record."""

    kind: Literal["caption"]
    model: str


Capability = UpscaleCapability | ImageCapability | CaptionCapability


class CapabilitiesResponse(TypedDict):
    """Full capabilities response."""

    capabilities: list[Capability]
    device: Literal["cuda", "cpu"]
    gpu_memory_gb: float


def get_gpu_memory() -> float:
    """Get GPU memory in GB (from env or auto-detect)."""
    if settings.gpu_memory_gb is not None:
        return settings.gpu_memory_gb

    import torch

    if torch.cuda.is_available():
        props = torch.cuda.get_device_properties(0)
        return props.total_memory / (1024**3)
    return 0.0


def get_device() -> Literal["cuda", "cpu"]:
    """Get compute device (cuda or cpu)."""
    import torch

    if torch.cuda.is_available():
        return "cuda"
    logger.warning("No CUDA GPU detected - running on CPU (slow)")
    return "cpu"


def get_capabilities() -> CapabilitiesResponse:
    """Return available capabilities based on GPU memory."""
    mem = get_gpu_memory()
    device = get_device()

    capabilities: list[Capability] = []

    # CPU mode: allow basic operations but warn it's slow
    if device == "cpu":
        capabilities = [
            {"kind": "upscale", "model": "realesrgan-x2plus", "scale": 2},
            {"kind": "upscale", "model": "realesrgan-x4plus", "scale": 4},
            {"kind": "image", "model": "sdxl"},
            {"kind": "caption", "model": "blip2"},
            {"kind": "caption", "model": "florence2-base"},
        ]
        return {
            "capabilities": capabilities,
            "device": "cpu",
            "gpu_memory_gb": 0,
        }

    # GPU mode: based on VRAM
    if mem >= 4:
        capabilities.append({"kind": "upscale", "model": "realesrgan-x2plus", "scale": 2})
        capabilities.append({"kind": "caption", "model": "blip2"})
        capabilities.append({"kind": "caption", "model": "florence2-base"})
    if mem >= 6:
        capabilities.append({"kind": "upscale", "model": "realesrgan-x4plus", "scale": 4})
        capabilities.append({"kind": "caption", "model": "florence2-large"})
    if mem >= 8:
        capabilities.append({"kind": "image", "model": "sdxl"})
    if mem >= 12:
        capabilities.append({"kind": "image", "model": "flux"})

    return {
        "capabilities": capabilities,
        "device": "cuda",
        "gpu_memory_gb": round(mem, 1),
    }


def has_capability(kind: str, **kwargs) -> bool:
    """Check if a capability is available."""
    caps = get_capabilities()
    for cap in caps["capabilities"]:
        if cap["kind"] != kind:
            continue
        if all(cap.get(k) == v for k, v in kwargs.items()):
            return True
    return False


def require_upscale(scale: int, model: str = "realesrgan-x4plus") -> None:
    """Raise ValueError if upscale capability unavailable."""
    if scale == 2:
        model = "realesrgan-x2plus"
    if not has_capability("upscale", model=model, scale=scale):
        caps = get_capabilities()
        raise ValueError(
            f"Upscale {scale}x with {model} not available. "
            f"Device: {caps['device']}, VRAM: {caps['gpu_memory_gb']} GB"
        )


def require_generate(model: str) -> None:
    """Raise ValueError if generation model unavailable."""
    if not has_capability("image", model=model):
        caps = get_capabilities()
        raise ValueError(
            f"Image generation with {model} not available. "
            f"Device: {caps['device']}, VRAM: {caps['gpu_memory_gb']} GB"
        )


def require_caption(model: str) -> None:
    """Raise ValueError if caption model unavailable."""
    if not has_capability("caption", model=model):
        caps = get_capabilities()
        raise ValueError(
            f"Captioning with {model} not available. "
            f"Device: {caps['device']}, VRAM: {caps['gpu_memory_gb']} GB"
        )
