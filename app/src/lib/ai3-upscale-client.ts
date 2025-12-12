/**
 * AI Image Upscaler & Generator Client
 *
 * TypeScript client for the ai-server API.
 *
 * @example
 * ```ts
 * import { AIClient, canUpscale, canGenerate } from './ai3-upscale-client';
 *
 * const client = new AIClient('http://localhost:3001');
 *
 * // Health check
 * const status = await client.ping();
 *
 * // Get available capabilities
 * const caps = await client.capabilities();
 * // {
 * //   capabilities: [
 * //     { kind: "upscale", model: "realesrgan-x2plus", scale: 2 },
 * //     { kind: "upscale", model: "realesrgan-x4plus", scale: 4 },
 * //     { kind: "image", model: "sdxl" }
 * //   ],
 * //   device: "cuda",
 * //   gpu_memory_gb: 8
 * // }
 *
 * // Check capabilities
 * if (canUpscale(caps, 4)) {
 *   const upscaled = await client.upscale(file, { scale: 4 });
 * }
 *
 * if (canGenerate(caps, "sdxl")) {
 *   const generated = await client.generate({ prompt: "a beautiful sunset" });
 * }
 * ```
 */

/** Upscaling options */
export interface UpscaleOptions {
  /** Upscaling factor: 2 or 4 (default: 4) */
  scale?: 2 | 4;
  /** Text prompt to guide upscaling */
  prompt?: string;
  /** Things to avoid in output (default: "blurry, low quality, artifacts, noise") */
  negativePrompt?: string;
  /** Random seed, 0 = random (default: 0) */
  seed?: number;
  /** Number of denoising steps, 1-100 (default: 20) */
  steps?: number;
  /** Guidance scale, 0-20 (default: 7.5) */
  guidance?: number;
}

/** Image generation options */
export interface GenerateOptions {
  /** Text prompt for generation */
  prompt: string;
  /** Things to avoid in output */
  negativePrompt?: string;
  /** Image width (default: 1024) */
  width?: number;
  /** Image height (default: 1024) */
  height?: number;
  /** Random seed, 0 = random (default: 0) */
  seed?: number;
  /** Number of inference steps, 1-100 (default: 30) */
  steps?: number;
  /** Guidance scale, 0-20 (default: 7.5) */
  guidance?: number;
  /** Model to use (default: "sdxl") */
  model?: "sdxl" | "flux";
}

/** Ping response */
export interface PingResponse {
  status: string;
}

/** Upscale capability record */
export interface UpscaleCapability {
  kind: "upscale";
  model: string;
  scale: 2 | 4;
}

/** Image generation capability record */
export interface ImageCapability {
  kind: "image";
  model: string;
}

/** Union of all capability types */
export type Capability = UpscaleCapability | ImageCapability;

/** Capabilities response */
export interface CapabilitiesResponse {
  /** List of available capabilities */
  capabilities: Capability[];
  /** Compute device being used */
  device: "cuda" | "cpu";
  /** Detected GPU memory in GB (0 for CPU mode) */
  gpu_memory_gb: number;
}

/** API error response */
export interface ApiError {
  detail: string;
}

/** Error thrown when API request fails */
export class UpscaleApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly detail: string,
  ) {
    super(`API error ${status}: ${detail}`);
    this.name = "UpscaleApiError";
  }
}

/**
 * Client for the AI Image Server
 */
export class UpscaleClient {
  private readonly baseUrl: string;

  /**
   * Create a new client
   * @param baseUrl - Base URL of the server (e.g., "http://localhost:3001")
   */
  constructor(baseUrl: string = "http://localhost:3001") {
    // Remove trailing slash
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  /**
   * Health check - verify the server is running
   * @returns Ping response with status
   */
  async ping(): Promise<PingResponse> {
    const response = await fetch(`${this.baseUrl}/api/ping`);

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new UpscaleApiError(response.status, error.detail);
    }

    return response.json();
  }

  /**
   * Get available capabilities based on GPU memory
   * @returns Available features and device info
   */
  async capabilities(): Promise<CapabilitiesResponse> {
    const response = await fetch(`${this.baseUrl}/api/capabilities`);

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new UpscaleApiError(response.status, error.detail);
    }

    return response.json();
  }

  /**
   * Upscale an image
   * @param image - Image file or Blob to upscale
   * @param options - Upscaling options
   * @returns Upscaled image as Blob
   */
  async upscale(
    image: File | Blob,
    options: UpscaleOptions = {},
  ): Promise<Blob> {
    const formData = new FormData();

    // Add image
    if (image instanceof File) {
      formData.append("image", image);
    } else {
      formData.append("image", image, "image.png");
    }

    // Add optional parameters to form data
    if (options.scale !== undefined) {
      formData.append("scale", options.scale.toString());
    }
    if (options.prompt !== undefined) {
      formData.append("prompt", options.prompt);
    }
    if (options.negativePrompt !== undefined) {
      formData.append("negative_prompt", options.negativePrompt);
    }
    if (options.seed !== undefined) {
      formData.append("seed", options.seed.toString());
    }
    if (options.steps !== undefined) {
      formData.append("steps", options.steps.toString());
    }
    if (options.guidance !== undefined) {
      formData.append("guidance", options.guidance.toString());
    }

    console.log("[UpscaleClient] Upscaling with scale:", options.scale);

    const response = await fetch(`${this.baseUrl}/api/upscale`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new UpscaleApiError(response.status, error.detail);
    }

    return response.blob();
  }

  /**
   * Generate an image from a text prompt
   * @param options - Generation options including prompt
   * @returns Generated image as Blob
   */
  async generate(options: GenerateOptions): Promise<Blob> {
    const response = await fetch(`${this.baseUrl}/api/image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: options.prompt,
        negative_prompt: options.negativePrompt,
        width: options.width,
        height: options.height,
        seed: options.seed,
        steps: options.steps,
        guidance: options.guidance,
        model: options.model,
      }),
    });

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new UpscaleApiError(response.status, error.detail);
    }

    return response.blob();
  }

  /**
   * Generate an image and return as data URL
   * @param options - Generation options including prompt
   * @returns Generated image as data URL string
   */
  async generateToDataUrl(options: GenerateOptions): Promise<string> {
    const blob = await this.generate(options);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Upscale an image from a URL
   * @param url - URL of the image to upscale
   * @param options - Upscaling options
   * @returns Upscaled image as Blob
   */
  async upscaleFromUrl(
    url: string,
    options: UpscaleOptions = {},
  ): Promise<Blob> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image from ${url}: ${response.status}`);
    }
    const blob = await response.blob();
    return this.upscale(blob, options);
  }

  /**
   * Upscale an image and return as data URL
   * @param image - Image file or Blob to upscale
   * @param options - Upscaling options
   * @returns Upscaled image as data URL string
   */
  async upscaleToDataUrl(
    image: File | Blob,
    options: UpscaleOptions = {},
  ): Promise<string> {
    const blob = await this.upscale(image, options);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}

/** @deprecated Use UpscaleClient instead */
export const AIClient = UpscaleClient;

// Helper functions for working with capabilities

/**
 * Check if a specific capability is available
 */
export function hasCapability(
  caps: CapabilitiesResponse,
  kind: "upscale",
  options: { scale: 2 | 4 },
): boolean;
export function hasCapability(
  caps: CapabilitiesResponse,
  kind: "image",
  options: { model: string },
): boolean;
export function hasCapability(
  caps: CapabilitiesResponse,
  kind: string,
  options: Record<string, unknown>,
): boolean {
  return caps.capabilities.some(
    (cap) =>
      cap.kind === kind &&
      Object.entries(options).every(
        ([k, v]) => (cap as unknown as Record<string, unknown>)[k] === v,
      ),
  );
}

/**
 * Get all upscale capabilities
 */
export function getUpscaleCapabilities(
  caps: CapabilitiesResponse,
): UpscaleCapability[] {
  return caps.capabilities.filter(
    (c): c is UpscaleCapability => c.kind === "upscale",
  );
}

/**
 * Get all image generation capabilities
 */
export function getImageCapabilities(
  caps: CapabilitiesResponse,
): ImageCapability[] {
  return caps.capabilities.filter(
    (c): c is ImageCapability => c.kind === "image",
  );
}

/**
 * Check if upscaling at a specific scale is available
 */
export function canUpscale(caps: CapabilitiesResponse, scale: 2 | 4): boolean {
  return hasCapability(caps, "upscale", { scale });
}

/**
 * Check if image generation with a specific model is available
 */
export function canGenerate(
  caps: CapabilitiesResponse,
  model: string,
): boolean {
  return hasCapability(caps, "image", { model });
}

export default UpscaleClient;
