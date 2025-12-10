## Plan: Implement AI Caption Suggestions (Single + Basic Bulk)

### 1. Choose and frame the feature

- **Most demanded feature**: AI caption suggestions for images (single-image suggestions + basic bulk captioning), matching `LAUNCHPLAN.md`'s "AI caption suggestions (single + bulk)" and the marketing emphasis on speeding up dataset captioning.
- **Scope for this iteration**: Frontend integration with a **configurable caption API endpoint** (similar to the existing `UpscaleClient`), with simple UX hooks in `CaptionForm` and a basic bulk flow; **no in-app accounts/credits** yet (assumed to live on the backend), but clear error handling and loading/progress states.

### 2. API client and settings wiring

- **New settings**
  - Extend `Settings` in `src/lib/settings.ts` with fields like `captionServerUrl` and optionally a `captionPreset` or `captionStyle` enum (e.g. `"simple" | "detailed"`), persisting via existing `getSettings`/`saveSettings`.
  - Update `SettingsDrawer` to expose inputs for the caption server URL and style/preset selector, mirroring how `upscaleServerUrl` is handled.
- **Caption client**
  - Add a new `src/lib/caption-client.ts` that mirrors the structure of `ai3-upscale-client.ts`: configurable `baseUrl`, error type, and methods like `suggestCaption(image: File | Blob, options)` and optionally `bulkSuggestCaptions(payload)` if the backend supports batch.
  - Assume a simple JSON API (e.g. `POST /caption` with image + params, returns `{ caption: string, alternatives?: string[] }`) and keep the client loosely typed so different backends can be adapted with minimal changes.
- **App-level wiring**
  - In `App.tsx`, derive a memoized `CaptionClient` instance from `settings.captionServerUrl` (similar to how `UpscaleClient` is created) and pass down lightweight callbacks/flags to the components that need AI (e.g. `CaptionForm`, a new bulk caption modal).

### 3. Single-image AI caption suggestions in `CaptionForm`

- **UI additions**
  - In `CaptionForm.tsx`, add an action area below the textarea with:
    - A primary button: **"Suggest caption"** (enabled when `captionServerUrl` is configured and an image is selected).
    - Optionally a secondary button: **"Refine current"** that sends the existing caption text plus the image to the backend.
  - Show a subtle indicator when AI is unavailable (no URL configured) with a short tooltip linking users to the settings drawer.
- **State and behavior**
  - Lift minimal state into `App.tsx` or keep it local in `CaptionForm` via props:
    - `isSuggesting` boolean to show a spinner/disabled state.
    - `onRequestSuggestion(imageId)` prop or a more direct `onSuggestCaption(image: ImageData)` that calls the caption client and then `onCaptionChange` with the result.
  - Handle errors from the caption client by showing a toast (using `react-hot-toast` already in `App.tsx`) or an inline error message, and avoid overwriting the current caption on failure.
- **UX details**
  - When a suggestion returns, **replace the caption text but keep it fully editable**, maintaining the human-in-the-loop model described in the docs.
  - Optionally, if the API returns multiple suggestions, pick the first as the default and provide a simple dropdown/"Next suggestion" cycle, but keep this optional to avoid scope creep.

### 4. Basic bulk AI captioning flow

- **Entry point**
  - Add a new control to `Header` (next to existing bulk edit / bulk upscale) like **"Bulk AI Caption"** that opens a `BulkCaptionModal`.
- **`BulkCaptionModal` component**
  - New `src/components/BulkCaptionModal.tsx` modeled after `BulkUpscaleModal.tsx`:
    - Shows how many images will be processed, allows filtering (e.g. "only uncaptioned" checkbox) using props from `App.tsx`.
    - Allows selecting a style/preset if available from settings.
    - On confirm, calls an `onStartBulkCaption(options)` callback provided by `App.tsx`.
- **Bulk captioning logic in `App.tsx`**
  - Implement `handleBulkCaption` in `App.tsx` that:
    - Filters the `images` array to a working set (e.g. uncaptioned or all images, depending on modal options).
    - Iterates sequentially (or in small concurrency batches) over those images, calling the caption client for each.
    - On success, updates `img.caption` in state; on failure, logs and optionally collects a list of failed filenames to show at the end.
    - Maintains a `BulkCaptionProgress { current, total }` state similar to `BulkUpscaleProgress` to drive a progress indicator in `Header` and/or the modal.
  - Ensure operations are **cancellable** by allowing the user to close the modal and stop the loop (e.g. via an `isCancelled` ref checked inside the loop), though this can be a stretch goal if it complicates the first pass too much.

### 5. UX polish, empty/error states, and alignment with docs

- **Local-first + optional AI messaging**
  - In `SettingsDrawer`, explain that the caption server URL is optional and that **no images are sent anywhere** when it is left blank, reinforcing the privacy model from `MARKETING.md`.
  - In AI-related buttons, disable and show a short tooltip when no caption server is configured.
- **Progress and feedback**
  - Reuse the `Header`'s pattern for showing `bulkUpscaleProgress` to also show `bulkCaptionProgress` so users see long-running jobs clearly, as suggested in `LAUNCHPLAN.md`.
  - Surface a concise summary after bulk runs: e.g. "Captioned 120/130 images. 10 failed; click to see list" (implementation of the detailed list can be minimal initially).

### 6. Testing and guardrails

- **Functional checks**
  - Manually test:
    - Single-image suggestion with a working caption server.
    - Behavior when caption server URL is misconfigured (network error, 4xx/5xx) to ensure errors are surfaced nicely and captions are not lost.
    - Bulk captioning on a realistic folder, including performance and UI responsiveness.
  - Ensure that all new settings survive reloads and that IndexedDB auto-save still behaves correctly with AI-updated captions.
- **Code quality**
  - Keep the caption client small and well-typed, mirroring `ai3-upscale-client.ts` patterns.
  - After implementation (per your workspace rule), run `biome format src --fix` to ensure consistent formatting.

### 7. Implementation todos

- **add-caption-settings**: Extend `Settings` and `SettingsDrawer` to support a caption server URL and optional style preset.
- **create-caption-client**: Implement `src/lib/caption-client.ts` with a small, generic caption API client.
- **single-image-ai-ui**: Wire single-image "Suggest caption" / "Refine" actions into `CaptionForm` and `App.tsx` using the caption client.
- **bulk-caption-flow**: Add `BulkCaptionModal` and a `handleBulkCaption` loop in `App.tsx` with progress tracking.
- **ux-messaging-and-errors**: Polish local-vs-AI messaging, disabled states, and error/progress to match the privacy and workflow expectations described in the docs.
