"""Image upscaler service using spandrel."""

import asyncio
import logging
from pathlib import Path
from typing import Literal

import torch

from services.capabilities import get_device

logger = logging.getLogger(__name__)

# Model URLs for Real-ESRGAN
MODEL_URLS = {
    2: "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.1/RealESRGAN_x2plus.pth",
    4: "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth",
}


class Upscaler:
    """Spandrel-based image upscaler supporting Real-ESRGAN models."""

    def __init__(self):
        self._models: dict[int, torch.nn.Module] = {}
        self._device = None

    async def load(self):
        """Load upscaler models."""
        self._device = get_device()
        logger.info(f"Loading upscaler models on {self._device}...")

        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, self._load_models)

        logger.info("Upscaler models loaded")

    def _load_models(self):
        """Load Real-ESRGAN models using spandrel (blocking)."""
        import urllib.request

        import spandrel

        cache_dir = Path.home() / ".cache" / "ai3" / "models"
        cache_dir.mkdir(parents=True, exist_ok=True)

        for scale in [2, 4]:
            model_path = cache_dir / f"RealESRGAN_x{scale}plus.pth"

            # Download if not cached
            if not model_path.exists():
                logger.info(f"Downloading RealESRGAN x{scale} model...")
                urllib.request.urlretrieve(MODEL_URLS[scale], model_path)

            # Load with spandrel
            logger.info(f"Loading RealESRGAN x{scale} model...")
            model = spandrel.ModelLoader().load_from_file(model_path)
            model = model.to(self._device)
            if self._device == "cuda":
                model = model.half()  # Use fp16 on GPU
            model.eval()

            self._models[scale] = model

    async def upscale(
        self,
        image_bytes: bytes,
        scale: Literal[2, 4] = 4,
    ) -> bytes:
        """Upscale an image.

        Args:
            image_bytes: Input image as bytes
            scale: Upscale factor (2 or 4)

        Returns:
            Upscaled image as PNG bytes
        """
        if scale not in (2, 4):
            raise ValueError(f"Scale must be 2 or 4, got {scale}")

        if scale not in self._models:
            raise RuntimeError(f"Model for scale {scale} not loaded. Call load() first.")

        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            self._upscale_sync,
            image_bytes,
            scale,
        )
        return result

    def _upscale_sync(self, image_bytes: bytes, scale: int) -> bytes:
        """Synchronous upscaling operation."""
        import cv2
        import numpy as np

        model = self._models[scale]

        # Decode image
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_UNCHANGED)

        if img is None:
            raise ValueError("Failed to decode image")

        # Handle different image modes
        has_alpha = len(img.shape) == 3 and img.shape[2] == 4
        if has_alpha:
            # Separate alpha channel
            alpha = img[:, :, 3]
            img = img[:, :, :3]

        # Convert BGR to RGB
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

        # Convert to tensor: HWC -> CHW, normalize to 0-1
        img_tensor = torch.from_numpy(img).permute(2, 0, 1).float() / 255.0
        img_tensor = img_tensor.unsqueeze(0)  # Add batch dimension

        # Move to device and convert to fp16 if on GPU
        img_tensor = img_tensor.to(self._device)
        if self._device == "cuda":
            img_tensor = img_tensor.half()

        # Upscale
        with torch.no_grad():
            output = model(img_tensor)

        # Convert back: CHW -> HWC, denormalize
        output = output.squeeze(0).permute(1, 2, 0).float().cpu().numpy()
        output = (output * 255.0).clip(0, 255).astype(np.uint8)

        # Convert RGB to BGR
        output = cv2.cvtColor(output, cv2.COLOR_RGB2BGR)

        # Handle alpha channel
        if has_alpha:
            # Upscale alpha separately using simple resize
            alpha_upscaled = cv2.resize(
                alpha,
                (output.shape[1], output.shape[0]),
                interpolation=cv2.INTER_LANCZOS4,
            )
            output = cv2.cvtColor(output, cv2.COLOR_BGR2BGRA)
            output[:, :, 3] = alpha_upscaled

        # Encode as PNG
        _, buffer = cv2.imencode(".png", output)
        return buffer.tobytes()


upscaler = Upscaler()
