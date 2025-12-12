"""Image captioning route."""

from typing import Annotated, Literal

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from services.capabilities import require_caption
from services.captioner import captioner
from services.queue import gpu_queue

router = APIRouter(prefix="/api")


class CaptionResponse(BaseModel):
    """Response body for caption generation."""

    caption: str
    model: str


@router.post("/caption")
async def caption(
    image: Annotated[UploadFile, File()],
    model: Annotated[
        Literal["blip2", "florence2-base", "florence2-large"], Form()
    ] = "florence2-base",
) -> CaptionResponse:
    """Generate a caption for an image.

    Args:
        image: Image file to caption
        model: Model to use (blip2, florence2-base, florence2-large)

    Returns:
        JSON with caption string
    """
    # Check capability
    try:
        require_caption(model)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from None

    # Read image data
    image_bytes = await image.read()

    # Submit to GPU queue
    async def do_caption():
        return await captioner.caption(image_bytes, model=model)

    try:
        result = await gpu_queue.submit(do_caption)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Captioning failed: {e}") from None

    return CaptionResponse(caption=result, model=model)
