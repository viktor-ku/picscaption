// Settings storage using localStorage

const SETTINGS_KEY = "picscaption-settings";

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

const DEFAULT_UPSCALE_PROVIDERS: UpscaleProviderConfig[] = [
  { id: "ai3", enabled: true },
  { id: "stability", enabled: false },
];

const DEFAULT_SETTINGS: Settings = {
  upscaleProviders: DEFAULT_UPSCALE_PROVIDERS,
  upscaleServerUrl: "",
  stabilityApiKey: "",
  allowDeletions: true,
  profileName: "",
  profileEmail: "",
};

export function getSettings(): Settings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);

      // Migration: convert old upscaleProvider to new upscaleProviders array
      if (parsed.upscaleProvider && !parsed.upscaleProviders) {
        const oldProvider = parsed.upscaleProvider as UpscaleProvider;
        parsed.upscaleProviders = [
          { id: oldProvider, enabled: true },
          { id: oldProvider === "ai3" ? "stability" : "ai3", enabled: false },
        ];
        delete parsed.upscaleProvider;
      }

      // Merge with defaults to handle missing keys from older versions
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (err) {
    console.error("Failed to load settings:", err);
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error("Failed to save settings:", err);
  }
}
