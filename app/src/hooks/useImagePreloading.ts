import { useEffect } from "react";
import type { ImageData } from "../types";
import { loadFullImage, unloadFullImage } from "../lib/thumbnail";

const PRELOAD_WINDOW = 1;

/**
 * Hook for sliding window preloading of full images.
 * Loads full images for selected image ± PRELOAD_WINDOW, unloads others to save memory.
 */
export function useImagePreloading(
  images: ImageData[],
  selectedImageId: string | null,
  setImages: (fn: (draft: ImageData[]) => void) => void,
) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: Intentionally minimal deps to avoid infinite loops - accesses images/setImages through closure
  useEffect(() => {
    if (images.length === 0 || !selectedImageId) return;

    const currentIdx = images.findIndex((img) => img.id === selectedImageId);
    if (currentIdx === -1) return;

    // Track pending dimension loaders so we can cancel them on cleanup
    const pendingLoaders: HTMLImageElement[] = [];
    let cancelled = false;

    // Calculate which indices should have full images loaded
    const windowStart = Math.max(0, currentIdx - PRELOAD_WINDOW);
    const windowEnd = Math.min(images.length - 1, currentIdx + PRELOAD_WINDOW);
    const indicesInWindow = new Set<number>();
    for (let i = windowStart; i <= windowEnd; i++) {
      indicesInWindow.add(i);
    }

    // Determine which images need loading and which need unloading
    const toLoad: { id: string; fullImageUrl: string }[] = [];
    const toUnload: { id: string; oldUrl: string }[] = [];
    const imagesToLoadDimensions: { id: string; url: string }[] = [];

    for (let idx = 0; idx < images.length; idx++) {
      const img = images[idx];
      const shouldBeLoaded = indicesInWindow.has(idx);
      const isLoaded = img.fullImageUrl !== null;

      if (shouldBeLoaded && !isLoaded) {
        // Load this image
        const fullImageUrl = loadFullImage(img.file);
        toLoad.push({ id: img.id, fullImageUrl });
        // Also load dimensions if not yet known
        if (img.width === undefined || img.height === undefined) {
          imagesToLoadDimensions.push({ id: img.id, url: fullImageUrl });
        }
      } else if (!shouldBeLoaded && isLoaded && img.fullImageUrl) {
        // Unload this image - revokes blob URL to free memory
        toUnload.push({ id: img.id, oldUrl: img.fullImageUrl });
      }
    }

    // Apply URL updates if any
    if (toLoad.length > 0 || toUnload.length > 0) {
      // Revoke old URLs
      for (const { oldUrl } of toUnload) {
        unloadFullImage(oldUrl);
      }

      setImages((draft) => {
        for (const { id, fullImageUrl } of toLoad) {
          const idx = draft.findIndex((i) => i.id === id);
          if (idx !== -1) draft[idx].fullImageUrl = fullImageUrl;
        }
        for (const { id } of toUnload) {
          const idx = draft.findIndex((i) => i.id === id);
          if (idx !== -1) draft[idx].fullImageUrl = null;
        }
      });
    }

    // Load dimensions asynchronously for newly loaded images
    for (const { id, url } of imagesToLoadDimensions) {
      const imgElement = new Image();
      pendingLoaders.push(imgElement);
      imgElement.onload = () => {
        // Skip if effect was cleaned up (user switched away)
        if (cancelled) return;
        setImages((draft) => {
          const idx = draft.findIndex((i) => i.id === id);
          if (idx !== -1) {
            draft[idx].width = imgElement.naturalWidth;
            draft[idx].height = imgElement.naturalHeight;
          }
        });
      };
      imgElement.src = url;
    }

    // Cleanup: cancel pending dimension loads when switching away
    return () => {
      cancelled = true;
      for (const loader of pendingLoaders) {
        loader.src = ""; // Cancel any pending load/decode
      }
    };
  }, [selectedImageId, images.length]);
}
