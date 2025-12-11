import { useRef, useState, useEffect, useCallback } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
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
  SettingsModal,
  DeleteAllDataModal,
  type SettingsSection,
} from "./index";
import { ResizeHandle } from "./ResizeHandle";
import type { Settings } from "../lib/settings";
import { exportCaptions } from "../lib/export";
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

  // Local UI state (not shared)
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

  const imagesRef = useRef(images);

  // File handling hook
  const {
    fileInputRef,
    directoryHandleRef,
    handleSelectFolder,
    handleFolderChange,
  } = useFileHandling({
    images,
    setImages,
    setSelectedImageId,
    setCurrentDirectory,
    setErrorMessage,
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
                onCropModeChange={setIsCropping}
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
