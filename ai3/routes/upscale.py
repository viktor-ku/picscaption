"""Upscale route."""

from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import Response

from services.capabilities import require_upscale
from services.queue import gpu_queue
from services.upscaler import upscaler

router = APIRouter(prefix="/api")


@router.post("/upscale")
async def upscale(
    image: Annotated[UploadFile, File()],
    scale: Annotated[int, Form()] = 4,
    prompt: Annotated[str | None, Form()] = None,
    negative_prompt: Annotated[str | None, Form()] = None,
    seed: Annotated[int, Form()] = 0,
    steps: Annotated[int, Form()] = 20,
    guidance: Annotated[float, Form()] = 7.5,
) -> Response:
    """Upscale an image using Real-ESRGAN.

    Args:
        image: Image file to upscale
        scale: Upscale factor (2 or 4)
        prompt: Text prompt (currently unused, for API compatibility)
        negative_prompt: Negative prompt (currently unused)
        seed: Random seed (currently unused)
        steps: Number of steps (currently unused)
        guidance: Guidance scale (currently unused)

    Returns:
        Upscaled PNG image
    """
    # Validate scale
    if scale not in (2, 4):
        raise HTTPException(status_code=400, detail="Scale must be 2 or 4")

    # Check capability
    try:
        require_upscale(scale)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from None

    # Read image data
    image_bytes = await image.read()

    # Submit to GPU queue
    async def do_upscale():
        return await upscaler.upscale(image_bytes, scale=scale)

    try:
        result = await gpu_queue.submit(do_upscale)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upscaling failed: {e}") from None

    return Response(content=result, media_type="image/png")
