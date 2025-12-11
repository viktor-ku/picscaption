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

/**
 * Hook for auto-saving captions to sidecar files and Convex with debouncing.
 */
export function useAutoSave(
  images: ImageData[],
  currentDirectory: string | null,
  setSaveStatus: (status: SaveStatus) => void,
  setErrorMessage: (msg: string | null) => void,
  directoryHandleRef?: React.RefObject<FileSystemDirectoryHandle | null>,
) {
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track last saved captions to only update changed ones
  const lastSavedCaptionsRef = useRef<Map<string, string>>(new Map());

  const { userId, isAvailable: isConvexAvailable } = useUser();
  const updateCaption = useMutation(api.images.updateCaption);

  useEffect(() => {
    if (images.length === 0 || !currentDirectory) return;

    const dirHandle = directoryHandleRef?.current;

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
        const updatePromises: Promise<void>[] = [];

        for (const img of images) {
          const lastCaption = lastSavedCaptionsRef.current.get(img.uuid);
          if (lastCaption !== img.caption) {
            // Caption changed - update sidecar if we have a directory handle
            if (dirHandle) {
              updatePromises.push(
                (async () => {
                  try {
                    const existing = await readSidecar(dirHandle, img.fileName);
                    if (existing) {
                      const updated = updateSidecarData(existing, {
                        caption: img.caption,
                      });
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

            // Also sync to Convex if available
            if (isConvexAvailable && userId) {
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

            lastSavedCaptionsRef.current.set(img.uuid, img.caption);
          }
        }

        await Promise.all(updatePromises);
        setSaveStatus("saved");

        // Auto-clear "saved" status after 2 seconds
        setTimeout(() => setSaveStatus(null), 2000);
      } catch (err) {
        console.error("Failed to save captions:", err);
        setErrorMessage("Failed to save captions");
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
  ]);
}
