// Settings types and constants
// Storage is handled by atomWithStorage in store.ts

export type UpscaleProvider = "ai3" | "stability";

export interface UpscaleProviderConfig {
  id: UpscaleProvider;
  enabled: boolean;
}

export const UPSCALE_PROVIDER_INFO: Record<
  UpscaleProvider,
  { name: string; description: string }
> = {
  ai3: {
    name: "AI3 Daemon",
    description: "Local upscaling server with 2x and 4x support",
  },
  stability: {
    name: "Stability AI",
    description: "Cloud-based 4x upscaling via Stability AI API",
  },
};

export type CaptionModelProvider = "ai3" | "openrouter";

export interface CaptionModelConfig {
  id: CaptionModelId;
  enabled: boolean;
}

export interface CaptionModelInfo {
  name: string;
  description: string;
  provider: CaptionModelProvider;
}

export const CAPTION_MODEL_INFO = {
  // Local models
  blip2: {
    name: "BLIP-2",
    description: "Fast local captioning (~4GB VRAM)",
    provider: "ai3",
  } as CaptionModelInfo,
  "florence2-base": {
    name: "Florence-2 Base",
    description: "Quality local captioning (~4GB VRAM)",
    provider: "ai3",
  } as CaptionModelInfo,
  "florence2-large": {
    name: "Florence-2 Large",
    description: "Best local captioning (~6GB VRAM)",
    provider: "ai3",
  } as CaptionModelInfo,
  // Cloud models
  "openai/gpt-5-nano": {
    name: "OpenAI: GPT-5 Nano",
    description: "Tiny yet powerful model by GPT",
    provider: "openrouter",
  } as CaptionModelInfo,
};

// Caption model types
export type CaptionModelId = keyof typeof CAPTION_MODEL_INFO;

// Get OpenRouter model IDs for validation
export const OPENROUTER_MODEL_IDS = Object.entries(CAPTION_MODEL_INFO)
  .filter(([, info]) => info.provider === "openrouter")
  .map(([id]) => id);

// Default caption model priority (ordered by preference)
export const DEFAULT_CAPTION_MODEL_PRIORITY = Object.entries(CAPTION_MODEL_INFO)
  .sort((a, b) => priority(b[1].provider) - priority(a[1].provider))
  .map((it) => it[0]);

function priority<T extends "ai3">(provider: T | string) {
  if (provider === "ai3") return 1;
  return 0;
}

export interface Settings {
  upscaleProviders: UpscaleProviderConfig[];
  upscaleServerUrl: string;
  allowDeletions: boolean;
  profileName: string;
  profileEmail: string;
  // Caption model priority (ordered list of model IDs)
  captionModelPriority: CaptionModelId[];
}

// Meta object types (synced to Convex)
export type MetaObjectType = "string" | "number";

export interface MetaObject {
  _id: string;
  name: string;
  type: MetaObjectType;
  active: boolean;
  required: boolean;
  order: number;
}
