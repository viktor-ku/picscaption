"""SDXL/Flux image generator service."""

import asyncio
import io
import logging
from typing import Literal

from services.capabilities import get_device

logger = logging.getLogger(__name__)


class Generator:
    """Diffusers-based image generator supporting SDXL and Flux."""

    def __init__(self):
        self._sdxl_pipe = None
        self._flux_pipe = None
        self._device = None
        self._loaded_models: list[str] = []

    async def load(self, models: list[str]):
        """Load generation models.

        Args:
            models: List of models to load ("sdxl", "flux")
        """
        self._device = get_device()
        logger.info(f"Loading generation models {models} on {self._device}...")

        loop = asyncio.get_event_loop()

        if "sdxl" in models:
            await loop.run_in_executor(None, self._load_sdxl)
            self._loaded_models.append("sdxl")

        if "flux" in models:
            await loop.run_in_executor(None, self._load_flux)
            self._loaded_models.append("flux")

        logger.info(f"Generation models loaded: {self._loaded_models}")

    def _load_sdxl(self):
        """Load SDXL model (blocking)."""
        import torch
        from diffusers import StableDiffusionXLPipeline

        self._sdxl_pipe = StableDiffusionXLPipeline.from_pretrained(
            "stabilityai/stable-diffusion-xl-base-1.0",
            torch_dtype=torch.float16 if self._device == "cuda" else torch.float32,
            use_safetensors=True,
            variant="fp16" if self._device == "cuda" else None,
        )
        self._sdxl_pipe = self._sdxl_pipe.to(self._device)

        # Enable memory optimizations
        if self._device == "cuda":
            self._sdxl_pipe.enable_model_cpu_offload()

    def _load_flux(self):
        """Load Flux model (blocking)."""
        import torch
        from diffusers import FluxPipeline

        self._flux_pipe = FluxPipeline.from_pretrained(
            "black-forest-labs/FLUX.1-schnell",
            torch_dtype=torch.bfloat16,
        )
        self._flux_pipe = self._flux_pipe.to(self._device)

        if self._device == "cuda":
            self._flux_pipe.enable_model_cpu_offload()

    async def generate(
        self,
        prompt: str,
        negative_prompt: str | None = None,
        width: int = 1024,
        height: int = 1024,
        seed: int = 0,
        steps: int = 30,
        guidance: float = 7.5,
        model: Literal["sdxl", "flux"] = "sdxl",
    ) -> bytes:
        """Generate an image from a prompt.

        Args:
            prompt: Text prompt for generation
            negative_prompt: Things to avoid in output
            width: Image width
            height: Image height
            seed: Random seed (0 = random)
            steps: Number of inference steps
            guidance: Guidance scale
            model: Model to use ("sdxl" or "flux")

        Returns:
            Generated image as PNG bytes
        """
        if model not in self._loaded_models:
            raise RuntimeError(f"Model {model} not loaded. Available: {self._loaded_models}")

        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            self._generate_sync,
            prompt,
            negative_prompt,
            width,
            height,
            seed,
            steps,
            guidance,
            model,
        )
        return result

    def _generate_sync(
        self,
        prompt: str,
        negative_prompt: str | None,
        width: int,
        height: int,
        seed: int,
        steps: int,
        guidance: float,
        model: str,
    ) -> bytes:
        """Synchronous generation operation."""
        import torch

        # Set up generator with seed
        generator = None
        if seed != 0:
            generator = torch.Generator(device=self._device).manual_seed(seed)

        if model == "sdxl":
            image = self._sdxl_pipe(
                prompt=prompt,
                negative_prompt=negative_prompt,
                width=width,
                height=height,
                num_inference_steps=steps,
                guidance_scale=guidance,
                generator=generator,
            ).images[0]
        elif model == "flux":
            # Flux doesn't use negative prompts or guidance scale the same way
            image = self._flux_pipe(
                prompt=prompt,
                width=width,
                height=height,
                num_inference_steps=min(steps, 4),  # Flux schnell uses fewer steps
                generator=generator,
            ).images[0]
        else:
            raise ValueError(f"Unknown model: {model}")

        # Convert to PNG bytes
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")
        return buffer.getvalue()


generator = Generator()
