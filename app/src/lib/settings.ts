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

export interface Settings {
  upscaleProviders: UpscaleProviderConfig[];
  upscaleServerUrl: string;
  stabilityApiKey: string;
  allowDeletions: boolean;
  profileName: string;
  profileEmail: string;
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
