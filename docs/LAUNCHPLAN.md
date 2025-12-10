## PicsCaption Launch Plan (Paid, AI-Powered)

> For go-to-market and channel strategy, see also `MARKETING.md`.

### 1. Product Vision

- **Core idea**: Privacy‑respecting image captioning and dataset tooling that runs in the browser, with optional cloud AI features (captioning, upscaling, quality aids) exposed via your own backend.
- **Positioning**: Hybrid between **dataset captioning tools** (Captyon/CVAT‑style) and **social caption helpers**, with a strong lean toward **ML/dataset users**.
- **Business model**: Free local/manual usage; **paid AI features over the wire** billed on a **usage‑based (credits) model**.

### 2. Primary Audiences

- **ML / data practitioners (primary)**: People curating or labeling image datasets (e.g. for diffusion/vision models) who want faster captioning, basic quality control, and structured exports.
- **Social / creator users (secondary)**: Creators who want AI‑assisted captions and upscales for batches of images, but with a simpler, dataset‑oriented workflow rather than a full social scheduler.

### 3. Must‑Have AI Product Features

- **AI caption suggestions (single + bulk)**
  - Generate 1–N caption suggestions per image driven by remote models (e.g. Stability or other providers), with editable, human‑in‑the‑loop acceptance.
  - Bulk mode to queue captioning for many images in a folder, with progress feedback and failure/retry handling.
  - Optional style presets (e.g. simple descriptive vs more detailed dataset captions) and support for re‑running AI to refine an existing caption.

- **AI‑powered bulk operations**
  - **Bulk captioning** for a dataset/folder as a first‑class workflow.
  - **Caption refinement**: Improve or extend existing text (grammar, detail, tone) using AI while preserving manual control.
  - **Future‑facing quality aids** (not necessarily MVP): flag low‑quality or NSFW images, potential duplicates, or other data issues.

- **AI upscaling and enhancement as a paid feature**
  - Replace/augment the current local upscaling integration with a backend‑routed Stability (or similar) upscale pipeline.
  - Track and bill for **per‑image upscaling** and **bulk upscale jobs** via the credit system.
  - Provide progress, retries, and graceful handling of partial failures.

### 4. Workflow & Data Model Enhancements

- **Richer per‑image metadata**
  - Multiple fields per image (e.g. `short_caption`, `long_caption`, `tags`, `notes`) instead of a single caption string.
  - Simple **tags/attributes** (e.g. "night", "outdoor", "needs_review") to support filtering and QA.

- **Project‑level workflow**
  - Introduce a "project" or "dataset" concept (beyond just "a folder on disk") so users can re‑open work and track status.
  - Basic stats per project: total images, # captioned, # AI‑generated vs manual, simple label/tag distributions.
  - Filters and search: show only uncaptioned, only AI‑captioned, only tagged with X, etc.

- **Exports suitable for paid users**
  - Extend beyond JSON/JSONL toward more dataset‑friendly and/or social‑useful formats (e.g. CSV, COCO‑like variants, text snippets for posting), while keeping the existing exports.

### 5. SaaS & Platform Requirements

- **Authentication and accounts**
  - User registration/login (email+password and/or OAuth) to tie:
    - Credit balance
    - AI usage history
    - Project metadata and settings
  - Optional "local only" mode (no login, no remote AI) vs logged‑in "cloud/AI" mode.

- **Credits and usage metering (usage‑based billing)**
  - Define a clear **credit unit** (e.g. 1 credit per single‑image caption call, X credits per upscale, more for larger resolutions or more expensive model calls).
  - Track usage per user on the backend and decrement credit balances with each AI operation.
  - Enforce hard limits when credits are exhausted, and surface remaining credits and estimated cost in the UI before large batch jobs.

- **Payments integration**
  - Integrate with a payment provider (e.g. Stripe) to sell **credit packs** (one‑off purchases) and possibly metered plans later.
  - Ensure purchasing immediately updates the credit balance and exposes a minimal billing history/receipts view.

- **Backend AI proxy service**
  - Backend API that:
    - Holds Stability and other provider API keys securely.
    - Validates user auth + credit balance before making outbound AI calls.
    - Calls remote AI services and returns results in a format the frontend can consume.
    - Logs structured usage events (user, project, operation type, model, cost) for metering, analytics, and debugging.

### 6. Trust, Safety, and Reliability

- **Privacy model clarity**
  - Clearly distinguish between:
    - **Local mode**: no images leave the browser, no AI over the wire, manual captioning only.
    - **Cloud/AI mode**: images and/or derived features are sent to remote AI APIs via your backend; describe retention and logging policies.

- **Robust error and limit handling**
  - Handle AI timeouts, provider errors, and rate limits gracefully in bulk jobs.
  - Provide tools to **retry failed items** and to understand what succeeded vs failed.
  - Clear UX when credit limits are hit, including guidance for purchasing more.

- **Reproducibility for ML users (iterative)**
  - Record which AI model/version and parameters were used when generating captions or upscales.
  - Expose this metadata in exports and/or project metadata so experiments and datasets are traceable.

### 7. MVP vs Later Iterations

- **MVP must‑haves to charge money**
  - User accounts and basic auth.
  - Credits system with usage tracking and hard limits.
  - Payment integration for buying credits.
  - Backend proxy for Stability/other AI APIs.
  - AI caption suggestions (single + bulk) and AI upscaling wired through that backend.
  - Minimal project stats and filters (e.g. uncaptioned vs captioned, AI‑generated vs manual).

- **Nice‑to‑have next iterations**
  - More advanced quality checks (NSFW/duplicate/low‑quality detection).
  - Richer exports (COCO, YOLO, etc.) and social‑optimized text outputs.
  - More elaborate workflow features (review states, multi‑user collaboration, role permissions).
  - Deeper style control and multi‑language AI captioning.
