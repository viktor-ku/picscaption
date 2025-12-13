import { useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import type { ImageData, SaveStatus } from "../types";
import {
  readSidecar,
  writeSidecar,
  updateSidecarData,
} from "../lib/image-identity";
import { useUser } from "./useUser";
import { api } from "../../convex/_generated/api";

const SAVE_DEBOUNCE_MS = 1000;

interface LastSavedData {
  caption: string;
  tags: string[];
}

/**
 * Hook for auto-saving captions and tags to sidecar files and Convex with debouncing.
 */
export function useAutoSave(
  images: ImageData[],
  currentDirectory: string | null,
  setSaveStatus: (status: SaveStatus) => void,
  setErrorMessage: (msg: string | null) => void,
  directoryHandleRef?: React.RefObject<FileSystemDirectoryHandle | null>,
) {
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track last saved data to only update changed ones
  const lastSavedDataRef = useRef<Map<string, LastSavedData>>(new Map());

  const { userId, isAvailable: isConvexAvailable } = useUser();
  const updateCaption = useMutation(api.images.updateCaption);
  const updateTags = useMutation(api.images.updateTags);

  useEffect(() => {
    if (images.length === 0 || !currentDirectory) return;

    const dirHandle = directoryHandleRef?.current;

    // Only save if there's something meaningful to save
    const hasContent = images.some(
      (img) => img.caption.trim() || img.tags.length > 0,
    );
    if (!hasContent) return;

    // Clear previous timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        // Helper to compare tags arrays
        const tagsEqual = (a: string[], b: string[]) =>
          a.length === b.length && a.every((tag, i) => tag === b[i]);

        // Check for caption or tag changes
        const changedImages = images.filter((img) => {
          const lastSaved = lastSavedDataRef.current.get(img.uuid);
          if (!lastSaved) return img.caption.trim() || img.tags.length > 0;
          return (
            lastSaved.caption !== img.caption ||
            !tagsEqual(lastSaved.tags, img.tags)
          );
        });

        // No changes to save
        if (changedImages.length === 0) return;

        // Now we know there are changes - show saving status
        setSaveStatus("saving");

        const updatePromises: Promise<void>[] = [];

        for (const img of changedImages) {
          const lastSaved = lastSavedDataRef.current.get(img.uuid);
          const captionChanged =
            !lastSaved || lastSaved.caption !== img.caption;
          const tagsChanged =
            !lastSaved || !tagsEqual(lastSaved.tags, img.tags);

          // Update sidecar if we have a directory handle
          if (dirHandle && (captionChanged || tagsChanged)) {
            updatePromises.push(
              (async () => {
                try {
                  const existing = await readSidecar(dirHandle, img.fileName);
                  if (existing) {
                    const updates: { caption?: string; tags?: string[] } = {};
                    if (captionChanged) updates.caption = img.caption;
                    if (tagsChanged) updates.tags = img.tags;
                    const updated = updateSidecarData(existing, updates);
                    await writeSidecar(dirHandle, img.fileName, updated);
                  }
                } catch (err) {
                  console.error(
                    `Failed to update sidecar for ${img.fileName}:`,
                    err,
                  );
                }
              })(),
            );
          }

          // Sync to Convex if available
          if (isConvexAvailable && userId) {
            if (captionChanged) {
              updatePromises.push(
                updateCaption({
                  uuid: img.uuid,
                  caption: img.caption,
                  userId,
                })
                  .then(() => {})
                  .catch((err) =>
                    console.error(
                      `Failed to sync caption to Convex for ${img.fileName}:`,
                      err,
                    ),
                  ),
              );
            }
            if (tagsChanged) {
              updatePromises.push(
                updateTags({
                  uuid: img.uuid,
                  tags: img.tags,
                  userId,
                })
                  .then(() => {})
                  .catch((err) =>
                    console.error(
                      `Failed to sync tags to Convex for ${img.fileName}:`,
                      err,
                    ),
                  ),
              );
            }
          }

          lastSavedDataRef.current.set(img.uuid, {
            caption: img.caption,
            tags: [...img.tags],
          });
        }

        await Promise.all(updatePromises);
        setSaveStatus("saved");

        // Auto-clear "saved" status after 2 seconds
        setTimeout(() => setSaveStatus(null), 2000);
      } catch (err) {
        console.error("Failed to save:", err);
        setErrorMessage("Failed to save");
        setSaveStatus(null);
      }
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [
    images,
    currentDirectory,
    setSaveStatus,
    setErrorMessage,
    directoryHandleRef,
    isConvexAvailable,
    userId,
    updateCaption,
    updateTags,
  ]);
}
