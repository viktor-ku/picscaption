# AI3

FastAPI server providing local AI-powered image upscaling (Real-ESRGAN) and generation (SDXL/Flux).

## Requirements

- Python 3.11+
- NVIDIA GPU with CUDA support (optional, will fall back to CPU)
- [uv](https://docs.astral.sh/uv/) package manager

## Quick Start

### Using Docker (Recommended)

```bash
# Create external volume for model cache
docker volume create ai-models

# Start the server
docker compose up -d ai3

# View logs
docker compose logs -f ai3
```

### Local Development

```bash
# Install dependencies
uv sync

# Run development server
mise run dev

# Or without mise
uv run uvicorn ai_server.main:app --reload --host 0.0.0.0 --port 3001
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ping` | GET | Health check |
| `/api/capabilities` | GET | Get available features based on GPU |
| `/api/upscale` | POST | Upscale image with Real-ESRGAN |
| `/api/image` | POST | Generate image from prompt |

### Capabilities Response

```json
{
  "capabilities": [
    { "kind": "upscale", "model": "realesrgan-x2plus", "scale": 2 },
    { "kind": "upscale", "model": "realesrgan-x4plus", "scale": 4 },
    { "kind": "image", "model": "sdxl" }
  ],
  "device": "cuda",
  "gpu_memory_gb": 8.0
}
```

Each capability record has:
- `kind`: Type of capability (`"upscale"` or `"image"`)
- `model`: Model identifier
- `scale`: (upscale only) Scale factor (2 or 4)

## GPU Memory Tiers

| VRAM | Upscale 2x | Upscale 4x | SDXL | Flux |
|------|------------|------------|------|------|
| < 4 GB | No | No | No | No |
| 4-6 GB | Yes | No | No | No |
| 6-8 GB | Yes | Yes | No | No |
| 8-12 GB | Yes | Yes | Yes | No |
| 12+ GB | Yes | Yes | Yes | Yes |

## Environment Variables

- `GPU_MEMORY_GB` - Override GPU memory detection (useful for reserving memory)
- `CUDA_VISIBLE_DEVICES` - Select which GPU to use

## Development

```bash
# Lint
mise run lint

# Format
mise run format

# Fix all
mise run fix
```

