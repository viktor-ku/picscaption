/**
 * Unified Model Registry for Multi-Model Generation
 *
 * Combines Stability AI and local (ai3) models into a single registry
 * with prefixed IDs for easy identification and routing.
 */

import type { StabilityModel } from "./stability-generate-client";
import type { LocalGenerateModel } from "./ai3-upscale-client";

/** Provider types for generation */
export type GenerateProvider = "stability" | "local";

/** Prefixed model ID format: "provider:model" */
export type GenerateModelId =
  // Stability models
  | "stability:sdxl-1.0"
  | "stability:sd3.5-large"
  | "stability:sd3.5-large-turbo"
  | "stability:sd3.5-medium"
  | "stability:sd3.5-flash"
  | "stability:ultra"
  // Local models
  | "local:sdxl"
  | "local:flux"
  | "local:flux2"
  | "local:zimage-turbo";

/** Unified model info structure */
export interface GenerateModelInfo {
  id: GenerateModelId;
  provider: GenerateProvider;
  /** The raw model ID to pass to the API (without provider prefix) */
  apiModelId: string;
  name: string;
  description: string;
  supportsNegativePrompt: boolean;
  supportsDimensions: boolean;
  supportsAspectRatio: boolean;
  supportsGuidance: boolean;
  defaultSteps: number;
}

/** All available generation models */
export const GENERATE_MODELS: GenerateModelInfo[] = [
  // Stability AI models
  {
    id: "stability:sdxl-1.0",
    provider: "stability",
    apiModelId: "sdxl-1.0",
    name: "SDXL 1.0",
    description: "Stable Diffusion XL 1.0 - high quality, configurable",
    supportsNegativePrompt: true,
    supportsDimensions: true,
    supportsAspectRatio: false,
    supportsGuidance: true,
    defaultSteps: 30,
  },
  {
    id: "stability:sd3.5-large",
    provider: "stability",
    apiModelId: "sd3.5-large",
    name: "SD 3.5 Large",
    description: "Stable Diffusion 3.5 Large - best quality",
    supportsNegativePrompt: true,
    supportsDimensions: false,
    supportsAspectRatio: true,
    supportsGuidance: true,
    defaultSteps: 30,
  },
  {
    id: "stability:sd3.5-large-turbo",
    provider: "stability",
    apiModelId: "sd3.5-large-turbo",
    name: "SD 3.5 Large Turbo",
    description: "SD 3.5 Large optimized for speed",
    supportsNegativePrompt: true,
    supportsDimensions: false,
    supportsAspectRatio: true,
    supportsGuidance: true,
    defaultSteps: 30,
  },
  {
    id: "stability:sd3.5-medium",
    provider: "stability",
    apiModelId: "sd3.5-medium",
    name: "SD 3.5 Medium",
    description: "Balanced quality and speed",
    supportsNegativePrompt: true,
    supportsDimensions: false,
    supportsAspectRatio: true,
    supportsGuidance: true,
    defaultSteps: 30,
  },
  {
    id: "stability:sd3.5-flash",
    provider: "stability",
    apiModelId: "sd3.5-flash",
    name: "SD 3.5 Flash",
    description: "Fastest SD 3.5 variant",
    supportsNegativePrompt: true,
    supportsDimensions: false,
    supportsAspectRatio: true,
    supportsGuidance: true,
    defaultSteps: 30,
  },
  {
    id: "stability:ultra",
    provider: "stability",
    apiModelId: "ultra",
    name: "Stable Image Ultra",
    description: "Latest and greatest image generation",
    supportsNegativePrompt: true,
    supportsDimensions: false,
    supportsAspectRatio: true,
    supportsGuidance: true,
    defaultSteps: 30,
  },
  // Local (ai3) models
  {
    id: "local:sdxl",
    provider: "local",
    apiModelId: "sdxl",
    name: "SDXL (Local)",
    description: "Stable Diffusion XL - high quality, configurable",
    supportsNegativePrompt: true,
    supportsDimensions: true,
    supportsAspectRatio: false,
    supportsGuidance: true,
    defaultSteps: 30,
  },
  {
    id: "local:flux",
    provider: "local",
    apiModelId: "flux",
    name: "Flux (FLUX.1-schnell)",
    description: "Fast generation, 4 steps",
    supportsNegativePrompt: false,
    supportsDimensions: true,
    supportsAspectRatio: false,
    supportsGuidance: false,
    defaultSteps: 4,
  },
  {
    id: "local:flux2",
    provider: "local",
    apiModelId: "flux2",
    name: "FLUX.2-dev (Local)",
    description: "32B parameter model, best quality",
    supportsNegativePrompt: false,
    supportsDimensions: true,
    supportsAspectRatio: false,
    supportsGuidance: true,
    defaultSteps: 28,
  },
  {
    id: "local:zimage-turbo",
    provider: "local",
    apiModelId: "zimage-turbo",
    name: "Z-Image-Turbo",
    description: "6B params, 8 steps, sub-second inference",
    supportsNegativePrompt: false,
    supportsDimensions: true,
    supportsAspectRatio: false,
    supportsGuidance: false,
    defaultSteps: 9,
  },
];

/** Parse a model ID into provider and raw model ID */
export function parseModelId(id: GenerateModelId): {
  provider: GenerateProvider;
  model: string;
} {
  const [provider, model] = id.split(":") as [GenerateProvider, string];
  return { provider, model };
}

/** Get model info by ID */
export function getModelInfo(
  id: GenerateModelId,
): GenerateModelInfo | undefined {
  return GENERATE_MODELS.find((m) => m.id === id);
}

/** Get all models for a specific provider */
export function getModelsByProvider(
  provider: GenerateProvider,
): GenerateModelInfo[] {
  return GENERATE_MODELS.filter((m) => m.provider === provider);
}

/** Get stability models */
export function getStabilityModels(): GenerateModelInfo[] {
  return getModelsByProvider("stability");
}

/** Get local models */
export function getLocalModels(): GenerateModelInfo[] {
  return getModelsByProvider("local");
}

/** Check if a model ID is a stability model */
export function isStabilityModel(id: GenerateModelId): boolean {
  return id.startsWith("stability:");
}

/** Check if a model ID is a local model */
export function isLocalModel(id: GenerateModelId): boolean {
  return id.startsWith("local:");
}

/** Convert GenerateModelId to StabilityModel (for API calls) */
export function toStabilityModel(id: GenerateModelId): StabilityModel {
  const { model } = parseModelId(id);
  return model as StabilityModel;
}

/** Convert GenerateModelId to LocalGenerateModel (for API calls) */
export function toLocalModel(id: GenerateModelId): LocalGenerateModel {
  const { model } = parseModelId(id);
  return model as LocalGenerateModel;
}

/** Multi-model generation options */
export interface MultiGenerateOptions {
  /** Array of model IDs to generate with */
  models: GenerateModelId[];
  /** Text prompt for generation */
  prompt: string;
  /** Things to avoid in output */
  negativePrompt?: string;
  /** Image width */
  width?: number;
  /** Image height */
  height?: number;
  /** Aspect ratio (for models that support it) */
  aspectRatio?: string;
  /** Random seed (0 = random) */
  seed?: number;
  /** Number of inference steps */
  steps?: number;
  /** CFG/Guidance scale */
  cfgScale?: number;
  /** Number of images to generate per model */
  repeat?: number;
}
