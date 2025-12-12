# PicsCaption App

Frontend application for PicsCaption - an AI-powered image captioning tool.

## Development

### Prerequisites

- [Bun](https://bun.sh/) runtime
- [Convex](https://convex.dev/) account (for backend)

### Environment Variables

Create a `.env.local` file in this directory with the following variables:

```bash
# Convex (required)
PUBLIC_CONVEX_URL=https://your-project.convex.cloud

# Stability AI - for cloud-based 4x upscaling (optional)
STABILITY_API_KEY=sk-...

# OpenRouter - for cloud-based AI captioning (optional)
OPENROUTER_API_KEY=sk-or-...
```

### Commands

| Command         | Action                                |
| :-------------- | :------------------------------------ |
| `bun install`   | Install dependencies                  |
| `bun run dev`   | Start local dev server at `:4321`     |
| `bun run build` | Build production site to `./dist/`    |
| `bun run preview` | Preview build locally before deploy |
