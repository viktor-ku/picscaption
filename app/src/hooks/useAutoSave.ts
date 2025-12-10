import { useEffect, useRef } from "react";
import type { ImageData, SaveStatus } from "../types";
import { saveCaptions, makeKey, type StoredCaption } from "../lib/storage";

const SAVE_DEBOUNCE_MS = 1000;

/**
 * Hook for auto-saving captions to IndexedDB with debouncing.
 */
export function useAutoSave(
  images: ImageData[],
  currentDirectory: string | null,
  setSaveStatus: React.Dispatch<React.SetStateAction<SaveStatus>>,
  setErrorMessage: React.Dispatch<React.SetStateAction<string | null>>,
) {
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (images.length === 0 || !currentDirectory) return;

    // Only save if there's something meaningful to save
    const hasContent = images.some((img) => img.caption.trim());
    if (!hasContent) return;

    // Clear previous timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    setSaveStatus("saving");

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const dataToSave: StoredCaption[] = images.map((img) => ({
          key: makeKey(currentDirectory, img.fileName),
          directory: currentDirectory,
          fileName: img.fileName,
          caption: img.caption,
          updatedAt: new Date().toISOString(),
        }));

        await saveCaptions(dataToSave);
        setSaveStatus("saved");

        // Auto-clear "saved" status after 2 seconds
        setTimeout(() => setSaveStatus(null), 2000);
      } catch (err) {
        console.error("Failed to save to IndexedDB:", err);
        setErrorMessage("Failed to save session data");
        setSaveStatus(null);
      }
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [images, currentDirectory, setSaveStatus, setErrorMessage]);
}
