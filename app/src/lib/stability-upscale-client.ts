/**
 * Stability AI Upscale Client
 *
 * TypeScript client for the Stability AI Fast Upscale API via our proxy endpoint.
 *
 * @example
 * ```ts
 * import { StabilityUpscaleClient } from './stability-upscale-client';
 *
 * // Using server-side env key
 * const client = new StabilityUpscaleClient();
 *
 * // Or with user-provided key
 * const client = new StabilityUpscaleClient('sk-...');
 *
 * // Health check
 * const ready = await client.ping();
 *
 * // Upscale an image (always 4x)
 * const file = new File([imageBytes], 'image.png', { type: 'image/png' });
 * const upscaled = await client.upscale(file);
 * ```
 */

/** API error response */
export interface StabilityApiError {
  error: string;
  detail: string;
}

/** Ping response */
export interface StabilityPingResponse {
  status: string;
  hasEnvKey: boolean;
  hasHeaderKey: boolean;
  ready: boolean;
}

/** Error thrown when API request fails */
export class StabilityUpscaleApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly detail: string,
  ) {
    super(`Stability API error ${status}: ${detail}`);
    this.name = "StabilityUpscaleApiError";
  }
}

/**
 * Client for Stability AI Fast Upscale via proxy endpoint
 */
export class StabilityUpscaleClient {
  private readonly apiKey?: string;
  private readonly endpoint: string;

  /**
   * Create a new client
   * @param apiKey - Optional API key (if not provided, uses server-side env var)
   * @param endpoint - Proxy endpoint URL (defaults to /api/stability-upscale)
   */
  constructor(apiKey?: string, endpoint: string = "/api/stability-upscale") {
    this.apiKey = apiKey;
    this.endpoint = endpoint;
  }

  /**
   * Health check - verify the API is ready
   * @returns true if API key is configured and ready
   */
  async ping(): Promise<boolean> {
    const headers: HeadersInit = {};
    if (this.apiKey) {
      headers["X-Stability-Key"] = this.apiKey;
    }

    const response = await fetch(this.endpoint, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      return false;
    }

    const data: StabilityPingResponse = await response.json();
    return data.ready;
  }

  /**
   * Get detailed status of API configuration
   * @returns Status object with key configuration details
   */
  async status(): Promise<StabilityPingResponse> {
    const headers: HeadersInit = {};
    if (this.apiKey) {
      headers["X-Stability-Key"] = this.apiKey;
    }

    const response = await fetch(this.endpoint, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      const error: StabilityApiError = await response.json();
      throw new StabilityUpscaleApiError(response.status, error.detail);
    }

    return response.json();
  }

  /**
   * Upscale an image (always 4x with Stability AI Fast Upscale)
   * @param image - Image file or Blob to upscale
   * @returns Upscaled image as Blob
   */
  async upscale(image: File | Blob): Promise<Blob> {
    const formData = new FormData();

    // Add image
    if (image instanceof File) {
      formData.append("image", image);
    } else {
      formData.append("image", image, "image.png");
    }

    const headers: HeadersInit = {};
    if (this.apiKey) {
      headers["X-Stability-Key"] = this.apiKey;
    }

    console.log("[StabilityUpscaleClient] Upscaling image (4x)");

    const response = await fetch(this.endpoint, {
      method: "POST",
      headers,
      body: formData,
    });

    if (!response.ok) {
      const error: StabilityApiError = await response.json();
      throw new StabilityUpscaleApiError(response.status, error.detail);
    }

    return response.blob();
  }

  /**
   * Upscale an image from a URL
   * @param url - URL of the image to upscale
   * @returns Upscaled image as Blob
   */
  async upscaleFromUrl(url: string): Promise<Blob> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image from ${url}: ${response.status}`);
    }
    const blob = await response.blob();
    return this.upscale(blob);
  }

  /**
   * Upscale an image and return as data URL
   * @param image - Image file or Blob to upscale
   * @returns Upscaled image as data URL string
   */
  async upscaleToDataUrl(image: File | Blob): Promise<string> {
    const blob = await this.upscale(image);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}

export default StabilityUpscaleClient;
