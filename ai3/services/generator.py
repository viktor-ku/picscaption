"""Image generator service with lazy loading.

Supports SDXL, Flux (FLUX.1-schnell), FLUX.2-dev, and Z-Image-Turbo.
Models are loaded on-demand and only one model is kept in memory at a time.
"""

import asyncio
import gc
import io
import logging
from typing import Literal

from services.capabilities import get_device

logger = logging.getLogger(__name__)

# Supported models
ModelType = Literal["sdxl", "flux", "flux2", "zimage-turbo"]


class Generator:
    """Diffusers-based image generator with lazy loading.

    Only one model is loaded at a time to conserve VRAM.
    When a different model is requested, the current one is unloaded first.
    """

    def __init__(self):
        self._current_model: ModelType | None = None
        self._pipe = None
        self._device = None
        self._lock = asyncio.Lock()

    def _unload_current(self):
        """Unload the current model and free VRAM."""
        if self._pipe is not None:
            logger.info(f"Unloading model: {self._current_model}")
            del self._pipe
            self._pipe = None
            self._current_model = None

            # Force garbage collection and CUDA cache clear
            gc.collect()
            try:
                import torch

                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
                    torch.cuda.synchronize()
            except Exception:
                pass

    def _ensure_device(self):
        """Ensure device is set."""
        if self._device is None:
            self._device = get_device()

    def _load_sdxl(self):
        """Load SDXL model (blocking)."""
        import torch
        from diffusers import StableDiffusionXLPipeline

        logger.info("Loading SDXL model...")
        self._pipe = StableDiffusionXLPipeline.from_pretrained(
            "stabilityai/stable-diffusion-xl-base-1.0",
            torch_dtype=torch.float16 if self._device == "cuda" else torch.float32,
            use_safetensors=True,
            variant="fp16" if self._device == "cuda" else None,
        )
        self._pipe = self._pipe.to(self._device)

        if self._device == "cuda":
            self._pipe.enable_model_cpu_offload()

        self._current_model = "sdxl"
        logger.info("SDXL model loaded")

    def _load_flux(self):
        """Load Flux (FLUX.1-schnell) model (blocking)."""
        import torch
        from diffusers import FluxPipeline

        logger.info("Loading Flux (FLUX.1-schnell) model...")
        self._pipe = FluxPipeline.from_pretrained(
            "black-forest-labs/FLUX.1-schnell",
            torch_dtype=torch.bfloat16,
        )
        self._pipe = self._pipe.to(self._device)

        if self._device == "cuda":
            self._pipe.enable_model_cpu_offload()

        self._current_model = "flux"
        logger.info("Flux model loaded")

    def _load_flux2(self):
        """Load FLUX.2-dev model (blocking)."""
        import torch
        from diffusers import Flux2Pipeline

        logger.info("Loading FLUX.2-dev model...")
        self._pipe = Flux2Pipeline.from_pretrained(
            "black-forest-labs/FLUX.2-dev",
            torch_dtype=torch.bfloat16,
        )
        self._pipe = self._pipe.to(self._device)

        if self._device == "cuda":
            self._pipe.enable_model_cpu_offload()

        self._current_model = "flux2"
        logger.info("FLUX.2-dev model loaded")

    def _load_zimage_turbo(self):
        """Load Z-Image-Turbo model (blocking)."""
        import torch
        from diffusers import ZImagePipeline

        logger.info("Loading Z-Image-Turbo model...")
        self._pipe = ZImagePipeline.from_pretrained(
            "Tongyi-MAI/Z-Image-Turbo",
            torch_dtype=torch.bfloat16,
            low_cpu_mem_usage=False,
        )
        self._pipe = self._pipe.to(self._device)

        if self._device == "cuda":
            self._pipe.enable_model_cpu_offload()

        self._current_model = "zimage-turbo"
        logger.info("Z-Image-Turbo model loaded")

    async def _ensure_model(self, model: ModelType):
        """Ensure the requested model is loaded, unloading others if needed."""
        async with self._lock:
            self._ensure_device()

            if self._current_model == model:
                return  # Already loaded

            # Unload current model first
            if self._current_model is not None:
                loop = asyncio.get_event_loop()
                await loop.run_in_executor(None, self._unload_current)

            # Load the requested model
            loop = asyncio.get_event_loop()
            if model == "sdxl":
                await loop.run_in_executor(None, self._load_sdxl)
            elif model == "flux":
                await loop.run_in_executor(None, self._load_flux)
            elif model == "flux2":
                await loop.run_in_executor(None, self._load_flux2)
            elif model == "zimage-turbo":
                await loop.run_in_executor(None, self._load_zimage_turbo)
            else:
                raise ValueError(f"Unknown model: {model}")

    async def generate(
        self,
        prompt: str,
        negative_prompt: str | None = None,
        width: int = 1024,
        height: int = 1024,
        seed: int = 0,
        steps: int = 30,
        guidance: float = 7.5,
        model: ModelType = "sdxl",
    ) -> bytes:
        """Generate an image from a prompt.

        Args:
            prompt: Text prompt for generation
            negative_prompt: Things to avoid in output (not used by Flux/Z-Image)
            width: Image width
            height: Image height
            seed: Random seed (0 = random)
            steps: Number of inference steps
            guidance: Guidance scale (not used by Flux/Z-Image)
            model: Model to use

        Returns:
            Generated image as PNG bytes
        """
        # Lazy load the model
        await self._ensure_model(model)

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
        gen = None
        if seed != 0:
            gen = torch.Generator(device=self._device).manual_seed(seed)

        if model == "sdxl":
            image = self._pipe(
                prompt=prompt,
                negative_prompt=negative_prompt,
                width=width,
                height=height,
                num_inference_steps=steps,
                guidance_scale=guidance,
                generator=gen,
            ).images[0]

        elif model == "flux":
            # Flux schnell uses fewer steps, no negative prompt or guidance
            image = self._pipe(
                prompt=prompt,
                width=width,
                height=height,
                num_inference_steps=min(steps, 4),
                generator=gen,
            ).images[0]

        elif model == "flux2":
            # FLUX.2-dev: ~28-50 steps recommended
            image = self._pipe(
                prompt=prompt,
                width=width,
                height=height,
                num_inference_steps=min(steps, 50),
                guidance_scale=guidance,
                generator=gen,
            ).images[0]

        elif model == "zimage-turbo":
            # Z-Image-Turbo: 8 steps (num_inference_steps=9), guidance=0
            image = self._pipe(
                prompt=prompt,
                height=height,
                width=width,
                num_inference_steps=9,  # Results in 8 DiT forwards
                guidance_scale=0.0,
                generator=gen,
            ).images[0]

        else:
            raise ValueError(f"Unknown model: {model}")

        # Convert to PNG bytes
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")
        return buffer.getvalue()

    def get_loaded_model(self) -> ModelType | None:
        """Return the currently loaded model, if any."""
        return self._current_model


generator = Generator()
