import { useRef, useState, useEffect, useCallback } from "react";
import { Toaster } from "react-hot-toast";
import { useQuery } from "@tanstack/react-query";
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
  type SettingsSection,
} from "./index";
import { ResizeHandle } from "./ResizeHandle";
import type { ImageData, SaveStatus, PendingRestoreData } from "../types";
import { deleteCaptions, clearAllData, makeKey } from "../lib/storage";
import { getSettings, saveSettings, type Settings } from "../lib/settings";
import { exportCaptions } from "../lib/export";
import {
  useImagePreloading,
  useAutoSave,
  usePaneResize,
  useImageDeletion,
  useCropUndo,
  useKeyboardNavigation,
  useFileHandling,
  useBulkUpscale,
} from "../hooks";

export function App() {
  const [images, setImages] = useState<ImageData[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [currentDirectory, setCurrentDirectory] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [isBulkUpscaleOpen, setIsBulkUpscaleOpen] = useState(false);
  const [isDeleteAllDataOpen, setIsDeleteAllDataOpen] = useState(false);
  const [settingsSection, setSettingsSection] =
    useState<SettingsSection | null>(() => {
      if (typeof window === "undefined") return null;
      const s = new URLSearchParams(window.location.search).get("settings");
      return s === "general" || s === "upscale" || s === "profile" ? s : null;
    });
  const isSettingsOpen = settingsSection !== null;
  const [settings, setSettings] = useState<Settings>(() => {
    if (typeof window === "undefined") {
      return {
        upscaleProviders: [
          { id: "ai3" as const, enabled: true },
          { id: "stability" as const, enabled: false },
        ],
        upscaleServerUrl: "",
        stabilityApiKey: "",
        allowDeletions: true,
        profileName: "",
        profileEmail: "",
      };
    }
    return getSettings();
  });

  const [saveStatus, setSaveStatus] = useState<SaveStatus>(null);
  const [pendingRestore, setPendingRestore] =
    useState<PendingRestoreData | null>(null);
  const imagesRef = useRef<ImageData[]>(images);

  // File handling hook
  const {
    fileInputRef,
    directoryHandleRef,
    finalizeImages,
    handleSelectFolder,
    handleFolderChange,
  } = useFileHandling({
    images,
    setImages,
    setSelectedImageId,
    setCurrentDirectory,
    setErrorMessage,
    setPendingRestore,
  });

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

  const currentIndex = images.findIndex((img) => img.id === selectedImageId);
  const selectedImage = currentIndex >= 0 ? images[currentIndex] : null;

  // Image deletion hook
  const {
    pendingDeletion,
    setPendingDeletion,
    handleDeleteImage,
    handleUndoDelete,
  } = useImageDeletion({
    images,
    selectedImageId,
    currentDirectory,
    allowDeletions: settings.allowDeletions,
    directoryHandleRef,
    setImages,
    setSelectedImageId,
  });

  // Crop undo hook
  const {
    pendingCrop,
    setPendingCrop,
    handleUndoCrop,
    handleCancelCrop,
    handleCropConfirm,
  } = useCropUndo({
    images,
    directoryHandleRef,
    setImages,
  });

  // Other hooks
  useImagePreloading(images, selectedImageId, setImages);
  useAutoSave(images, currentDirectory, setSaveStatus, setErrorMessage);

  useKeyboardNavigation({
    images,
    currentIndex,
    pendingCrop,
    pendingDeletion,
    setSelectedImageId,
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
    queryKey: ["stability-server-status", settings.stabilityApiKey],
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

  const handleRestoreHistory = useCallback(() => {
    if (!pendingRestore) return;
    const { images: newImages, directory, storedCaptions } = pendingRestore;
    for (const img of newImages) {
      const stored = storedCaptions.get(img.fileName);
      if (stored) img.caption = stored.caption;
    }
    finalizeImages(newImages, directory);
    setPendingRestore(null);
  }, [pendingRestore, finalizeImages]);

  const handleDiscardHistory = useCallback(async () => {
    if (!pendingRestore) return;
    const { images: newImages, directory, storedCaptions } = pendingRestore;
    try {
      const keysToDelete = Array.from(storedCaptions.values()).map(
        (c) => c.key,
      );
      await deleteCaptions(keysToDelete);
    } catch (err) {
      console.error("Failed to delete from IndexedDB:", err);
    }
    finalizeImages(newImages, directory);
    setPendingRestore(null);
  }, [pendingRestore, finalizeImages]);

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

  const handleRemoveBrokenImage = useCallback(
    async (id: string) => {
      const img = images.find((i) => i.id === id);
      if (!img) return;
      setImages((prev) => prev.filter((i) => i.id !== id));
      if (selectedImageId === id) {
        const r = images.filter((i) => i.id !== id);
        setSelectedImageId(r.length > 0 ? r[0].id : null);
      }
      if (currentDirectory) {
        try {
          await deleteCaptions([makeKey(currentDirectory, img.fileName)]);
        } catch {
          /* ignore */
        }
      }
      if (img.thumbnailUrl) URL.revokeObjectURL(img.thumbnailUrl);
      if (img.fullImageUrl) URL.revokeObjectURL(img.fullImageUrl);
    },
    [images, selectedImageId, currentDirectory],
  );

  const handleExport = useCallback(
    (format: "json" | "jsonl") =>
      exportCaptions(images, format, directoryHandleRef.current),
    [images, directoryHandleRef],
  );

  const handleBulkOverwrite = useCallback((caption: string) => {
    setImages((prev) => prev.map((img) => ({ ...img, caption })));
  }, []);

  const handleSettingsChange = useCallback((newSettings: Settings) => {
    setSettings(newSettings);
    saveSettings(newSettings);
  }, []);

  const handleDeleteAllData = useCallback(async () => {
    try {
      await clearAllData();
      localStorage.clear();
      for (const img of images) {
        if (img.thumbnailUrl) URL.revokeObjectURL(img.thumbnailUrl);
        if (img.fullImageUrl) URL.revokeObjectURL(img.fullImageUrl);
      }
      setImages([]);
      setSelectedImageId(null);
      setCurrentDirectory(null);
      setErrorMessage(null);
      setSaveStatus(null);
      setPendingRestore(null);
      setPendingDeletion(null);
      setPendingCrop(null);
      setSettings(getSettings());
      directoryHandleRef.current = null;
      setIsDeleteAllDataOpen(false);
    } catch {
      setErrorMessage("Failed to delete all data");
    }
  }, [images, setPendingDeletion, setPendingCrop, directoryHandleRef]);

  const handleUpscaleConfirm = useCallback(
    async (
      imageId: string,
      newBlob: Blob,
      newWidth: number,
      newHeight: number,
    ) => {
      const img = images.find((i) => i.id === imageId);
      if (!img) return;
      const newFile = new File([newBlob], img.fileName, {
        type: newBlob.type || "image/png",
      });
      const newUrl = URL.createObjectURL(newFile);
      if (img.fullImageUrl) URL.revokeObjectURL(img.fullImageUrl);
      setImages((prev) =>
        prev.map((i) =>
          i.id === imageId
            ? {
                ...i,
                file: newFile,
                fullImageUrl: newUrl,
                width: newWidth,
                height: newHeight,
              }
            : i,
        ),
      );
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
    [images, directoryHandleRef],
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
        captionedCount={
          images.filter((img) => img.caption.trim() !== "").length
        }
        saveStatus={saveStatus}
        onExport={handleExport}
        onShowSettings={() => setSettingsSection("general")}
        onBulkEdit={() => setIsBulkEditOpen(true)}
        onBulkUpscale={() => setIsBulkUpscaleOpen(true)}
        bulkUpscaleProgress={bulkUpscaleProgress}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setSettingsSection(null)}
        settings={settings}
        onSettingsChange={handleSettingsChange}
        onDeleteAllData={() => setIsDeleteAllDataOpen(true)}
        activeSection={settingsSection ?? "general"}
        onSectionChange={setSettingsSection}
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

      <RestoreHistoryModal
        isOpen={pendingRestore !== null}
        matchedCount={pendingRestore?.matchedCount ?? 0}
        totalCount={pendingRestore?.images.length ?? 0}
        onRestore={handleRestoreHistory}
        onDiscard={handleDiscardHistory}
      />

      {errorMessage && (
        <div className="bg-red-50 border-b border-red-200 px-6 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {images.length === 0 ? (
        <EmptyState onSelectFolder={handleSelectFolder} />
      ) : (
        <>
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
                stabilityApiKey={settings.stabilityApiKey}
                hasPendingCrop={
                  pendingCrop !== null &&
                  pendingCrop.imageId === selectedImage?.id
                }
                onCancelCrop={handleCancelCrop}
              />
            </div>
          </div>

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
