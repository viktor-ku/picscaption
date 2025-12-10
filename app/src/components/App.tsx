import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import toast, { Toaster } from "react-hot-toast";
import { useQuery } from "@tanstack/react-query";
import { X, Undo2 } from "lucide-react";
import {
  Header,
  Filmstrip,
  CaptionForm,
  ImagePreview,
  EmptyState,
  KeybindingsModal,
  BulkEditModal,
  BulkUpscaleModal,
  RestoreHistoryModal,
  SettingsModal,
  DeleteAllDataModal,
} from "./index";
import type { ImageData } from "../types";
import {
  getCaptionsByDirectory,
  saveCaptions,
  deleteCaptions,
  clearAllData,
  makeKey,
  type StoredCaption,
} from "../lib/storage";
import { getSettings, saveSettings, type Settings } from "../lib/settings";
import { UpscaleClient } from "../lib/ai3-upscale-client";
import pica from "pica";

// Pica instance for high-quality image resizing (Lanczos3)
const resizer = pica();

const IMAGE_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".bmp",
  ".svg",
];
const MIN_PANE_WIDTH = 280; // Minimum width in pixels for left pane
const MAX_PANE_PERCENT = 70; // Maximum percentage for left pane
const SAVE_DEBOUNCE_MS = 1000;

function hasImageExtension(file: File): boolean {
  if (file.type.startsWith("image/")) {
    return true;
  }
  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
  return IMAGE_EXTENSIONS.includes(ext);
}

function isImageFile(file: File): boolean {
  // Skip empty files (0 bytes)
  if (file.size === 0) {
    return false;
  }
  return hasImageExtension(file);
}

// Check if File System Access API is supported
function supportsDirectoryPicker(): boolean {
  return "showDirectoryPicker" in window;
}

// Check if Save File Picker is supported
function supportsSaveFilePicker(): boolean {
  return "showSaveFilePicker" in window;
}

/**
 * Load an image from a blob and return the HTMLImageElement
 */
function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}

/**
 * Resize an image blob to target dimensions using pica (Lanczos3)
 * Provides high-quality resizing, especially for downscaling
 */
async function resizeImage(
  sourceBlob: Blob,
  targetWidth: number,
  targetHeight: number,
): Promise<Blob> {
  // Load source image
  const img = await loadImage(sourceBlob);

  // Create source canvas from image
  const srcCanvas = document.createElement("canvas");
  srcCanvas.width = img.naturalWidth;
  srcCanvas.height = img.naturalHeight;
  const srcCtx = srcCanvas.getContext("2d");
  if (!srcCtx) {
    throw new Error("Failed to get source canvas context");
  }
  srcCtx.drawImage(img, 0, 0);

  // Create destination canvas
  const destCanvas = document.createElement("canvas");
  destCanvas.width = targetWidth;
  destCanvas.height = targetHeight;

  // Resize with pica using mks2013 filter (best quality, includes optimal sharpening)
  await resizer.resize(srcCanvas, destCanvas, {
    filter: "mks2013", // Pica's optimal filter - combines best resize + built-in sharpening
  });

  // Export to blob with maximum quality
  const resultBlob = await resizer.toBlob(
    destCanvas,
    sourceBlob.type || "image/png",
    1.0, // 100% quality - no compression artifacts
  );

  return resultBlob;
}

type SaveStatus = "saving" | "saved" | null;

interface PendingRestoreData {
  images: ImageData[];
  directory: string;
  storedCaptions: Map<string, StoredCaption>;
  matchedCount: number;
}

interface PendingDeletion {
  image: ImageData;
  originalIndex: number;
  toastId: string;
  fileData: ArrayBuffer; // Actual file contents for restore
}

interface PendingCrop {
  imageId: string;
  originalData: ArrayBuffer; // Actual file contents for restore
  originalType: string;
  originalWidth: number;
  originalHeight: number;
  newWidth: number;
  newHeight: number;
  toastId: string;
}

interface BulkUpscaleProgress {
  current: number;
  total: number;
}

export function App() {
  const [images, setImages] = useState<ImageData[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [currentDirectory, setCurrentDirectory] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [isBulkUpscaleOpen, setIsBulkUpscaleOpen] = useState(false);
  const [bulkUpscaleProgress, setBulkUpscaleProgress] =
    useState<BulkUpscaleProgress | null>(null);
  const [isDeleteAllDataOpen, setIsDeleteAllDataOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(window.location.search);
    return params.get("settings") === "1";
  });
  const [settings, setSettings] = useState<Settings>(() => {
    if (typeof window === "undefined") {
      return { upscaleServerUrl: "", allowDeletions: true };
    }
    return getSettings();
  });

  // Create upscale client if URL is configured
  const upscaleClient = useMemo(() => {
    const url = settings.upscaleServerUrl?.trim();
    if (url) {
      return new UpscaleClient(url);
    }
    return null;
  }, [settings.upscaleServerUrl]);

  // Check upscale server availability on app load (if URL is configured)
  // This pre-warms the cache so ImagePreview can use the result immediately
  useQuery({
    queryKey: ["upscale-server-status", settings.upscaleServerUrl],
    queryFn: async () => {
      if (!upscaleClient) return false;
      await upscaleClient.ping();
      return true;
    },
    enabled: upscaleClient !== null,
    retry: false,
  });

  const [leftPaneWidth, setLeftPaneWidth] = useState(33.33); // percentage (image preview takes 2/3)
  const [isDragging, setIsDragging] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(null);
  const [pendingRestore, setPendingRestore] =
    useState<PendingRestoreData | null>(null);
  const [pendingDeletion, setPendingDeletion] =
    useState<PendingDeletion | null>(null);
  const [pendingCrop, setPendingCrop] = useState<PendingCrop | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const directoryHandleRef = useRef<FileSystemDirectoryHandle | null>(null);
  const imagesRef = useRef<ImageData[]>(images);

  // Keep ref in sync with state for cleanup
  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      for (const img of imagesRef.current) {
        URL.revokeObjectURL(img.objectUrl);
      }
    };
  }, []);

  // Sync settings drawer state with URL
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (isSettingsOpen) {
      url.searchParams.set("settings", "1");
    } else {
      url.searchParams.delete("settings");
    }
    window.history.replaceState({}, "", url);
  }, [isSettingsOpen]);

  // Auto-save to IndexedDB when images change (debounced)
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
  }, [images, currentDirectory]);

  // Helper to finalize images (set state and load dimensions)
  const finalizeImages = useCallback(
    (newImages: ImageData[], directoryName: string) => {
      setCurrentDirectory(directoryName);
      setImages(newImages);
      setSelectedImageId(newImages[0]?.id ?? null);
      setErrorMessage(null);

      // Load image dimensions asynchronously
      newImages.forEach((imageData) => {
        const img = new Image();
        img.onload = () => {
          setImages((prev) =>
            prev.map((item) =>
              item.id === imageData.id
                ? {
                    ...item,
                    width: img.naturalWidth,
                    height: img.naturalHeight,
                  }
                : item,
            ),
          );
        };
        img.src = imageData.objectUrl;
      });
    },
    [],
  );

  // Process files from either File System Access API or file input
  const processFiles = useCallback(
    async (files: File[], directoryName: string) => {
      // Revoke old object URLs
      for (const img of images) {
        URL.revokeObjectURL(img.objectUrl);
      }

      // Filter and process image files
      const imageFiles = files.filter(isImageFile);

      // Find 0-byte image files that should be cleaned up from IndexedDB
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

      // Sort by filename using natural/numeric ordering
      imageFiles.sort((a, b) =>
        a.name.localeCompare(b.name, undefined, {
          numeric: true,
          sensitivity: "base",
        }),
      );

      // Create image data objects
      const newImages: ImageData[] = imageFiles.map((file, index) => ({
        id: `${index}-${file.name}`,
        file,
        objectUrl: URL.createObjectURL(file),
        fileName: file.name,
        namespace: directoryName,
        caption: "",
      }));

      // Check for existing history in IndexedDB
      try {
        const storedCaptions = await getCaptionsByDirectory(directoryName);

        // Clean up IndexedDB entries for 0-byte image files
        if (zeroByteImageFiles.length > 0 && storedCaptions.size > 0) {
          const keysToDelete = zeroByteImageFiles
            .filter((file) => storedCaptions.has(file.name))
            .map((file) => makeKey(directoryName, file.name));

          if (keysToDelete.length > 0) {
            await deleteCaptions(keysToDelete);
            // Remove from storedCaptions map so they don't affect restore logic
            for (const file of zeroByteImageFiles) {
              storedCaptions.delete(file.name);
            }
          }
        }

        if (storedCaptions.size > 0) {
          // Count how many of the loaded images have stored captions
          const matchedCount = newImages.filter((img) =>
            storedCaptions.has(img.fileName),
          ).length;

          if (matchedCount > 0) {
            // Show restore modal - store pending data
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
        // Continue without checking history
      }

      // No history found, proceed normally
      finalizeImages(newImages, directoryName);
    },
    [images, finalizeImages],
  );

  // Handle restore decision - YES
  const handleRestoreHistory = useCallback(() => {
    if (!pendingRestore) return;

    const { images: newImages, directory, storedCaptions } = pendingRestore;

    // Apply stored captions
    for (const img of newImages) {
      const stored = storedCaptions.get(img.fileName);
      if (stored) {
        img.caption = stored.caption;
      }
    }

    finalizeImages(newImages, directory);
    setPendingRestore(null);
  }, [pendingRestore, finalizeImages]);

  // Handle restore decision - NO
  const handleDiscardHistory = useCallback(async () => {
    if (!pendingRestore) return;

    const { images: newImages, directory, storedCaptions } = pendingRestore;

    // Delete stored captions from IndexedDB
    try {
      const keysToDelete = Array.from(storedCaptions.values()).map(
        (c) => c.key,
      );
      await deleteCaptions(keysToDelete);
    } catch (err) {
      console.error("Failed to delete from IndexedDB:", err);
      // Continue anyway
    }

    // Start fresh with empty captions
    finalizeImages(newImages, directory);
    setPendingRestore(null);
  }, [pendingRestore, finalizeImages]);

  // Handle folder selection using File System Access API
  const handleSelectFolderModern = useCallback(async () => {
    try {
      const dirHandle = await window.showDirectoryPicker();
      const files: File[] = [];

      for await (const entry of dirHandle.values()) {
        if (entry.kind === "file") {
          const file = await entry.getFile();
          files.push(file);
        }
      }

      // Store directory handle for export location suggestion
      directoryHandleRef.current = dirHandle;

      // Try to get full path from files (available in Electron and some contexts)
      // Falls back to directory name if not available
      type FileWithPath = File & { path?: string };
      const firstFileWithPath = files.find((f) => (f as FileWithPath).path);
      let directoryPath = dirHandle.name;

      if (firstFileWithPath && (firstFileWithPath as FileWithPath).path) {
        const fullPath = (firstFileWithPath as FileWithPath).path;
        // Extract directory from full file path (remove filename)
        const lastSep = Math.max(
          fullPath.lastIndexOf("/"),
          fullPath.lastIndexOf("\\"),
        );
        if (lastSep > 0) {
          directoryPath = fullPath.substring(0, lastSep);
        }
      }

      await processFiles(files, directoryPath);
    } catch (err) {
      // User cancelled or error
      if ((err as Error).name !== "AbortError") {
        console.error("Failed to open directory:", err);
        setErrorMessage("Failed to open directory");
      }
    }
  }, [processFiles]);

  // Handle folder selection using legacy file input
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

      // Extract full directory paths from all files' webkitRelativePath
      // Find the common prefix path to use as namespace
      type FileWithPath = File & { webkitRelativePath?: string };
      const dirPaths = Array.from(files).map((file) => {
        const relativePath = (file as FileWithPath).webkitRelativePath || "";
        const parts = relativePath.split("/");
        return parts.slice(0, -1); // Remove filename, keep directory parts
      });

      // Find common prefix among all directory paths
      let commonParts: string[] = dirPaths[0] || [];
      for (const parts of dirPaths.slice(1)) {
        const newCommon: string[] = [];
        for (let i = 0; i < Math.min(commonParts.length, parts.length); i++) {
          if (commonParts[i] === parts[i]) {
            newCommon.push(commonParts[i]);
          } else {
            break;
          }
        }
        commonParts = newCommon;
      }

      const directoryPath = commonParts.join("/") || "unknown";

      // Clear directory handle (not available with legacy input)
      directoryHandleRef.current = null;

      await processFiles(Array.from(files), directoryPath);

      // Reset input so the same folder can be selected again
      event.target.value = "";
    },
    [processFiles],
  );

  const handleCaptionChange = useCallback(
    (caption: string) => {
      if (!selectedImageId) return;

      setImages((prev) =>
        prev.map((img) =>
          img.id === selectedImageId ? { ...img, caption } : img,
        ),
      );
    },
    [selectedImageId],
  );

  const handleSelectImage = useCallback((id: string) => {
    setSelectedImageId(id);
  }, []);

  // Handle broken images that fail to load (0-byte or corrupt files)
  const handleRemoveBrokenImage = useCallback(
    async (id: string) => {
      const brokenImage = images.find((img) => img.id === id);
      if (!brokenImage) return;

      // Remove from state
      setImages((prev) => prev.filter((img) => img.id !== id));

      // If selected, select next available image
      if (selectedImageId === id) {
        const remainingImages = images.filter((img) => img.id !== id);
        if (remainingImages.length > 0) {
          setSelectedImageId(remainingImages[0].id);
        } else {
          setSelectedImageId(null);
        }
      }

      // Remove from IndexedDB if it exists
      if (currentDirectory) {
        try {
          await deleteCaptions([
            makeKey(currentDirectory, brokenImage.fileName),
          ]);
        } catch (err) {
          console.error("Failed to delete broken image from IndexedDB:", err);
        }
      }

      // Revoke the object URL
      URL.revokeObjectURL(brokenImage.objectUrl);
    },
    [images, selectedImageId, currentDirectory],
  );

  // Resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    document.body.classList.add("resizing");
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const containerWidth = containerRect.width;
      const newX = e.clientX - containerRect.left;

      // Calculate percentage, respecting min/max constraints
      let newPercent = (newX / containerWidth) * 100;

      // Apply minimum width constraint
      const minPercent = (MIN_PANE_WIDTH / containerWidth) * 100;
      newPercent = Math.max(minPercent, newPercent);
      newPercent = Math.min(MAX_PANE_PERCENT, newPercent);

      setLeftPaneWidth(newPercent);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.classList.remove("resizing");
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.classList.remove("resizing");
    };
  }, [isDragging]);

  const currentIndex = images.findIndex((img) => img.id === selectedImageId);
  const selectedImage = currentIndex >= 0 ? images[currentIndex] : null;

  const handleExport = useCallback(
    async (format: "json" | "jsonl") => {
      if (images.length === 0) return;

      const payload = images.map((img) => ({
        filename: img.fileName,
        caption: img.caption.trim(),
      }));

      let content: string;
      let mimeType: string;
      let extension: string;

      if (format === "jsonl") {
        // JSON Lines: one JSON object per line
        content = payload.map((item) => JSON.stringify(item)).join("\n");
        mimeType = "application/x-ndjson";
        extension = "jsonl";
      } else {
        // Standard JSON array
        content = JSON.stringify(payload, null, 2);
        mimeType = "application/json";
        extension = "json";
      }

      // Try modern File System Access API for save location picker
      if (supportsSaveFilePicker()) {
        try {
          const fileHandle = await window.showSaveFilePicker({
            suggestedName: `captions.${extension}`,
            // Start in the same directory where images were loaded from
            ...(directoryHandleRef.current && {
              startIn: directoryHandleRef.current,
            }),
            types: [
              {
                description: format === "jsonl" ? "JSON Lines" : "JSON",
                accept: { [mimeType]: [`.${extension}`] },
              },
            ],
          });

          const writable = await fileHandle.createWritable();
          await writable.write(content);
          await writable.close();
          return;
        } catch (err) {
          // User cancelled or error - fall back to legacy download
          if ((err as Error).name === "AbortError") {
            return; // User cancelled, don't fall back
          }
          console.error(
            "Save file picker failed, falling back to download:",
            err,
          );
        }
      }

      // Fallback: legacy blob download
      const blob = new Blob([content], { type: mimeType });
      const blobUrl = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `captions.${extension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(blobUrl);
    },
    [images],
  );

  const handleBulkOverwrite = useCallback((caption: string) => {
    setImages((prev) => prev.map((img) => ({ ...img, caption })));
  }, []);

  // Bulk upscale all images to target dimensions
  const handleBulkUpscale = useCallback(
    async (targetWidth: number, targetHeight: number) => {
      if (!upscaleClient || images.length === 0) return;

      // Set initial progress
      setBulkUpscaleProgress({ current: 0, total: images.length });

      const MAX_UPSCALE_ITERATIONS = 5;

      for (let i = 0; i < images.length; i++) {
        const imageData = images[i];
        const originalWidth = imageData.width ?? 0;
        const originalHeight = imageData.height ?? 0;

        // Skip if image dimensions are not available or already at/above target
        if (
          originalWidth === 0 ||
          originalHeight === 0 ||
          (originalWidth >= targetWidth && originalHeight >= targetHeight)
        ) {
          setBulkUpscaleProgress({ current: i + 1, total: images.length });
          continue;
        }

        try {
          let sourceBlob: Blob = imageData.file;
          let currentWidth = originalWidth;
          let currentHeight = originalHeight;

          // Upscale repeatedly until we reach or exceed target dimensions (max iterations)
          let iterations = 0;
          while (
            (currentWidth < targetWidth || currentHeight < targetHeight) &&
            iterations < MAX_UPSCALE_ITERATIONS
          ) {
            try {
              // Run 2x upscale
              const upscaledBlob = await upscaleClient.upscale(sourceBlob, {
                scale: 2,
              });
              // Success - update our best result
              sourceBlob = upscaledBlob;
              currentWidth *= 2;
              currentHeight *= 2;
              iterations++;
            } catch {
              // Upscale failed (e.g., server OOM) - use best result so far
              console.warn(
                `Bulk upscale iteration ${iterations + 1} failed for ${imageData.fileName}, using best result so far (${currentWidth}×${currentHeight})`,
              );
              break;
            }
          }

          // Only resize with pica if we have enough dimensions (downscale only)
          let finalBlob: Blob;
          let finalWidth: number;
          let finalHeight: number;

          if (currentWidth >= targetWidth && currentHeight >= targetHeight) {
            // Downscale to exact target dimensions with high-quality pica
            finalBlob = await resizeImage(
              sourceBlob,
              targetWidth,
              targetHeight,
            );
            finalWidth = targetWidth;
            finalHeight = targetHeight;
          } else {
            // Couldn't reach target - use best upscaled result as-is
            finalBlob = sourceBlob;
            finalWidth = currentWidth;
            finalHeight = currentHeight;
          }

          // Create new File from blob (preserve original filename)
          const newFile = new File([finalBlob], imageData.fileName, {
            type: finalBlob.type || "image/png",
          });

          // Create new object URL
          const newObjectUrl = URL.createObjectURL(newFile);

          // Revoke old object URL
          URL.revokeObjectURL(imageData.objectUrl);

          // Update image in state
          setImages((prev) =>
            prev.map((img) =>
              img.id === imageData.id
                ? {
                    ...img,
                    file: newFile,
                    objectUrl: newObjectUrl,
                    width: finalWidth,
                    height: finalHeight,
                  }
                : img,
            ),
          );

          // Save to disk if File System Access API is available
          if (directoryHandleRef.current) {
            try {
              const fileHandle = await directoryHandleRef.current.getFileHandle(
                imageData.fileName,
                { create: false },
              );
              const writable = await fileHandle.createWritable();
              await writable.write(finalBlob);
              await writable.close();
            } catch (err) {
              console.error(
                `Failed to save upscaled image ${imageData.fileName} to disk:`,
                err,
              );
            }
          }
        } catch (err) {
          console.error(`Failed to upscale ${imageData.fileName}:`, err);
          // Continue with next image
        }

        // Update progress
        setBulkUpscaleProgress({ current: i + 1, total: images.length });
      }

      // Clear progress when done
      setBulkUpscaleProgress(null);
    },
    [upscaleClient, images],
  );

  const handleSettingsChange = useCallback((newSettings: Settings) => {
    setSettings(newSettings);
    saveSettings(newSettings);
  }, []);

  // Handle delete all data
  const handleDeleteAllData = useCallback(async () => {
    try {
      // Clear IndexedDB
      await clearAllData();

      // Clear localStorage
      localStorage.clear();

      // Revoke all object URLs
      for (const img of images) {
        URL.revokeObjectURL(img.objectUrl);
      }

      // Reset UI state
      setImages([]);
      setSelectedImageId(null);
      setCurrentDirectory(null);
      setErrorMessage(null);
      setSaveStatus(null);
      setPendingRestore(null);
      setPendingDeletion(null);
      setPendingCrop(null);
      setSettings(getSettings()); // Reset to defaults
      directoryHandleRef.current = null;

      // Close the modal
      setIsDeleteAllDataOpen(false);
    } catch (err) {
      console.error("Failed to delete all data:", err);
      setErrorMessage("Failed to delete all data");
    }
  }, [images]);

  // Finalize a pending deletion (cleanup - file is already deleted from disk)
  const handleFinalizeDelete = useCallback(
    async (pending: PendingDeletion) => {
      toast.dismiss(pending.toastId);

      // Delete from IndexedDB
      if (currentDirectory) {
        try {
          const key = makeKey(currentDirectory, pending.image.fileName);
          await deleteCaptions([key]);
        } catch (err) {
          console.error("Failed to delete from IndexedDB:", err);
        }
      }

      // Revoke object URL
      URL.revokeObjectURL(pending.image.objectUrl);
    },
    [currentDirectory],
  );

  // Undo a pending deletion - restore file to disk
  const handleUndoDelete = useCallback(async (pending: PendingDeletion) => {
    toast.dismiss(pending.toastId);

    // Write file back to disk if File System Access API is available
    if (directoryHandleRef.current) {
      try {
        const fileHandle = await directoryHandleRef.current.getFileHandle(
          pending.image.fileName,
          { create: true },
        );
        const writable = await fileHandle.createWritable();
        await writable.write(pending.fileData);
        await writable.close();
      } catch (err) {
        console.error("Failed to restore file to disk:", err);
        // Continue anyway - at least restore to UI
      }
    }

    // Restore image to its original position
    setImages((prev) => {
      const newImages = [...prev];
      newImages.splice(pending.originalIndex, 0, pending.image);
      return newImages;
    });

    // Select the restored image
    setSelectedImageId(pending.image.id);
    setPendingDeletion(null);
  }, []);

  // Delete the currently selected image
  const handleDeleteImage = useCallback(async () => {
    if (!settings.allowDeletions) return;
    if (!selectedImageId || images.length === 0) return;

    const imageIndex = images.findIndex((img) => img.id === selectedImageId);
    if (imageIndex === -1) return;

    const imageToDelete = images[imageIndex];

    // Finalize any previous pending deletion first
    if (pendingDeletion) {
      handleFinalizeDelete(pendingDeletion);
    }

    // Read file data into memory BEFORE deleting (for undo support)
    const fileData = await imageToDelete.file.arrayBuffer();

    // Delete from disk immediately if File System Access API is available
    if (directoryHandleRef.current) {
      try {
        await directoryHandleRef.current.removeEntry(imageToDelete.fileName);
      } catch (err) {
        console.error("Failed to delete file from disk:", err);
        // Continue anyway - still remove from UI
      }
    }

    // Remove from state immediately
    setImages((prev) => prev.filter((img) => img.id !== selectedImageId));

    // Select next image (or previous if at end)
    if (images.length > 1) {
      const nextIndex =
        imageIndex < images.length - 1 ? imageIndex : imageIndex - 1;
      const nextImage =
        images[nextIndex === imageIndex ? imageIndex + 1 : nextIndex];
      if (nextImage && nextImage.id !== selectedImageId) {
        setSelectedImageId(nextImage.id);
      } else if (images.length > 1) {
        // Edge case: find any other image
        const otherImage = images.find((img) => img.id !== selectedImageId);
        setSelectedImageId(otherImage?.id ?? null);
      }
    } else {
      setSelectedImageId(null);
    }

    // Create toast ID
    const toastId = `delete-${imageToDelete.id}-${Date.now()}`;

    // Store pending deletion with file data for undo
    const pending: PendingDeletion = {
      image: imageToDelete,
      originalIndex: imageIndex,
      toastId,
      fileData,
    };
    setPendingDeletion(pending);

    // Show toast with undo button
    toast.custom(
      (t) => (
        <div
          className={`${
            t.visible ? "animate-enter" : "animate-leave"
          } max-w-md w-full bg-gray-900 shadow-lg rounded-lg pointer-events-auto flex items-center gap-3 px-4 py-3`}
        >
          <p className="flex-1 text-sm text-white">
            Deleted{" "}
            <span className="font-medium">{imageToDelete.fileName}</span>
          </p>
          <button
            type="button"
            onClick={() => {
              toast.dismiss(t.id);
              handleUndoDelete(pending);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-gray-700 hover:bg-gray-600 rounded-md transition-colors cursor-pointer"
          >
            <Undo2 className="w-4 h-4" />
            Undo
          </button>
          <button
            type="button"
            onClick={() => {
              toast.dismiss(t.id);
              handleFinalizeDelete(pending);
              setPendingDeletion(null);
            }}
            className="p-1.5 text-gray-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ),
      {
        id: toastId,
        duration: 30000, // 30 seconds
      },
    );

    // Set up auto-finalize when toast disappears
    setTimeout(() => {
      setPendingDeletion((current) => {
        if (current?.toastId === toastId) {
          handleFinalizeDelete(current);
          return null;
        }
        return current;
      });
    }, 30000);
  }, [
    selectedImageId,
    images,
    pendingDeletion,
    handleFinalizeDelete,
    handleUndoDelete,
    settings.allowDeletions,
  ]);

  const handleUpscaleConfirm = useCallback(
    async (
      imageId: string,
      newBlob: Blob,
      newWidth: number,
      newHeight: number,
    ) => {
      // Find the image to update
      const imageToUpdate = images.find((img) => img.id === imageId);
      if (!imageToUpdate) return;

      // Create new File from blob (preserve original filename)
      const newFile = new File([newBlob], imageToUpdate.fileName, {
        type: newBlob.type || "image/png",
      });

      // Create new object URL
      const newObjectUrl = URL.createObjectURL(newFile);

      // Revoke old object URL
      URL.revokeObjectURL(imageToUpdate.objectUrl);

      // Update image in state
      setImages((prev) =>
        prev.map((img) =>
          img.id === imageId
            ? {
                ...img,
                file: newFile,
                objectUrl: newObjectUrl,
                width: newWidth,
                height: newHeight,
              }
            : img,
        ),
      );

      // Save to disk if File System Access API is available
      if (directoryHandleRef.current) {
        try {
          const fileHandle = await directoryHandleRef.current.getFileHandle(
            imageToUpdate.fileName,
            { create: false },
          );
          const writable = await fileHandle.createWritable();
          await writable.write(newBlob);
          await writable.close();
        } catch (err) {
          console.error("Failed to save upscaled image to disk:", err);
          // Don't throw - the in-memory update already succeeded
        }
      }
    },
    [images],
  );

  // Undo a crop operation
  const handleUndoCrop = useCallback(
    async (pending: PendingCrop) => {
      toast.dismiss(pending.toastId);

      // Find the image to restore
      const imageToRestore = images.find((img) => img.id === pending.imageId);
      if (!imageToRestore) {
        setPendingCrop(null);
        return;
      }

      // Create Blob from stored ArrayBuffer
      const restoredBlob = new Blob([pending.originalData], {
        type: pending.originalType,
      });

      // Create new File from restored blob
      const restoredFile = new File([restoredBlob], imageToRestore.fileName, {
        type: pending.originalType,
      });

      // Create new object URL
      const restoredObjectUrl = URL.createObjectURL(restoredFile);

      // Revoke current object URL
      URL.revokeObjectURL(imageToRestore.objectUrl);

      // Restore image in state
      setImages((prev) =>
        prev.map((img) =>
          img.id === pending.imageId
            ? {
                ...img,
                file: restoredFile,
                objectUrl: restoredObjectUrl,
                width: pending.originalWidth,
                height: pending.originalHeight,
              }
            : img,
        ),
      );

      // Restore to disk if File System Access API is available
      if (directoryHandleRef.current) {
        try {
          const fileHandle = await directoryHandleRef.current.getFileHandle(
            imageToRestore.fileName,
            { create: false },
          );
          const writable = await fileHandle.createWritable();
          await writable.write(restoredBlob);
          await writable.close();
        } catch (err) {
          console.error("Failed to restore original image to disk:", err);
        }
      }

      setPendingCrop(null);
    },
    [images],
  );

  // Cancel pending crop (same as undo)
  const handleCancelCrop = useCallback(() => {
    if (pendingCrop) {
      handleUndoCrop(pendingCrop);
    }
  }, [pendingCrop, handleUndoCrop]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInInput =
        target.tagName === "INPUT" || target.tagName === "TEXTAREA";

      const key = e.key.toLowerCase();
      const isCtrl = e.ctrlKey || e.metaKey;

      // Ctrl+Z for undo (works even with no images loaded, even in inputs)
      if (key === "z" && isCtrl) {
        // Undo most recent action: crop first, then deletion
        if (pendingCrop) {
          e.preventDefault();
          handleUndoCrop(pendingCrop);
          return;
        }
        if (pendingDeletion) {
          e.preventDefault();
          handleUndoDelete(pendingDeletion);
          return;
        }
        // If no pending undo, let native browser undo work
        return;
      }

      // Don't handle other keys if user is typing in an input/textarea
      if (isInInput) {
        return;
      }

      if (images.length === 0) return;

      const isShift = e.shiftKey;

      if (key === "h") {
        if (isShift) {
          // Go to first previous uncaptioned image
          for (let i = currentIndex - 1; i >= 0; i--) {
            if (images[i].caption.trim() === "") {
              setSelectedImageId(images[i].id);
              break;
            }
          }
        } else {
          // Go to previous image
          if (currentIndex > 0) {
            setSelectedImageId(images[currentIndex - 1].id);
          }
        }
      } else if (key === "l") {
        if (isShift) {
          // Go to first next uncaptioned image
          for (let i = currentIndex + 1; i < images.length; i++) {
            if (images[i].caption.trim() === "") {
              setSelectedImageId(images[i].id);
              break;
            }
          }
        } else {
          // Go to next image
          if (currentIndex < images.length - 1) {
            setSelectedImageId(images[currentIndex + 1].id);
          }
        }
      } else if (key === "enter") {
        // Focus the caption textarea
        const captionField = document.getElementById("caption");
        if (captionField) {
          e.preventDefault();
          captionField.focus();
        }
      } else if (key === "delete" || key === "d") {
        // Delete current image
        e.preventDefault();
        handleDeleteImage();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    images,
    currentIndex,
    handleDeleteImage,
    pendingCrop,
    pendingDeletion,
    handleUndoCrop,
    handleUndoDelete,
  ]);

  // Crop confirm handler with undo support
  const handleCropConfirm = useCallback(
    async (
      imageId: string,
      newBlob: Blob,
      newWidth: number,
      newHeight: number,
    ) => {
      // Find the image to update
      const imageToUpdate = images.find((img) => img.id === imageId);
      if (!imageToUpdate) return;

      // Finalize any previous pending crop first
      if (pendingCrop) {
        toast.dismiss(pendingCrop.toastId);
        setPendingCrop(null);
      }

      // Read original file data into memory BEFORE modifying (for undo support)
      const originalData = await imageToUpdate.file.arrayBuffer();
      const originalType = imageToUpdate.file.type || "image/png";
      const originalWidth = imageToUpdate.width ?? 0;
      const originalHeight = imageToUpdate.height ?? 0;

      // Create new File from blob (preserve original filename)
      const newFile = new File([newBlob], imageToUpdate.fileName, {
        type: newBlob.type || "image/png",
      });

      // Create new object URL
      const newObjectUrl = URL.createObjectURL(newFile);

      // Revoke old object URL
      URL.revokeObjectURL(imageToUpdate.objectUrl);

      // Update image in state
      setImages((prev) =>
        prev.map((img) =>
          img.id === imageId
            ? {
                ...img,
                file: newFile,
                objectUrl: newObjectUrl,
                width: newWidth,
                height: newHeight,
              }
            : img,
        ),
      );

      // Save to disk if File System Access API is available
      if (directoryHandleRef.current) {
        try {
          const fileHandle = await directoryHandleRef.current.getFileHandle(
            imageToUpdate.fileName,
            { create: false },
          );
          const writable = await fileHandle.createWritable();
          await writable.write(newBlob);
          await writable.close();
        } catch (err) {
          console.error("Failed to save cropped image to disk:", err);
        }
      }

      // Create toast ID
      const toastId = `crop-${imageId}-${Date.now()}`;

      // Store pending crop for undo
      const pending: PendingCrop = {
        imageId,
        originalData,
        originalType,
        originalWidth,
        originalHeight,
        newWidth,
        newHeight,
        toastId,
      };
      setPendingCrop(pending);

      // Show toast with undo button
      toast.custom(
        (t) => (
          <div
            className={`${
              t.visible ? "animate-enter" : "animate-leave"
            } max-w-md w-full bg-gray-900 shadow-lg rounded-lg pointer-events-auto flex items-center gap-3 px-4 py-3`}
          >
            <p className="flex-1 text-sm text-white">
              Cropped to{" "}
              <span className="font-medium">
                {newWidth}×{newHeight}
              </span>
            </p>
            <button
              type="button"
              onClick={() => {
                toast.dismiss(t.id);
                handleUndoCrop(pending);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-gray-700 hover:bg-gray-600 rounded-md transition-colors cursor-pointer"
            >
              <Undo2 className="w-4 h-4" />
              Undo
            </button>
            <button
              type="button"
              onClick={() => {
                toast.dismiss(t.id);
                setPendingCrop(null);
              }}
              className="p-1.5 text-gray-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ),
        {
          id: toastId,
          duration: 5000, // 5 seconds
        },
      );

      // Auto-clear pending state when toast disappears
      setTimeout(() => {
        setPendingCrop((current) => {
          if (current?.toastId === toastId) {
            return null;
          }
          return current;
        });
      }, 5000);
    },
    [images, pendingCrop, handleUndoCrop],
  );

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Toast container */}
      <Toaster position="bottom-center" />

      {/* Hidden folder input (fallback for browsers without File System Access API) */}
      <input
        ref={(el) => {
          (
            fileInputRef as React.MutableRefObject<HTMLInputElement | null>
          ).current = el;
          if (el) el.setAttribute("webkitdirectory", "");
        }}
        type="file"
        multiple
        onChange={handleFolderChange}
        className="hidden"
      />

      {/* Header */}
      <Header
        imageCount={images.length}
        captionedCount={
          images.filter((img) => img.caption.trim() !== "").length
        }
        saveStatus={saveStatus}
        onSelectFolder={handleSelectFolder}
        onExport={handleExport}
        onShowHelp={() => setIsHelpOpen(true)}
        onShowSettings={() => setIsSettingsOpen(true)}
        onBulkEdit={() => setIsBulkEditOpen(true)}
        onBulkUpscale={() => setIsBulkUpscaleOpen(true)}
        onDeleteAllData={() => setIsDeleteAllDataOpen(true)}
        bulkUpscaleProgress={bulkUpscaleProgress}
      />

      {/* Settings modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSettingsChange={handleSettingsChange}
      />

      {/* Keybindings modal */}
      <KeybindingsModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />

      {/* Bulk edit modal */}
      <BulkEditModal
        isOpen={isBulkEditOpen}
        imageCount={images.length}
        onClose={() => setIsBulkEditOpen(false)}
        onOverwrite={handleBulkOverwrite}
      />

      {/* Bulk upscale modal */}
      <BulkUpscaleModal
        isOpen={isBulkUpscaleOpen}
        imageCount={images.length}
        onClose={() => setIsBulkUpscaleOpen(false)}
        onStart={handleBulkUpscale}
      />

      {/* Delete all data modal */}
      <DeleteAllDataModal
        isOpen={isDeleteAllDataOpen}
        onClose={() => setIsDeleteAllDataOpen(false)}
        onConfirm={handleDeleteAllData}
      />

      {/* Restore history modal */}
      <RestoreHistoryModal
        isOpen={pendingRestore !== null}
        matchedCount={pendingRestore?.matchedCount ?? 0}
        totalCount={pendingRestore?.images.length ?? 0}
        onRestore={handleRestoreHistory}
        onDiscard={handleDiscardHistory}
      />

      {/* Error message */}
      {errorMessage && (
        <div className="bg-red-50 border-b border-red-200 px-6 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {/* Main content */}
      {images.length === 0 ? (
        <EmptyState onSelectFolder={handleSelectFolder} />
      ) : (
        <>
          <div
            ref={containerRef}
            className={`flex-1 flex overflow-hidden ${isDragging ? "select-none" : ""}`}
          >
            {/* Left pane - Caption form */}
            <div
              className="overflow-y-auto shrink-0"
              style={{ width: `${leftPaneWidth}%`, minWidth: MIN_PANE_WIDTH }}
            >
              <CaptionForm
                selectedImage={selectedImage}
                currentIndex={currentIndex}
                totalImages={images.length}
                onCaptionChange={handleCaptionChange}
              />
            </div>

            {/* Resize handle */}
            <button
              type="button"
              aria-label="Resize panels"
              className="resize-handle group relative w-1 shrink-0 cursor-col-resize bg-gray-200 hover:bg-primary focus:bg-primary focus:outline-none transition-colors"
              onMouseDown={handleResizeStart}
              onKeyDown={(e) => {
                const container = containerRef.current;
                if (!container) return;
                const step = e.shiftKey ? 5 : 1;
                const minPercent =
                  (MIN_PANE_WIDTH / container.offsetWidth) * 100;
                if (e.key === "ArrowLeft") {
                  e.preventDefault();
                  setLeftPaneWidth((prev) => Math.max(minPercent, prev - step));
                } else if (e.key === "ArrowRight") {
                  e.preventDefault();
                  setLeftPaneWidth((prev) =>
                    Math.min(MAX_PANE_PERCENT, prev + step),
                  );
                }
              }}
            >
              {/* Visual indicator */}
              <span className="absolute inset-y-0 -left-1 -right-1 group-hover:bg-primary/10 group-focus:bg-primary/10" />
              {/* Grip dots */}
              <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity">
                <span className="w-1 h-1 rounded-full bg-primary" />
                <span className="w-1 h-1 rounded-full bg-primary" />
                <span className="w-1 h-1 rounded-full bg-primary" />
              </span>
            </button>

            {/* Right pane - Image preview */}
            <div className="flex-1 overflow-hidden min-w-0">
              <ImagePreview
                selectedImage={selectedImage}
                onUpscaleConfirm={handleUpscaleConfirm}
                onCropConfirm={handleCropConfirm}
                upscaleServerUrl={settings.upscaleServerUrl}
                hasPendingCrop={
                  pendingCrop !== null &&
                  pendingCrop.imageId === selectedImage?.id
                }
                onCancelCrop={handleCancelCrop}
              />
            </div>
          </div>

          {/* Bottom filmstrip */}
          <Filmstrip
            images={images}
            selectedImageId={selectedImageId}
            onSelectImage={handleSelectImage}
            onRemoveBrokenImage={handleRemoveBrokenImage}
          />
        </>
      )}
    </div>
  );
}
