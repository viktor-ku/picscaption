// Jotai atoms for global state management
import { atom, getDefaultStore } from "jotai";
import { atomWithImmer } from "jotai-immer";
import { atomWithStorage } from "jotai/utils";
import type {
  ImageData,
  SaveStatus,
  PendingDeletion,
  PendingCrop,
  BulkUpscaleProgress,
} from "../types";
import type { Settings, UpscaleProviderConfig } from "./settings";

// Default settings for atomWithStorage
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

// ============================================================================
// Core Atoms
// ============================================================================

/** Array of images with Immer for easy mutations */
export const imagesAtom = atomWithImmer<ImageData[]>([]);

/** Currently selected image ID */
export const selectedImageIdAtom = atom<string | null>(null);

/** Current directory path */
export const currentDirectoryAtom = atom<string | null>(null);

/** Error message to display */
export const errorMessageAtom = atom<string | null>(null);

/** Save status indicator */
export const saveStatusAtom = atom<SaveStatus>(null);

/** Whether crop mode is active */
export const isCroppingAtom = atom(false);

// ============================================================================
// Settings (with localStorage persistence)
// ============================================================================

/** Settings with automatic localStorage sync */
export const settingsAtom = atomWithStorage<Settings>(
  "picscaption-settings",
  DEFAULT_SETTINGS,
  undefined,
  { getOnInit: true },
);

// ============================================================================
// Pending State Atoms (for undo operations)
// ============================================================================

/** Pending deletion for undo */
export const pendingDeletionAtom = atom<PendingDeletion | null>(null);

/** Pending crop for undo */
export const pendingCropAtom = atom<PendingCrop | null>(null);

// ============================================================================
// UI State Atoms
// ============================================================================

/** Bulk upscale progress */
export const bulkUpscaleProgressAtom = atom<BulkUpscaleProgress | null>(null);

// ============================================================================
// Derived Atoms (computed from other atoms)
// ============================================================================

/** Current index of selected image in the array */
export const currentIndexAtom = atom((get) => {
  const images = get(imagesAtom);
  const selectedId = get(selectedImageIdAtom);
  if (!selectedId) return -1;
  return images.findIndex((img) => img.id === selectedId);
});

/** Currently selected image object */
export const selectedImageAtom = atom((get) => {
  const images = get(imagesAtom);
  const index = get(currentIndexAtom);
  return index >= 0 ? images[index] : null;
});

/** Count of images with non-empty captions */
export const captionedCountAtom = atom((get) => {
  const images = get(imagesAtom);
  return images.filter((img) => img.caption.trim() !== "").length;
});

// ============================================================================
// Store Export (for outside-React access)
// ============================================================================

/** Default store for accessing atoms outside React components */
export const store = getDefaultStore();
