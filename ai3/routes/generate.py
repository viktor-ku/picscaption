"""Image generation route."""

from typing import Literal

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

from services.capabilities import require_generate
from services.generator import generator
from services.queue import gpu_queue

router = APIRouter(prefix="/api")


class GenerateRequest(BaseModel):
    """Request body for image generation."""

    prompt: str = Field(..., description="Text prompt for generation")
    negative_prompt: str | None = Field(None, description="Things to avoid in output")
    width: int = Field(1024, ge=256, le=2048, description="Image width")
    height: int = Field(1024, ge=256, le=2048, description="Image height")
    seed: int = Field(0, ge=0, description="Random seed (0 = random)")
    steps: int = Field(30, ge=1, le=100, description="Number of inference steps")
    guidance: float = Field(7.5, ge=0, le=20, description="Guidance scale")
    model: Literal["sdxl", "flux"] = Field("sdxl", description="Model to use")


@router.post("/image")
async def generate_image(request: GenerateRequest) -> Response:
    """Generate an image from a text prompt.

    Returns:
        Generated PNG image
    """
    # Check capability
    try:
        require_generate(request.model)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from None

    # Submit to GPU queue
    async def do_generate():
        return await generator.generate(
            prompt=request.prompt,
            negative_prompt=request.negative_prompt,
            width=request.width,
            height=request.height,
            seed=request.seed,
            steps=request.steps,
            guidance=request.guidance,
            model=request.model,
        )

    try:
        result = await gpu_queue.submit(do_generate)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Generation failed: {e}") from None

    return Response(content=result, media_type="image/png")
