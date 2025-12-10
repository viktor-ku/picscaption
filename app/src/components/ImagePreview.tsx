import { useState, useEffect, useRef, useTransition } from "react";
import { ImageIcon, Loader2, Check, X } from "lucide-react";
import ReactCrop from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import type { ImageData } from "../types";
import type { UpscaleProviderConfig } from "../lib/settings";
import { useUpscale, useCrop } from "../hooks";
import { ImageActionBar } from "./ImageActionBar";

interface ImagePreviewProps {
  selectedImage: ImageData | null;
  onUpscaleConfirm?: (
    imageId: string,
    newBlob: Blob,
    newWidth: number,
    newHeight: number,
  ) => Promise<void>;
  onCropConfirm?: (
    imageId: string,
    newBlob: Blob,
    newWidth: number,
    newHeight: number,
  ) => Promise<void>;
  upscaleProviders?: UpscaleProviderConfig[];
  upscaleServerUrl?: string;
  stabilityApiKey?: string;
  hasPendingCrop?: boolean;
  onCancelCrop?: () => void;
}

export function ImagePreview({
  selectedImage,
  onUpscaleConfirm,
  onCropConfirm,
  upscaleProviders = [],
  upscaleServerUrl,
  stabilityApiKey,
  hasPendingCrop,
  onCancelCrop,
}: ImagePreviewProps) {
  const [fullImageReady, setFullImageReady] = useState(false);
  const [, startTransition] = useTransition();
  const selectedImageId = selectedImage?.id ?? "";
  const imageLoaderRef = useRef<HTMLImageElement | null>(null);

  const {
    upscaleData: currentUpscaleData,
    successToast,
    customWidth,
    customHeight,
    widthInputRef,
    setCustomWidth,
    setCustomHeight,
    handleUpscale,
    handleKeep,
    handleDiscard,
    handleCustomResize,
    hasAnyEnabledProvider,
    isAnyProviderAvailable,
    availableScales,
  } = useUpscale({
    selectedImage,
    upscaleProviders,
    upscaleServerUrl,
    stabilityApiKey,
    onUpscaleConfirm,
  });

  const {
    cropMode,
    cropAspect,
    crop,
    completedCrop: _completedCrop,
    cropImageRef,
    setCrop,
    setCompletedCrop,
    handleStartCrop,
  } = useCrop({
    selectedImage,
    upscaleStateIsIdle: currentUpscaleData.state === "idle",
    onCropConfirm,
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: selectedImageId needed for cache invalidation on image switch
  useEffect(() => {
    setFullImageReady(false);

    if (imageLoaderRef.current) {
      imageLoaderRef.current.src = "";
      imageLoaderRef.current = null;
    }

    const displayUrl = selectedImage?.fullImageUrl;
    if (!displayUrl) return;

    const loader = new Image();
    imageLoaderRef.current = loader;

    loader.onload = () => {
      if (imageLoaderRef.current !== loader) return;
      startTransition(() => setFullImageReady(true));
    };

    loader.src = displayUrl;

    return () => {
      loader.src = "";
      if (imageLoaderRef.current === loader) imageLoaderRef.current = null;
    };
  }, [selectedImageId, selectedImage?.fullImageUrl]);

  if (!selectedImage) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gray-50 text-center">
        <ImageIcon className="w-20 h-20 text-gray-300 mb-4" />
        <p className="text-gray-400">Select a folder to begin</p>
      </div>
    );
  }

  const isUpscaling = currentUpscaleData.state === "upscaling";
  const isConfirming = currentUpscaleData.state === "confirming";
  const isSaving = currentUpscaleData.state === "saving";
  const hasFullImage = selectedImage.fullImageUrl !== null;
  const canUpscale =
    hasAnyEnabledProvider &&
    isAnyProviderAvailable &&
    hasFullImage &&
    currentUpscaleData.state === "idle";

  const displayUrl =
    (isConfirming || isSaving) && currentUpscaleData.url
      ? currentUpscaleData.url
      : selectedImage.fullImageUrl;

  const showThumbnailPlaceholder = !fullImageReady || !displayUrl;

  return (
    <div className="h-full bg-preview-bg flex flex-col">
      <ImageActionBar
        hasAnyEnabledProvider={hasAnyEnabledProvider}
        isAnyProviderAvailable={isAnyProviderAvailable}
        availableScales={availableScales}
        canUpscale={canUpscale}
        upscaleState={currentUpscaleData.state}
        customWidth={customWidth}
        customHeight={customHeight}
        widthInputRef={widthInputRef}
        onCustomWidthChange={setCustomWidth}
        onCustomHeightChange={setCustomHeight}
        onUpscale={handleUpscale}
        onCustomResize={handleCustomResize}
        hasFullImage={hasFullImage}
        hasPendingCrop={hasPendingCrop}
        cropMode={cropMode}
        onStartCrop={handleStartCrop}
        onCancelCrop={onCancelCrop}
      />

      <div className="flex-1 flex items-center justify-center p-4 relative min-h-0">
        {showThumbnailPlaceholder &&
          cropMode !== "cropping" &&
          selectedImage.thumbnailUrl && (
            <div className="absolute inset-0 p-4 flex items-center justify-center">
              <img
                src={selectedImage.thumbnailUrl}
                alt={selectedImage.fileName}
                className="w-full h-full object-contain shadow-2xl shadow-black/40"
              />
            </div>
          )}

        {displayUrl && fullImageReady && (
          <img
            ref={cropImageRef}
            src={displayUrl}
            alt={selectedImage.fileName}
            className="max-w-full max-h-full object-contain shadow-2xl shadow-black/40"
            style={{
              visibility: cropMode === "cropping" ? "hidden" : "visible",
            }}
          />
        )}

        {cropMode === "cropping" && cropImageRef.current && displayUrl && (
          <div
            className="absolute"
            style={{
              width: cropImageRef.current.offsetWidth,
              height: cropImageRef.current.offsetHeight,
            }}
          >
            <ReactCrop
              crop={crop}
              onChange={(c) => setCrop(c)}
              onComplete={(c) => setCompletedCrop(c)}
              aspect={cropAspect}
            >
              <img
                src={displayUrl}
                alt={selectedImage.fileName}
                style={{
                  width: cropImageRef.current.offsetWidth,
                  height: cropImageRef.current.offsetHeight,
                }}
                className="shadow-2xl shadow-black/40"
              />
            </ReactCrop>
          </div>
        )}

        {cropMode === "cropping" && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/70 text-white text-sm rounded-lg backdrop-blur-sm flex items-center gap-4 z-10">
            <span>
              Press{" "}
              <kbd className="px-1.5 py-0.5 bg-white/20 rounded text-xs font-mono mx-1">
                Enter
              </kbd>{" "}
              to apply
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-white/20 rounded text-xs font-mono mx-1">
                Esc
              </kbd>{" "}
              to cancel
            </span>
          </div>
        )}

        {isUpscaling && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-sm">
            <div className="bg-white/95 rounded-xl px-6 py-4 flex items-center gap-3 shadow-2xl">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="text-gray-800 font-medium">
                Upscaling image...
              </span>
            </div>
          </div>
        )}

        {(isConfirming || isSaving) && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-3">
            <button
              type="button"
              onClick={handleDiscard}
              disabled={isSaving}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gray-800/90 hover:bg-gray-800 text-white font-medium shadow-xl backdrop-blur-sm transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              <X className="w-5 h-5" />
              <span>Discard</span>
            </button>
            <button
              type="button"
              onClick={handleKeep}
              disabled={isSaving}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-medium shadow-xl backdrop-blur-sm transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  <span>Keep & Save</span>
                </>
              )}
            </button>
          </div>
        )}

        {isConfirming && currentUpscaleData.dimensions && (
          <div className="absolute top-4 left-4 px-3 py-2 bg-green-600/90 text-white text-sm rounded-lg shadow-lg backdrop-blur-sm">
            Upscaled: {currentUpscaleData.dimensions.width} ×{" "}
            {currentUpscaleData.dimensions.height}
          </div>
        )}

        {currentUpscaleData.error && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 px-4 py-3 bg-red-600 text-white text-sm rounded-lg shadow-xl">
            {currentUpscaleData.error}
          </div>
        )}

        {successToast && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 px-4 py-3 bg-green-600 text-white text-sm rounded-lg shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-200">
            Upscaled from {successToast.from.width}×{successToast.from.height}{" "}
            to {successToast.to.width}×{successToast.to.height}
          </div>
        )}
      </div>
    </div>
  );
}
