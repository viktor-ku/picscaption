"""Image captioning service using BLIP-2 and Florence-2."""

import asyncio
import io
import logging
from typing import Literal

from PIL import Image

from services.capabilities import get_device

logger = logging.getLogger(__name__)

# Model IDs
MODEL_IDS = {
    "blip2": "Salesforce/blip2-opt-2.7b",
    "florence2-base": "microsoft/Florence-2-base",
    "florence2-large": "microsoft/Florence-2-large",
}

CaptionModel = Literal["blip2", "florence2-base", "florence2-large"]


class Captioner:
    """Multi-model image captioner supporting BLIP-2 and Florence-2."""

    def __init__(self):
        self._blip2_model = None
        self._blip2_processor = None
        self._florence_model = None
        self._florence_processor = None
        self._florence_variant: str | None = None
        self._device = None
        self._loaded_models: list[str] = []

    async def load(self, models: list[str]):
        """Load caption models.

        Args:
            models: List of models to load ("blip2", "florence2-base", "florence2-large")
        """
        self._device = get_device()
        logger.info(f"Loading caption models {models} on {self._device}...")

        loop = asyncio.get_event_loop()

        if "blip2" in models:
            await loop.run_in_executor(None, self._load_blip2)
            self._loaded_models.append("blip2")

        # Load Florence (prefer large if requested, otherwise base)
        florence_to_load = None
        if "florence2-large" in models:
            florence_to_load = "florence2-large"
        elif "florence2-base" in models:
            florence_to_load = "florence2-base"

        if florence_to_load:
            await loop.run_in_executor(None, self._load_florence, florence_to_load)
            # Florence can handle both variants once loaded (just use largest available)
            if florence_to_load == "florence2-large":
                self._loaded_models.append("florence2-large")
                self._loaded_models.append("florence2-base")  # Large can do base tasks
            else:
                self._loaded_models.append("florence2-base")

        logger.info(f"Caption models loaded: {self._loaded_models}")

    def _load_blip2(self):
        """Load BLIP-2 model (blocking)."""
        import torch
        from transformers import Blip2ForConditionalGeneration, Blip2Processor

        logger.info("Loading BLIP-2 model...")

        self._blip2_processor = Blip2Processor.from_pretrained(MODEL_IDS["blip2"])
        self._blip2_model = Blip2ForConditionalGeneration.from_pretrained(
            MODEL_IDS["blip2"],
            torch_dtype=torch.float16 if self._device == "cuda" else torch.float32,
        )
        self._blip2_model = self._blip2_model.to(self._device)
        self._blip2_model.eval()

        logger.info("BLIP-2 model loaded")

    def _load_florence(self, variant: str):
        """Load Florence-2 model (blocking)."""
        import torch
        from transformers import AutoModelForCausalLM, AutoProcessor

        logger.info(f"Loading Florence-2 ({variant}) model...")

        model_id = MODEL_IDS[variant]
        self._florence_processor = AutoProcessor.from_pretrained(model_id, trust_remote_code=True)
        self._florence_model = AutoModelForCausalLM.from_pretrained(
            model_id,
            torch_dtype=torch.float16 if self._device == "cuda" else torch.float32,
            trust_remote_code=True,
        )
        self._florence_model = self._florence_model.to(self._device)
        self._florence_model.eval()
        self._florence_variant = variant

        logger.info(f"Florence-2 ({variant}) model loaded")

    async def caption(
        self,
        image_bytes: bytes,
        model: CaptionModel = "florence2-base",
    ) -> str:
        """Generate a caption for an image.

        Args:
            image_bytes: Input image as bytes
            model: Model to use for captioning

        Returns:
            Generated caption string
        """
        if model not in self._loaded_models:
            raise RuntimeError(f"Model {model} not loaded. Available: {self._loaded_models}")

        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            self._caption_sync,
            image_bytes,
            model,
        )
        return result

    def _caption_sync(self, image_bytes: bytes, model: str) -> str:
        """Synchronous captioning operation."""
        # Load image
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

        if model == "blip2":
            return self._caption_blip2(image)
        elif model in ("florence2-base", "florence2-large"):
            return self._caption_florence(image)
        else:
            raise ValueError(f"Unknown model: {model}")

    def _caption_blip2(self, image: Image.Image) -> str:
        """Generate caption using BLIP-2."""
        import torch

        inputs = self._blip2_processor(images=image, return_tensors="pt").to(
            self._device, torch.float16 if self._device == "cuda" else torch.float32
        )

        with torch.no_grad():
            generated_ids = self._blip2_model.generate(**inputs, max_new_tokens=100)

        caption = self._blip2_processor.batch_decode(generated_ids, skip_special_tokens=True)[0]
        return caption.strip()

    def _caption_florence(self, image: Image.Image) -> str:
        """Generate caption using Florence-2."""
        import torch

        # Use detailed caption task
        task_prompt = "<MORE_DETAILED_CAPTION>"

        inputs = self._florence_processor(text=task_prompt, images=image, return_tensors="pt").to(
            self._device, torch.float16 if self._device == "cuda" else torch.float32
        )

        with torch.no_grad():
            generated_ids = self._florence_model.generate(
                input_ids=inputs["input_ids"],
                pixel_values=inputs["pixel_values"],
                max_new_tokens=1024,
                num_beams=3,
            )

        generated_text = self._florence_processor.batch_decode(
            generated_ids, skip_special_tokens=False
        )[0]

        # Parse the output
        parsed = self._florence_processor.post_process_generation(
            generated_text,
            task=task_prompt,
            image_size=(image.width, image.height),
        )

        caption = parsed.get(task_prompt, generated_text)
        return caption.strip()


captioner = Captioner()

