// Settings storage using localStorage

const SETTINGS_KEY = "picscaption-settings";

export interface Settings {
  upscaleServerUrl: string;
  allowDeletions: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  upscaleServerUrl: "",
  allowDeletions: true,
};

export function getSettings(): Settings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
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
