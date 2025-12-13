import { useRef, useCallback, useEffect } from "react";
import { useMutation } from "convex/react";
import type { ImageData } from "../types";
import { generateThumbnailsBatch } from "../lib/thumbnail";
import { isImageFile, supportsDirectoryPicker } from "../lib/image-utils";
import { useUser } from "./useUser";
import {
  readSidecar,
  writeSidecar,
  generateUUID,
  createSidecarData,
  type SidecarData,
} from "../lib/image-identity";
import { computeDHash } from "../lib/perceptual-hash";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import {
  saveDirectoryHandle,
  loadDirectoryHandle,
  requestStoredHandlePermission,
} from "../lib/directory-storage";

interface UseFileHandlingOptions {
  images: ImageData[];
  setImages: (fn: ImageData[] | ((draft: ImageData[]) => void)) => void;
  setSelectedImageId: (id: string | null) => void;
  setCurrentDirectory: (dir: string | null) => void;
  setErrorMessage: (msg: string | null) => void;
}

export function useFileHandling({
  images,
  setImages,
  setSelectedImageId,
  setCurrentDirectory,
  setErrorMessage,
}: UseFileHandlingOptions) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const directoryHandleRef = useRef<FileSystemDirectoryHandle | null>(null);
  const { ensureUser, isAvailable: isConvexAvailable } = useUser();
  const upsertImage = useMutation(api.images.upsert);

  const finalizeImages = useCallback(
    (newImages: ImageData[], directoryName: string) => {
      setCurrentDirectory(directoryName);
      // Direct set with new array
      setImages(newImages);
      setSelectedImageId(newImages[0]?.id ?? null);
      setErrorMessage(null);

      // Batch thumbnail updates to reduce state updates
      const batch: {
        pending: Map<string, string>;
        timeout: ReturnType<typeof setTimeout> | null;
      } = {
        pending: new Map(),
        timeout: null,
      };

      const flushThumbnails = () => {
        batch.timeout = null;
        if (batch.pending.size === 0) return;
        const updates = batch.pending;
        batch.pending = new Map();
        setImages((draft) => {
          for (const [imageId, thumbnailUrl] of updates) {
            const idx = draft.findIndex((i) => i.id === imageId);
            if (idx !== -1) draft[idx].thumbnailUrl = thumbnailUrl;
          }
        });
      };

      const files = newImages.map((img) => img.file);
      generateThumbnailsBatch(
        files,
        (index, thumbnailUrl) => {
          const imageId = newImages[index]?.id;
          if (!imageId) return;
          batch.pending.set(imageId, thumbnailUrl);
          if (batch.timeout) clearTimeout(batch.timeout);
          batch.timeout = setTimeout(flushThumbnails, 0);
        },
        (index, error) => {
          console.error(
            `Failed to generate thumbnail for ${newImages[index]?.fileName}:`,
            error,
          );
        },
      );
    },
    [setCurrentDirectory, setImages, setSelectedImageId, setErrorMessage],
  );

  const processFiles = useCallback(
    async (files: File[], directoryName: string) => {
      // Ensure user exists before processing (creates anonymous user on first upload)
      // Must await to get the actual userId, not rely on stale state
      const actualUserId = await ensureUser();

      // Cleanup old URLs
      for (const img of images) {
        if (img.thumbnailUrl) URL.revokeObjectURL(img.thumbnailUrl);
        if (img.fullImageUrl) URL.revokeObjectURL(img.fullImageUrl);
      }

      const imageFiles = files.filter(isImageFile);

      if (imageFiles.length === 0) {
        // Still set the directory even with no images (for generation use case)
        setImages([]);
        setSelectedImageId(null);
        setCurrentDirectory(directoryName);
        // Don't show error - empty folder is valid for generating images into
        setErrorMessage(null);
        return;
      }

      imageFiles.sort((a, b) =>
        a.name.localeCompare(b.name, undefined, {
          numeric: true,
          sensitivity: "base",
        }),
      );

      // Create images immediately with temporary UUIDs - show UI fast
      const newImages: ImageData[] = imageFiles.map((file, index) => ({
        id: `${index}-${file.name}`,
        uuid: generateUUID(), // Temporary, will be replaced from sidecar if exists
        file,
        thumbnailUrl: null,
        fullImageUrl: null,
        fileName: file.name,
        namespace: directoryName,
        caption: "",
        tags: [],
      }));

      // Show images in UI immediately
      finalizeImages(newImages, directoryName);

      // Process sidecars in background (don't block UI)
      const dirHandle = directoryHandleRef.current;
      if (dirHandle) {
        processSidecarsInBackground(
          dirHandle,
          newImages,
          setImages,
          isConvexAvailable && actualUserId
            ? { upsertImage, userId: actualUserId }
            : null,
        );
      }
    },
    [
      images,
      finalizeImages,
      setImages,
      setSelectedImageId,
      setCurrentDirectory,
      setErrorMessage,
      isConvexAvailable,
      ensureUser,
      upsertImage,
    ],
  );

  const handleSelectFolderModern = useCallback(async () => {
    try {
      const dirHandle = await window.showDirectoryPicker();
      const files: File[] = [];
      for await (const entry of dirHandle.values()) {
        if (entry.kind === "file") {
          const file = await (entry as FileSystemFileHandle).getFile();
          files.push(file);
        }
      }
      directoryHandleRef.current = dirHandle;

      // Persist the directory handle for next session
      saveDirectoryHandle(dirHandle).catch((err) =>
        console.warn("Failed to save directory handle:", err),
      );

      type FileWithPath = File & { path?: string };
      const firstFileWithPathIdx = files.findIndex(
        (f) => (f as FileWithPath).path,
      );
      const firstFileWithPath =
        firstFileWithPathIdx !== -1 ? files[firstFileWithPathIdx] : undefined;
      let directoryPath = dirHandle.name;
      if (firstFileWithPath) {
        const fullPath = (firstFileWithPath as FileWithPath).path;
        if (fullPath) {
          const lastSep = Math.max(
            fullPath.lastIndexOf("/"),
            fullPath.lastIndexOf("\\"),
          );
          if (lastSep > 0) directoryPath = fullPath.substring(0, lastSep);
        }
      }
      await processFiles(files, directoryPath);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        console.error("Failed to open directory:", err);
        setErrorMessage("Failed to open directory");
      }
    }
  }, [processFiles, setErrorMessage]);

  const handleSelectFolderLegacy = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleSelectFolder = useCallback(() => {
    if (supportsDirectoryPicker()) {
      handleSelectFolderModern();
    } else {
      handleSelectFolderLegacy();
    }
  }, [handleSelectFolderModern, handleSelectFolderLegacy]);

  const handleFolderChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files || files.length === 0) return;

      type FileWithPath = File & { webkitRelativePath?: string };
      const dirPaths = Array.from(files).map((file) => {
        const relativePath = (file as FileWithPath).webkitRelativePath || "";
        return relativePath.split("/").slice(0, -1);
      });

      let commonParts: string[] = dirPaths[0] || [];
      for (const parts of dirPaths.slice(1)) {
        const newCommon: string[] = [];
        for (let i = 0; i < Math.min(commonParts.length, parts.length); i++) {
          if (commonParts[i] === parts[i]) newCommon.push(commonParts[i]);
          else break;
        }
        commonParts = newCommon;
      }

      directoryHandleRef.current = null;
      await processFiles(Array.from(files), commonParts.join("/") || "unknown");
      event.target.value = "";
    },
    [processFiles],
  );

  // Restore directory from previous session (requires user gesture to request permission)
  const restoreDirectory = useCallback(async (): Promise<boolean> => {
    const handle = await requestStoredHandlePermission();
    if (!handle) return false;

    try {
      const files: File[] = [];
      for await (const entry of handle.values()) {
        if (entry.kind === "file") {
          const file = await (entry as FileSystemFileHandle).getFile();
          files.push(file);
        }
      }
      directoryHandleRef.current = handle;
      await processFiles(files, handle.name);
      return true;
    } catch (err) {
      console.error("Failed to restore directory:", err);
      return false;
    }
  }, [processFiles]);

  // Check if there's a stored directory handle (for UI to show restore option)
  const checkStoredDirectory = useCallback(async (): Promise<string | null> => {
    const handle = await loadDirectoryHandle();
    return handle?.name ?? null;
  }, []);

  // Select a folder for saving only (don't load images from it, don't persist for "Continue with")
  const handleSelectSaveFolder = useCallback(async (): Promise<boolean> => {
    if (!supportsDirectoryPicker()) {
      setErrorMessage("Directory picker not supported in this browser");
      return false;
    }

    try {
      const dirHandle = await window.showDirectoryPicker();
      directoryHandleRef.current = dirHandle;
      setCurrentDirectory(dirHandle.name);

      // Note: We intentionally do NOT save to IndexedDB here.
      // This folder is only for saving generated images, not for "Continue with" restore.
      // Only folders opened via handleSelectFolder should be persisted.

      return true;
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        console.error("Failed to select save directory:", err);
        setErrorMessage("Failed to select directory");
      }
      return false;
    }
  }, [setCurrentDirectory, setErrorMessage]);

  return {
    fileInputRef,
    directoryHandleRef,
    finalizeImages,
    processFiles,
    handleSelectFolder,
    handleSelectSaveFolder,
    handleFolderChange,
    restoreDirectory,
    checkStoredDirectory,
  };
}

interface ConvexContext {
  upsertImage: (args: {
    uuid: string;
    filename: string;
    pHash: string;
    caption: string;
    tags: string[];
    createdAt: string;
    updatedAt: string;
    userId: Id<"users">;
  }) => Promise<Id<"images">>;
  userId: Id<"users">;
}

/**
 * Process sidecars in background - reads existing sidecars and creates new ones.
 * Updates image state with UUIDs, captions, and tags from sidecars.
 * Syncs to Convex if available.
 */
async function processSidecarsInBackground(
  dirHandle: FileSystemDirectoryHandle,
  images: ImageData[],
  setImages: (fn: (draft: ImageData[]) => void) => void,
  convex: ConvexContext | null,
) {
  // Batch updates to reduce state changes
  const updates: Map<
    string,
    { uuid?: string; caption?: string; tags?: string[] }
  > = new Map();
  let hasUpdates = false;

  // Process all sidecars in parallel
  await Promise.all(
    images.map(async (img) => {
      try {
        const sidecar = await readSidecar(dirHandle, img.fileName);
        if (sidecar) {
          // Sidecar exists - use its UUID, caption, and tags
          const tagsChanged =
            JSON.stringify(sidecar.tags ?? []) !== JSON.stringify(img.tags);
          if (
            sidecar.uuid !== img.uuid ||
            sidecar.caption !== img.caption ||
            tagsChanged
          ) {
            updates.set(img.id, {
              uuid: sidecar.uuid,
              caption: sidecar.caption,
              tags: sidecar.tags ?? [],
            });
            hasUpdates = true;
          }
          // Sync existing sidecar to Convex
          if (convex) {
            syncToConvex(convex, sidecar, img.fileName);
          }
        } else {
          // No sidecar - compute pHash and create one
          try {
            const pHash = await computeDHash(img.file);
            const sidecarData = createSidecarData(
              img.uuid,
              pHash,
              img.caption,
              img.tags,
            );
            await writeSidecar(dirHandle, img.fileName, sidecarData);
            // Sync new sidecar to Convex
            if (convex) {
              syncToConvex(convex, sidecarData, img.fileName);
            }
          } catch (err) {
            console.error(`Failed to create sidecar for ${img.fileName}:`, err);
          }
        }
      } catch (err) {
        console.error(`Error processing sidecar for ${img.fileName}:`, err);
      }
    }),
  );

  // Apply all updates in a single state change
  if (hasUpdates) {
    setImages((draft) => {
      for (const [id, update] of updates) {
        const idx = draft.findIndex((i) => i.id === id);
        if (idx !== -1) {
          if (update.uuid) draft[idx].uuid = update.uuid;
          if (update.caption !== undefined) draft[idx].caption = update.caption;
          if (update.tags) draft[idx].tags = update.tags;
        }
      }
    });
  }
}

/**
 * Sync sidecar data to Convex (fire-and-forget).
 */
function syncToConvex(
  convex: ConvexContext,
  sidecar: SidecarData,
  filename: string,
) {
  convex
    .upsertImage({
      uuid: sidecar.uuid,
      filename,
      pHash: sidecar.pHash,
      caption: sidecar.caption,
      tags: sidecar.tags,
      createdAt: sidecar.createdAt,
      updatedAt: sidecar.updatedAt,
      userId: convex.userId,
    })
    .catch((err) => console.error("Failed to sync to Convex:", err));
}
