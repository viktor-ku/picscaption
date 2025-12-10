import { useRef, useCallback } from "react";
import type { ImageData, PendingRestoreData } from "../types";
import {
  getCaptionsByDirectory,
  deleteCaptions,
  makeKey,
} from "../lib/storage";
import { generateThumbnailsBatch } from "../lib/thumbnail";
import {
  isImageFile,
  hasImageExtension,
  supportsDirectoryPicker,
} from "../lib/image-utils";

interface UseFileHandlingOptions {
  images: ImageData[];
  setImages: (fn: ImageData[] | ((draft: ImageData[]) => void)) => void;
  setSelectedImageId: (id: string | null) => void;
  setCurrentDirectory: (dir: string | null) => void;
  setErrorMessage: (msg: string | null) => void;
  setPendingRestore: (data: PendingRestoreData | null) => void;
}

export function useFileHandling({
  images,
  setImages,
  setSelectedImageId,
  setCurrentDirectory,
  setErrorMessage,
  setPendingRestore,
}: UseFileHandlingOptions) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const directoryHandleRef = useRef<FileSystemDirectoryHandle | null>(null);

  const finalizeImages = useCallback(
    (newImages: ImageData[], directoryName: string) => {
      setCurrentDirectory(directoryName);
      // Direct set with new array
      setImages(newImages);
      setSelectedImageId(newImages[0]?.id ?? null);
      setErrorMessage(null);

      // Batch thumbnail updates to reduce state updates
      // Use object to hold mutable state that persists across callbacks
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
            const item = draft.find((i) => i.id === imageId);
            if (item) item.thumbnailUrl = thumbnailUrl;
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
          // Debounce flush - coalesces rapid updates into single state update
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
      for (const img of images) {
        if (img.thumbnailUrl) URL.revokeObjectURL(img.thumbnailUrl);
        if (img.fullImageUrl) URL.revokeObjectURL(img.fullImageUrl);
      }

      const imageFiles = files.filter(isImageFile);
      const zeroByteImageFiles = files.filter(
        (file) => file.size === 0 && hasImageExtension(file),
      );

      if (imageFiles.length === 0) {
        setImages([]);
        setSelectedImageId(null);
        setCurrentDirectory(null);
        setErrorMessage("No images found in this folder");
        return;
      }

      imageFiles.sort((a, b) =>
        a.name.localeCompare(b.name, undefined, {
          numeric: true,
          sensitivity: "base",
        }),
      );

      const newImages: ImageData[] = imageFiles.map((file, index) => ({
        id: `${index}-${file.name}`,
        file,
        thumbnailUrl: null,
        fullImageUrl: null,
        fileName: file.name,
        namespace: directoryName,
        caption: "",
      }));

      try {
        const storedCaptions = await getCaptionsByDirectory(directoryName);

        if (zeroByteImageFiles.length > 0 && storedCaptions.size > 0) {
          const keysToDelete = zeroByteImageFiles
            .filter((file) => storedCaptions.has(file.name))
            .map((file) => makeKey(directoryName, file.name));

          if (keysToDelete.length > 0) {
            await deleteCaptions(keysToDelete);
            for (const file of zeroByteImageFiles) {
              storedCaptions.delete(file.name);
            }
          }
        }

        if (storedCaptions.size > 0) {
          const matchedCount = newImages.filter((img) =>
            storedCaptions.has(img.fileName),
          ).length;

          if (matchedCount > 0) {
            setPendingRestore({
              images: newImages,
              directory: directoryName,
              storedCaptions,
              matchedCount,
            });
            return;
          }
        }
      } catch (err) {
        console.error("Failed to check IndexedDB:", err);
      }

      finalizeImages(newImages, directoryName);
    },
    [
      images,
      finalizeImages,
      setImages,
      setSelectedImageId,
      setCurrentDirectory,
      setErrorMessage,
      setPendingRestore,
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

      type FileWithPath = File & { path?: string };
      const firstFileWithPath = files.find((f) => (f as FileWithPath).path);
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

  return {
    fileInputRef,
    directoryHandleRef,
    finalizeImages,
    processFiles,
    handleSelectFolder,
    handleFolderChange,
  };
}
