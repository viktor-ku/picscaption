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
import { DEFAULT_CAPTION_MODEL_PRIORITY } from "./settings";

// Default settings for atomWithStorage
const DEFAULT_UPSCALE_PROVIDERS: UpscaleProviderConfig[] = [
  { id: "ai3", enabled: true },
  { id: "stability", enabled: false },
];

const DEFAULT_SETTINGS: Settings = {
  upscaleProviders: DEFAULT_UPSCALE_PROVIDERS,
  upscaleServerUrl: "",
  allowDeletions: true,
  profileName: "",
  profileEmail: "",
  captionModelPriority: DEFAULT_CAPTION_MODEL_PRIORITY,
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
// User State (with localStorage persistence)
// ============================================================================

/** User ID with automatic localStorage sync - shared across all useUser() instances */
export const userIdAtom = atomWithStorage<string | null>(
  "picscaption-user-id",
  null,
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

/** Import state: idle, importing, done, or cancelled */
export type ImportState = "idle" | "importing" | "done" | "cancelled";
export const importStateAtom = atom<ImportState>("idle");

/** Import progress (current row / total rows, with file tracking for multi-file imports) */
export interface ImportProgress {
  current: number;
  total: number;
  currentFile?: number; // 1-indexed current file being processed
  totalFiles?: number; // Total number of files to process
  currentFileName?: string; // Name of current file being processed
}
export const importProgressAtom = atom<ImportProgress | null>(null);

/** Import statistics for tracking created/updated counts and timing */
export interface ImportStats {
  created: number;
  updated: number;
  startTime: number; // Date.now() when import started
  endTime?: number; // Date.now() when import finished
  totalRows: number;
  filesProcessed?: number; // Number of files processed
  totalFiles?: number; // Total number of files
  errors: string[];
}
export const importStatsAtom = atom<ImportStats | null>(null);

/** Whether the import modal is open */
export const importModalOpenAtom = atom<boolean>(false);

/** Signal to cancel ongoing import */
export const importCancelledAtom = atom<boolean>(false);

/** Bulk caption state: idle, captioning, done, or cancelled */
export type BulkCaptionState = "idle" | "captioning" | "done" | "cancelled";
export const bulkCaptionStateAtom = atom<BulkCaptionState>("idle");

/** Bulk caption progress (current image / total images) */
export interface BulkCaptionProgress {
  current: number;
  total: number;
}
export const bulkCaptionProgressAtom = atom<BulkCaptionProgress | null>(null);

/** Bulk caption statistics for tracking success/error counts and timing */
export interface BulkCaptionStats {
  success: number;
  errors: number;
  startTime: number; // Date.now() when captioning started
  endTime?: number; // Date.now() when captioning finished
}
export const bulkCaptionStatsAtom = atom<BulkCaptionStats | null>(null);

/** Signal to cancel ongoing bulk caption */
export const bulkCaptionCancelledAtom = atom<boolean>(false);

// ============================================================================
// Multi-Model Generation State Atoms
// ============================================================================

/** Generation state: idle, generating, done, or cancelled */
export type GenerateState = "idle" | "generating" | "done" | "cancelled";
export const generateStateAtom = atom<GenerateState>("idle");

/** Generation progress (current job / total jobs) */
export interface GenerateProgress {
  current: number;
  total: number;
  currentModel: string;
}
export const generateProgressAtom = atom<GenerateProgress | null>(null);

/** Signal to cancel ongoing generation */
export const generateCancelledAtom = atom<boolean>(false);

/** Selected models for generation (persisted to localStorage) */
export const generateSelectedModelsAtom = atomWithStorage<string[]>(
  "picscaption-generate-models",
  [],
  undefined,
  { getOnInit: true },
);

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
