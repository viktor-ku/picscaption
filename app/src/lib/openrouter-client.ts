import { resizeImageToMaxSize } from "./image-utils";

/**
 * OpenRouter Caption Client
 *
 * TypeScript client for the OpenRouter caption proxy API.
 *
 * @example
 * ```ts
 * import { OpenRouterClient } from './openrouter-client';
 *
 * const client = new OpenRouterClient();
 *
 * // Health check
 * const ready = await client.ping();
 *
 * // Generate caption
 * const result = await client.caption(imageFile, { model: "google/gemini-2.0-flash-exp:free" });
 * console.log(result.caption);
 * ```
 */

/** Maximum image size (longest side) for caption requests */
const MAX_CAPTION_IMAGE_SIZE = 1024;

/** Caption options */
export interface OpenRouterCaptionOptions {
  /** Model ID to use (required, passed through to OpenRouter API) */
  model: string;
  /** Optional custom system prompt to customize caption generation */
  systemPrompt?: string;
}

/** Caption response */
export interface OpenRouterCaptionResponse {
  caption: string;
  model: string;
}

/** Ping response */
export interface OpenRouterPingResponse {
  status: string;
  hasEnvKey: boolean;
  ready: boolean;
}

/** API error response */
export interface OpenRouterApiError {
  error: string;
  detail: string;
}

/** Error thrown when API request fails */
export class OpenRouterApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly detail: string,
  ) {
    super(`OpenRouter API error ${status}: ${detail}`);
    this.name = "OpenRouterApiClientError";
  }
}

/**
 * Client for the OpenRouter caption proxy
 */
export class OpenRouterClient {
  private readonly endpoint: string;

  /**
   * Create a new client
   * @param endpoint - Proxy endpoint URL (defaults to /api/openrouter-caption)
   */
  constructor(endpoint: string = "/api/openrouter-caption") {
    this.endpoint = endpoint;
  }

  /**
   * Health check - verify the API is ready
   * @returns true if API key is configured and ready
   */
  async ping(): Promise<boolean> {
    const response = await fetch(this.endpoint, {
      method: "GET",
    });

    if (!response.ok) {
      return false;
    }

    const data: OpenRouterPingResponse = await response.json();
    return data.ready;
  }

  /**
   * Get detailed status of API configuration
   * @returns Status object with key configuration details
   */
  async status(): Promise<OpenRouterPingResponse> {
    const response = await fetch(this.endpoint, {
      method: "GET",
    });

    if (!response.ok) {
      const error: OpenRouterApiError = await response.json();
      throw new OpenRouterApiClientError(response.status, error.detail);
    }

    return response.json();
  }

  /**
   * Generate a caption for an image
   * @param image - Image file or Blob to caption
   * @param options - Caption options (model is required)
   * @returns Caption response with generated text
   */
  async caption(
    image: File | Blob,
    options: OpenRouterCaptionOptions,
  ): Promise<OpenRouterCaptionResponse> {
    // Compress image to max 1024px on longest side to save tokens
    const compressedImage = await resizeImageToMaxSize(
      image,
      MAX_CAPTION_IMAGE_SIZE,
    );

    console.log(
      `[OpenRouterClient] Image compressed: ${image.size} -> ${compressedImage.size} bytes`,
    );

    const formData = new FormData();

    // Add compressed image
    formData.append("image", compressedImage, "image.jpg");

    // Add model parameter (required)
    formData.append("model", options.model);

    // Add optional system prompt
    if (options.systemPrompt) {
      formData.append("systemPrompt", options.systemPrompt);
    }

    console.log("[OpenRouterClient] Captioning with model:", options.model);

    const response = await fetch(this.endpoint, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const error: OpenRouterApiError = await response.json();
      throw new OpenRouterApiClientError(response.status, error.detail);
    }

    return response.json();
  }
}

export default OpenRouterClient;
