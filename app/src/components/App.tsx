import { useRef, useState, useEffect, useCallback } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import toast, { Toaster } from "react-hot-toast";
import { useQuery } from "@tanstack/react-query";
import { useQuery as useConvexQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import {
  Header,
  Filmstrip,
  CaptionForm,
  ImagePreview,
  EmptyState,
  KeybindingsModal,
  BulkEditModal,
  BulkUpscaleModal,
  GenerateModal,
  type GenerateOptions,
  SettingsModal,
  DeleteAllDataModal,
  ImportModal,
  type SettingsSection,
} from "./index";
import { StabilityGenerateClient } from "../lib/stability-generate-client";
import {
  UpscaleClient,
  type LocalGenerateModel,
} from "../lib/ai3-upscale-client";
import type { ImageData } from "../types";
import { generateThumbnail } from "../lib/thumbnail";
import { generateUUID } from "../lib/image-identity";
import { ResizeHandle } from "./ResizeHandle";
import type { Settings, MetaObject } from "../lib/settings";
import { exportCaptions } from "../lib/export";
import {
  readCsvFile,
  parseAndValidateCsv,
  formatImportErrors,
} from "../lib/import";
import {
  imagesAtom,
  selectedImageIdAtom,
  currentDirectoryAtom,
  errorMessageAtom,
  saveStatusAtom,
  settingsAtom,
  isCroppingAtom,
  currentIndexAtom,
  selectedImageAtom,
  captionedCountAtom,
  importStateAtom,
  importProgressAtom,
  importStatsAtom,
  importModalOpenAtom,
  importCancelledAtom,
  store,
} from "../lib/store";
import {
  useImagePreloading,
  useAutoSave,
  usePaneResize,
  useImageDeletion,
  useCropUndo,
  useKeyboardNavigation,
  useFileHandling,
  useBulkUpscale,
  useUser,
} from "../hooks";

export function App() {
  // Global state from atoms
  const [images, setImages] = useAtom(imagesAtom);
  const [selectedImageId, setSelectedImageId] = useAtom(selectedImageIdAtom);
  const [currentDirectory, setCurrentDirectory] = useAtom(currentDirectoryAtom);
  const [errorMessage, setErrorMessage] = useAtom(errorMessageAtom);
  const [saveStatus, setSaveStatus] = useAtom(saveStatusAtom);
  const [settings, setSettings] = useAtom(settingsAtom);
  const setIsCropping = useSetAtom(isCroppingAtom);

  // Derived atoms (read-only)
  const currentIndex = useAtomValue(currentIndexAtom);
  const selectedImage = useAtomValue(selectedImageAtom);
  const captionedCount = useAtomValue(captionedCountAtom);

  // Import state (shared via Jotai)
  const [importState, setImportState] = useAtom(importStateAtom);
  const [importProgress, setImportProgress] = useAtom(importProgressAtom);
  const [importStats, setImportStats] = useAtom(importStatsAtom);
  const [isImportModalOpen, setIsImportModalOpen] =
    useAtom(importModalOpenAtom);
  const setImportCancelled = useSetAtom(importCancelledAtom);

  // Local UI state (not shared)
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [isBulkUpscaleOpen, setIsBulkUpscaleOpen] = useState(false);
  const [isDeleteAllDataOpen, setIsDeleteAllDataOpen] = useState(false);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [settingsSection, setSettingsSection] =
    useState<SettingsSection | null>(() => {
      if (typeof window === "undefined") return null;
      const s = new URLSearchParams(window.location.search).get("settings");
      return s === "general" ||
        s === "upscale" ||
        s === "meta" ||
        s === "profile"
        ? s
        : null;
    });
  const isSettingsOpen = settingsSection !== null;

  // Generation clients
  const stabilityGenerateClient = useRef(new StabilityGenerateClient()).current;

  // User hook for Convex user ID
  const { userId, ensureUser } = useUser();

  // Convex queries and mutations for CSV import
  const metaObjects = useConvexQuery(
    api.metaObjects.listByUser,
    userId ? { userId } : "skip",
  );
  const bulkUpsertMetaValues = useMutation(api.images.bulkUpsertMetaValues);

  const imagesRef = useRef(images);

  // File handling hook
  const {
    fileInputRef,
    directoryHandleRef,
    handleSelectFolder,
    handleSelectSaveFolder,
    handleFolderChange,
    restoreDirectory,
    checkStoredDirectory,
  } = useFileHandling({
    images,
    setImages,
    setSelectedImageId,
    setCurrentDirectory,
    setErrorMessage,
  });

  // Check for stored directory on mount
  const [storedDirName, setStoredDirName] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    checkStoredDirectory().then(setStoredDirName);
  }, [checkStoredDirectory]);

  const handleRestoreDirectory = useCallback(async () => {
    setIsRestoring(true);
    const success = await restoreDirectory();
    setIsRestoring(false);
    if (!success) {
      toast.error("Could not restore previous folder. Please select again.");
      setStoredDirName(null);
    }
  }, [restoreDirectory]);

  // Bulk upscale hook
  const {
    bulkUpscaleProgress,
    handleBulkUpscale,
    ai3UpscaleClient,
    stabilityUpscaleClient,
  } = useBulkUpscale({
    images,
    settings,
    directoryHandleRef,
    setImages,
  });

  // Pane resize hook
  const {
    leftPaneWidth,
    isDragging,
    containerRef,
    handleResizeStart,
    setLeftPaneWidth,
    MIN_PANE_WIDTH,
    MAX_PANE_PERCENT,
  } = usePaneResize();

  // Image deletion hook
  const { handleDeleteImage, handleUndoDelete } = useImageDeletion({
    images,
    selectedImageId,
    currentDirectory,
    allowDeletions: settings.allowDeletions,
    directoryHandleRef,
    setImages,
    setSelectedImageId,
  });

  // Crop undo hook
  const { pendingCrop, handleUndoCrop, handleCancelCrop, handleCropConfirm } =
    useCropUndo({
      images,
      directoryHandleRef,
      setImages,
    });

  // Other hooks
  useImagePreloading(images, selectedImageId, setImages);
  useAutoSave(
    images,
    currentDirectory,
    setSaveStatus,
    setErrorMessage,
    directoryHandleRef,
  );
  useKeyboardNavigation({
    handleDeleteImage,
    handleUndoCrop,
    handleUndoDelete,
  });

  // Pre-warm upscale server cache
  useQuery({
    queryKey: ["upscale-server-status", settings.upscaleServerUrl],
    queryFn: async () => {
      if (!ai3UpscaleClient) return false;
      await ai3UpscaleClient.ping();
      return true;
    },
    enabled: ai3UpscaleClient !== null,
    retry: false,
  });

  useQuery({
    queryKey: ["stability-server-status"],
    queryFn: () => stabilityUpscaleClient.ping(),
    retry: false,
  });

  // Keep ref in sync
  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  // Cleanup URLs on unmount
  useEffect(() => {
    return () => {
      for (const img of imagesRef.current) {
        if (img.thumbnailUrl) URL.revokeObjectURL(img.thumbnailUrl);
        if (img.fullImageUrl) URL.revokeObjectURL(img.fullImageUrl);
      }
    };
  }, []);

  // Sync settings with URL
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (settingsSection) {
      url.searchParams.set("settings", settingsSection);
    } else {
      url.searchParams.delete("settings");
    }
    window.history.replaceState({}, "", url);
  }, [settingsSection]);

  const handleCaptionChange = useCallback(
    (caption: string) => {
      if (!selectedImageId) return;
      setImages((draft) => {
        const idx = draft.findIndex((i) => i.id === selectedImageId);
        if (idx !== -1) draft[idx].caption = caption;
      });
    },
    [selectedImageId, setImages],
  );

  const handleSelectImage = useCallback(
    (id: string) => {
      setSelectedImageId(id);
    },
    [setSelectedImageId],
  );

  const handleRemoveBrokenImage = useCallback(
    (id: string) => {
      const imgIdx = images.findIndex((i) => i.id === id);
      if (imgIdx === -1) return;
      const img = images[imgIdx];
      setImages((draft) => {
        const idx = draft.findIndex((i) => i.id === id);
        if (idx !== -1) draft.splice(idx, 1);
      });
      if (selectedImageId === id) {
        const r = images.filter((i) => i.id !== id);
        setSelectedImageId(r.length > 0 ? r[0].id : null);
      }
      if (img.thumbnailUrl) URL.revokeObjectURL(img.thumbnailUrl);
      if (img.fullImageUrl) URL.revokeObjectURL(img.fullImageUrl);
    },
    [images, selectedImageId, setImages, setSelectedImageId],
  );

  const handleExport = useCallback(
    (format: "json" | "jsonl") =>
      exportCaptions(images, format, directoryHandleRef.current),
    [images, directoryHandleRef],
  );

  const handleImportCsv = useCallback(
    async (files: File[]) => {
      if (files.length === 0) {
        return;
      }

      // Ensure user exists before importing (creates anonymous user if needed)
      const actualUserId = await ensureUser();
      if (!actualUserId) {
        toast.error("Failed to create user. Please try again.");
        return;
      }

      // Filter to active metaObjects only
      const activeMetaObjects: MetaObject[] = (metaObjects ?? [])
        .filter((mo) => mo.active)
        .map((mo) => ({
          _id: mo._id,
          name: mo.name,
          type: mo.type,
          active: mo.active,
          required: mo.required,
          order: mo.order,
        }));

      if (activeMetaObjects.length === 0) {
        toast.error(
          "No active meta fields configured. Add meta fields in Settings > Meta Fields.",
        );
        return;
      }

      setImportState("importing");
      setImportProgress({
        current: 0,
        total: 0,
        currentFile: 1,
        totalFiles: files.length,
        currentFileName: files[0].name,
      });
      setImportCancelled(false);

      // Initialize stats
      const startTime = Date.now();
      setImportStats({
        created: 0,
        updated: 0,
        startTime,
        totalRows: 0,
        filesProcessed: 0,
        totalFiles: files.length,
        errors: [],
      });

      // Aggregate counters across all files
      let grandTotalCreated = 0;
      let grandTotalUpdated = 0;
      let grandTotalRows = 0;
      let grandTotalRowsProcessed = 0;
      const allErrors: string[] = [];

      try {
        // Process each file sequentially
        for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
          const file = files[fileIndex];

          // Check for cancellation before processing each file
          if (store.get(importCancelledAtom)) {
            const endTime = Date.now();
            setImportStats((prev) =>
              prev
                ? {
                    ...prev,
                    endTime,
                    filesProcessed: fileIndex,
                  }
                : null,
            );
            setImportState("cancelled");
            return;
          }

          // Update progress to show current file
          setImportProgress((prev) => ({
            current: prev?.current ?? 0,
            total: prev?.total ?? 0,
            currentFile: fileIndex + 1,
            totalFiles: files.length,
            currentFileName: file.name,
          }));

          // Read and parse CSV
          const csvContent = await readCsvFile(file);
          const { rows, errors: parseErrors } = parseAndValidateCsv(
            csvContent,
            activeMetaObjects,
          );

          // Collect parse errors with file name prefix
          for (const e of parseErrors) {
            allErrors.push(`[${file.name}] Row ${e.row}: ${e.message}`);
          }

          if (rows.length === 0 && parseErrors.length > 0) {
            // All rows in this file failed validation, log and continue to next file
            console.error(`CSV parse errors in ${file.name}:`, parseErrors);
            continue;
          }

          // Update total rows across all files
          grandTotalRows += rows.length;
          setImportStats((prev) =>
            prev
              ? {
                  ...prev,
                  totalRows: grandTotalRows,
                  errors: allErrors,
                }
              : null,
          );

          // Prepare values for bulk upsert
          const values: Array<{
            filename: string;
            metaObjectId: Id<"metaObjects">;
            value: string | number;
          }> = [];

          for (const row of rows) {
            for (const val of row.values) {
              values.push({
                filename: row.filename,
                metaObjectId: val.metaObjectId as Id<"metaObjects">,
                value: val.value,
              });
            }
          }

          if (values.length > 0) {
            // Batch upsert to Convex in chunks to avoid timeout
            const BATCH_SIZE = 50;
            const totalRowsInFile = rows.length;

            // Track unique filenames processed per batch for row count
            let rowsProcessedInFile = 0;
            const processedFilenames = new Set<string>();
            let fileCreated = 0;
            let fileUpdated = 0;

            for (let i = 0; i < values.length; i += BATCH_SIZE) {
              // Check for cancellation before each batch
              if (store.get(importCancelledAtom)) {
                // Finalize stats with end time for cancelled state
                const endTime = Date.now();
                setImportStats((prev) =>
                  prev
                    ? {
                        ...prev,
                        endTime,
                        filesProcessed: fileIndex,
                      }
                    : null,
                );
                setImportState("cancelled");
                return;
              }

              const batch = values.slice(i, i + BATCH_SIZE);

              // Count unique filenames in this batch (each filename = 1 row)
              for (const val of batch) {
                if (!processedFilenames.has(val.filename)) {
                  processedFilenames.add(val.filename);
                  rowsProcessedInFile++;
                  grandTotalRowsProcessed++;
                }
              }
              setImportProgress({
                current: grandTotalRowsProcessed,
                total: grandTotalRows,
                currentFile: fileIndex + 1,
                totalFiles: files.length,
                currentFileName: file.name,
              });

              const result = await bulkUpsertMetaValues({
                values: batch,
                userId: actualUserId,
              });

              // Accumulate created/updated counts
              fileCreated += result.created;
              fileUpdated += result.updated;
              grandTotalCreated += result.created;
              grandTotalUpdated += result.updated;

              // Update stats with cumulative counts
              setImportStats((prev) =>
                prev
                  ? {
                      ...prev,
                      created: grandTotalCreated,
                      updated: grandTotalUpdated,
                    }
                  : null,
              );
            }
          }

          // Update files processed count
          setImportStats((prev) =>
            prev
              ? {
                  ...prev,
                  filesProcessed: fileIndex + 1,
                }
              : null,
          );
        }

        // Finalize stats with end time
        const endTime = Date.now();
        setImportStats((prev) =>
          prev
            ? {
                ...prev,
                endTime,
              }
            : null,
        );

        // Show success/partial success toast
        const fileLabel = files.length === 1 ? "file" : "files";
        if (allErrors.length === 0) {
          toast.success(
            `Imported metadata for ${grandTotalRows} rows from ${files.length} ${fileLabel}`,
          );
        } else {
          toast.success(
            `Imported ${grandTotalRows} rows from ${files.length} ${fileLabel}, ${allErrors.length} errors`,
          );
          // Show details of errors
          console.warn("Import parse errors:", allErrors);
        }

        // Show done state
        setImportState("done");

        // Reset to idle after 10.5 seconds (after popover dismisses)
        setTimeout(() => {
          setImportState("idle");
          setImportProgress(null);
        }, 10500);
      } catch (err) {
        console.error("CSV import error:", err);
        toast.error(
          err instanceof Error ? err.message : "Failed to import CSV",
        );
        setImportState("idle");
        setImportProgress(null);
        setImportStats(null);
      }
    },
    [ensureUser, metaObjects, bulkUpsertMetaValues, setImportStats],
  );

  const handleBulkOverwrite = useCallback(
    (caption: string) => {
      setImages((draft) => {
        for (const img of draft) {
          img.caption = caption;
        }
      });
    },
    [setImages],
  );

  const handleSettingsChange = useCallback(
    (newSettings: Settings) => {
      // atomWithStorage automatically syncs to localStorage
      setSettings(newSettings);
    },
    [setSettings],
  );

  const handleDeleteAllData = useCallback(() => {
    localStorage.clear();
    for (const img of images) {
      if (img.thumbnailUrl) URL.revokeObjectURL(img.thumbnailUrl);
      if (img.fullImageUrl) URL.revokeObjectURL(img.fullImageUrl);
    }
    // Reset all atoms
    setImages([]);
    setSelectedImageId(null);
    setCurrentDirectory(null);
    setErrorMessage(null);
    setSaveStatus(null);
    directoryHandleRef.current = null;
    setIsDeleteAllDataOpen(false);
  }, [
    images,
    setImages,
    setSelectedImageId,
    setCurrentDirectory,
    setErrorMessage,
    setSaveStatus,
    directoryHandleRef,
  ]);

  const handleUpscaleConfirm = useCallback(
    async (
      imageId: string,
      newBlob: Blob,
      newWidth: number,
      newHeight: number,
    ) => {
      const imgIdx = images.findIndex((i) => i.id === imageId);
      if (imgIdx === -1) return;
      const img = images[imgIdx];
      const newFile = new File([newBlob], img.fileName, {
        type: newBlob.type || "image/png",
      });
      const newUrl = URL.createObjectURL(newFile);
      if (img.fullImageUrl) URL.revokeObjectURL(img.fullImageUrl);
      setImages((draft) => {
        const targetIdx = draft.findIndex((i) => i.id === imageId);
        if (targetIdx !== -1) {
          draft[targetIdx].file = newFile;
          draft[targetIdx].fullImageUrl = newUrl;
          draft[targetIdx].width = newWidth;
          draft[targetIdx].height = newHeight;
        }
      });
      if (directoryHandleRef.current) {
        try {
          const fh = await directoryHandleRef.current.getFileHandle(
            img.fileName,
            { create: false },
          );
          const w = await fh.createWritable();
          await w.write(newBlob);
          await w.close();
        } catch {
          /* ignore */
        }
      }
    },
    [images, directoryHandleRef, setImages],
  );

  // Get available local models from ai3 server
  const { data: ai3Capabilities } = useQuery({
    queryKey: ["ai3-capabilities", settings.upscaleServerUrl],
    queryFn: async () => {
      if (!ai3UpscaleClient) return null;
      return ai3UpscaleClient.capabilities();
    },
    enabled: ai3UpscaleClient !== null,
    retry: false,
    staleTime: 60000, // Cache for 1 minute
  });

  const availableLocalModels: LocalGenerateModel[] =
    ai3Capabilities?.capabilities
      ?.filter((c) => c.kind === "image")
      .map((c) => c.model as LocalGenerateModel) ?? [];

  // Helper to save generated file to the current directory
  // Note: Permission should already be granted before calling this
  const saveGeneratedFile = useCallback(
    async (blob: Blob, fileName: string): Promise<void> => {
      const dirHandle = directoryHandleRef.current;

      if (!dirHandle) {
        throw new Error("No folder selected");
      }

      const fileHandle = await dirHandle.getFileHandle(fileName, {
        create: true,
      });
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
    },
    [directoryHandleRef],
  );

  const handleGenerate = useCallback(
    async (options: GenerateOptions) => {
      // Require a folder to be selected first
      if (!directoryHandleRef.current) {
        toast.error("Please select a folder first to save generated images.");
        return;
      }

      // Request write permission NOW while we have user activation
      // (before the async generation call which takes time)
      try {
        const permission = await directoryHandleRef.current.requestPermission({
          mode: "readwrite",
        });
        if (permission !== "granted") {
          toast.error(
            "Write permission denied. Please allow access to save generated images.",
          );
          return;
        }
      } catch (err) {
        console.error("Permission request failed:", err);
        toast.error(
          "Could not get folder permission. Please try selecting the folder again.",
        );
        return;
      }

      setIsGenerating(true);
      const repeatCount = options.repeat ?? 1;
      let lastImageId: string | null = null;
      let successCount = 0;

      try {
        for (let i = 0; i < repeatCount; i++) {
          let blob: Blob;

          if (options.provider === "local") {
            if (!ai3UpscaleClient) {
              throw new Error("Local ai3 server not configured");
            }
            blob = await ai3UpscaleClient.generate({
              prompt: options.prompt,
              negativePrompt: options.negativePrompt,
              width: options.width,
              height: options.height,
              seed: options.seed ? options.seed + i : undefined, // Increment seed for each iteration
              steps: options.steps,
              guidance: options.cfgScale,
              model: options.model as LocalGenerateModel,
            });
          } else {
            blob = await stabilityGenerateClient.generate({
              model: options.model as Parameters<
                typeof stabilityGenerateClient.generate
              >[0]["model"],
              prompt: options.prompt,
              negativePrompt: options.negativePrompt,
              width: options.width,
              height: options.height,
              aspectRatio: options.aspectRatio,
              seed: options.seed ? options.seed + i : undefined, // Increment seed for each iteration
              steps: options.steps,
              cfgScale: options.cfgScale,
            });
          }

          // Create a unique filename for the generated image
          const timestamp = Date.now();
          const fileName = `generated_${timestamp}.png`;

          // Save to the current working directory (same as imported images)
          await saveGeneratedFile(blob, fileName);

          // Create File object from blob
          const file = new File([blob], fileName, { type: "image/png" });
          const fullImageUrl = URL.createObjectURL(file);

          // Generate thumbnail
          const thumbnailUrl = await generateThumbnail(file);

          // Get image dimensions
          const img = new Image();
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = reject;
            img.src = fullImageUrl;
          });

          // Create new ImageData
          const newImage: ImageData = {
            id: `generated-${timestamp}`,
            uuid: generateUUID(),
            fileName,
            namespace: currentDirectory ?? undefined,
            caption: options.prompt, // Use prompt as initial caption
            file,
            thumbnailUrl,
            fullImageUrl,
            width: img.width,
            height: img.height,
          };

          // Add to images array
          setImages((draft) => {
            draft.push(newImage);
          });
          lastImageId = newImage.id;
          successCount++;
        }

        // Select the last generated image
        if (lastImageId) {
          setSelectedImageId(lastImageId);
        }

        const message =
          repeatCount > 1
            ? `Generated ${successCount} images successfully!`
            : "Image generated successfully!";
        toast.success(message);
        setIsGenerateModalOpen(false);
      } catch (err) {
        console.error("Generation failed:", err);
        const errorMsg =
          err instanceof Error ? err.message : "Failed to generate image";
        if (successCount > 0) {
          toast.error(`${errorMsg} (${successCount}/${repeatCount} completed)`);
        } else {
          toast.error(errorMsg);
        }
      } finally {
        setIsGenerating(false);
      }
    },
    [
      ai3UpscaleClient,
      stabilityGenerateClient,
      setImages,
      setSelectedImageId,
      saveGeneratedFile,
      currentDirectory,
    ],
  );

  return (
    <div className="h-screen flex flex-col bg-white">
      <Toaster position="bottom-center" />

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

      <Header
        imageCount={images.length}
        captionedCount={captionedCount}
        saveStatus={saveStatus}
        onExport={handleExport}
        onOpenImportModal={() => setIsImportModalOpen(true)}
        onShowSettings={() => setSettingsSection("general")}
        onBulkEdit={() => setIsBulkEditOpen(true)}
        onBulkUpscale={() => setIsBulkUpscaleOpen(true)}
        bulkUpscaleProgress={bulkUpscaleProgress}
      />

      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportCsv={handleImportCsv}
        onCancelImport={() => setImportCancelled(true)}
        onResetImport={() => {
          setImportState("idle");
          setImportProgress(null);
          setImportStats(null);
        }}
        onOpenMetaSettings={() => {
          setIsImportModalOpen(false);
          setSettingsSection("meta");
        }}
        activeMetaObjects={(metaObjects ?? [])
          .filter((mo) => mo.active)
          .map((mo) => ({
            _id: mo._id,
            name: mo.name,
            type: mo.type,
            active: mo.active,
            required: mo.required,
            order: mo.order,
          }))}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setSettingsSection(null)}
        settings={settings}
        onSettingsChange={handleSettingsChange}
        onDeleteAllData={() => setIsDeleteAllDataOpen(true)}
        activeSection={settingsSection ?? "general"}
        onSectionChange={setSettingsSection}
        userId={userId}
      />

      <KeybindingsModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />

      <BulkEditModal
        isOpen={isBulkEditOpen}
        imageCount={images.length}
        onClose={() => setIsBulkEditOpen(false)}
        onOverwrite={handleBulkOverwrite}
      />

      <BulkUpscaleModal
        isOpen={isBulkUpscaleOpen}
        imageCount={images.length}
        onClose={() => setIsBulkUpscaleOpen(false)}
        onStart={handleBulkUpscale}
      />

      <DeleteAllDataModal
        isOpen={isDeleteAllDataOpen}
        onClose={() => setIsDeleteAllDataOpen(false)}
        onConfirm={handleDeleteAllData}
      />

      <GenerateModal
        isOpen={isGenerateModalOpen}
        onClose={() => setIsGenerateModalOpen(false)}
        onGenerate={handleGenerate}
        isGenerating={isGenerating}
        availableLocalModels={availableLocalModels}
        saveDirName={currentDirectory}
        onSelectFolder={handleSelectSaveFolder}
      />

      {errorMessage && (
        <div className="bg-red-50 border-b border-red-200 px-6 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {images.length === 0 ? (
        <EmptyState
          onSelectFolder={handleSelectFolder}
          storedDirName={storedDirName}
          onRestoreDirectory={handleRestoreDirectory}
          isRestoring={isRestoring}
        />
      ) : (
        <div
          ref={containerRef}
          className={`flex-1 flex overflow-hidden ${isDragging ? "select-none" : ""}`}
        >
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

          <ResizeHandle
            onMouseDown={handleResizeStart}
            onKeyDown={(e) => {
              const container = containerRef.current;
              if (!container) return;
              const step = e.shiftKey ? 5 : 1;
              const minPct = (MIN_PANE_WIDTH / container.offsetWidth) * 100;
              if (e.key === "ArrowLeft") {
                e.preventDefault();
                setLeftPaneWidth((p) => Math.max(minPct, p - step));
              } else if (e.key === "ArrowRight") {
                e.preventDefault();
                setLeftPaneWidth((p) => Math.min(MAX_PANE_PERCENT, p + step));
              }
            }}
          />

          <div className="flex-1 overflow-hidden min-w-0">
            <ImagePreview
              selectedImage={selectedImage}
              onUpscaleConfirm={handleUpscaleConfirm}
              onCropConfirm={handleCropConfirm}
              upscaleProviders={settings.upscaleProviders}
              upscaleServerUrl={settings.upscaleServerUrl}
              hasPendingCrop={
                pendingCrop !== null &&
                pendingCrop.imageId === selectedImage?.id
              }
              onCancelCrop={handleCancelCrop}
              onCropModeChange={setIsCropping}
            />
          </div>
        </div>
      )}

      <Filmstrip
        images={images}
        selectedImageId={selectedImageId}
        onSelectImage={handleSelectImage}
        onRemoveBrokenImage={handleRemoveBrokenImage}
        onAddClick={() => setIsGenerateModalOpen(true)}
      />
    </div>
  );
}
