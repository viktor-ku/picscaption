/**
 * Stability AI Image Generation Client
 *
 * TypeScript client for Stability AI text-to-image API via our proxy endpoint.
 * Supports SDXL 1.0, SD 3.5 variants, and Stable Image Ultra.
 *
 * @example
 * ```ts
 * import { StabilityGenerateClient } from './stability-generate-client';
 *
 * const client = new StabilityGenerateClient();
 *
 * // Generate with SDXL 1.0
 * const image = await client.generate({
 *   model: 'sdxl-1.0',
 *   prompt: 'A beautiful sunset over mountains',
 * });
 *
 * // Generate with SD 3.5
 * const image2 = await client.generate({
 *   model: 'sd3.5-large',
 *   prompt: 'A futuristic city',
 * });
 *
 * // Generate with Ultra
 * const image3 = await client.generate({
 *   model: 'ultra',
 *   prompt: 'A photorealistic portrait',
 * });
 * ```
 */

/** Supported Stability AI models */
export type StabilityModel =
  | "sdxl-1.0"
  | "sd3.5-large"
  | "sd3.5-large-turbo"
  | "sd3.5-medium"
  | "sd3.5-flash"
  | "ultra";

/** Generation options */
export interface StabilityGenerateOptions {
  /** Model to use */
  model: StabilityModel;
  /** Text prompt for generation */
  prompt: string;
  /** Things to avoid in output */
  negativePrompt?: string;
  /** Image width (SDXL 1.0 only, default: 1024) */
  width?: number;
  /** Image height (SDXL 1.0 only, default: 1024) */
  height?: number;
  /** Aspect ratio (SD3/Ultra only, e.g., "1:1", "16:9", "9:16") */
  aspectRatio?: string;
  /** Number of inference steps (SDXL 1.0 only, default: 30) */
  steps?: number;
  /** CFG scale (SDXL 1.0 only, default: 7) */
  cfgScale?: number;
  /** Random seed, 0 = random (default: 0) */
  seed?: number;
}

/** Ping response */
export interface StabilityGeneratePingResponse {
  status: string;
  hasEnvKey: boolean;
  hasHeaderKey: boolean;
  ready: boolean;
  supportedModels: StabilityModel[];
}

/** API error response */
export interface StabilityGenerateApiError {
  error: string;
  detail: string;
}

/** Error thrown when API request fails */
export class StabilityGenerateError extends Error {
  constructor(
    public readonly status: number,
    public readonly detail: string,
  ) {
    super(`Stability Generate API error ${status}: ${detail}`);
    this.name = "StabilityGenerateError";
  }
}

/** Model display information */
export interface StabilityModelInfo {
  id: StabilityModel;
  name: string;
  description: string;
  supportsNegativePrompt: boolean;
  supportsDimensions: boolean;
  supportsAspectRatio: boolean;
}

/** Available models with their info */
export const STABILITY_MODELS: StabilityModelInfo[] = [
  {
    id: "sdxl-1.0",
    name: "SDXL 1.0",
    description: "Stable Diffusion XL 1.0 - high quality, configurable",
    supportsNegativePrompt: true,
    supportsDimensions: true,
    supportsAspectRatio: false,
  },
  {
    id: "sd3.5-large",
    name: "SD 3.5 Large",
    description: "Stable Diffusion 3.5 Large - best quality",
    supportsNegativePrompt: true,
    supportsDimensions: false,
    supportsAspectRatio: true,
  },
  {
    id: "sd3.5-large-turbo",
    name: "SD 3.5 Large Turbo",
    description: "SD 3.5 Large optimized for speed",
    supportsNegativePrompt: true,
    supportsDimensions: false,
    supportsAspectRatio: true,
  },
  {
    id: "sd3.5-medium",
    name: "SD 3.5 Medium",
    description: "Balanced quality and speed",
    supportsNegativePrompt: true,
    supportsDimensions: false,
    supportsAspectRatio: true,
  },
  {
    id: "sd3.5-flash",
    name: "SD 3.5 Flash",
    description: "Fastest SD 3.5 variant",
    supportsNegativePrompt: true,
    supportsDimensions: false,
    supportsAspectRatio: true,
  },
  {
    id: "ultra",
    name: "Stable Image Ultra",
    description: "Latest and greatest image generation",
    supportsNegativePrompt: true,
    supportsDimensions: false,
    supportsAspectRatio: true,
  },
];

/**
 * Client for Stability AI image generation via proxy endpoint
 */
export class StabilityGenerateClient {
  private readonly apiKey?: string;
  private readonly endpoint: string;

  /**
   * Create a new client
   * @param apiKey - Optional API key (if not provided, uses server-side env var)
   * @param endpoint - Proxy endpoint URL (defaults to /api/stability-generate)
   */
  constructor(apiKey?: string, endpoint: string = "/api/stability-generate") {
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

    const data: StabilityGeneratePingResponse = await response.json();
    return data.ready;
  }

  /**
   * Get detailed status of API configuration
   * @returns Status object with configuration details
   */
  async status(): Promise<StabilityGeneratePingResponse> {
    const headers: HeadersInit = {};
    if (this.apiKey) {
      headers["X-Stability-Key"] = this.apiKey;
    }

    const response = await fetch(this.endpoint, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      const error: StabilityGenerateApiError = await response.json();
      throw new StabilityGenerateError(response.status, error.detail);
    }

    return response.json();
  }

  /**
   * Generate an image
   * @param options - Generation options
   * @returns Generated image as Blob
   */
  async generate(options: StabilityGenerateOptions): Promise<Blob> {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };
    if (this.apiKey) {
      headers["X-Stability-Key"] = this.apiKey;
    }

    const response = await fetch(this.endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: options.model,
        prompt: options.prompt,
        negativePrompt: options.negativePrompt,
        width: options.width,
        height: options.height,
        aspectRatio: options.aspectRatio,
        steps: options.steps,
        cfgScale: options.cfgScale,
        seed: options.seed,
      }),
    });

    if (!response.ok) {
      const error: StabilityGenerateApiError = await response.json();
      throw new StabilityGenerateError(response.status, error.detail);
    }

    return response.blob();
  }

  /**
   * Generate an image and return as data URL
   * @param options - Generation options
   * @returns Generated image as data URL string
   */
  async generateToDataUrl(options: StabilityGenerateOptions): Promise<string> {
    const blob = await this.generate(options);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}

export default StabilityGenerateClient;
