import { useState, useEffect, useCallback, useRef } from "react";
import type { Crop as CropState, PixelCrop } from "react-image-crop";
import type { ImageData } from "../types";
import { cropImage } from "../lib/image-utils";

export type CropMode = "idle" | "cropping";

interface UseCropOptions {
  selectedImage: ImageData | null;
  upscaleStateIsIdle: boolean;
  onCropConfirm?: (
    imageId: string,
    newBlob: Blob,
    newWidth: number,
    newHeight: number,
  ) => Promise<void>;
}

export function useCrop({
  selectedImage,
  upscaleStateIsIdle,
  onCropConfirm,
}: UseCropOptions) {
  const [cropMode, setCropMode] = useState<CropMode>("idle");
  const [cropAspect, setCropAspect] = useState<number | undefined>(undefined);
  const [crop, setCrop] = useState<CropState>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const [lastCropAspect, setLastCropAspect] = useState<number | undefined>(1);
  const cropImageRef = useRef<HTMLImageElement>(null);

  const handleStartCrop = useCallback((aspect: number | undefined) => {
    setCropAspect(aspect);
    setLastCropAspect(aspect);

    const image = cropImageRef.current;
    const imageWidth = image?.naturalWidth || 0;
    const imageHeight = image?.naturalHeight || 0;

    if (aspect !== undefined && imageWidth > 0 && imageHeight > 0) {
      const imageAspect = imageWidth / imageHeight;

      let cropWidth: number;
      let cropHeight: number;
      let x: number;
      let y: number;

      if (aspect <= imageAspect) {
        cropHeight = 100;
        cropWidth = (aspect / imageAspect) * 100;
        x = (100 - cropWidth) / 2;
        y = 0;
      } else {
        cropWidth = 100;
        cropHeight = (imageAspect / aspect) * 100;
        x = 0;
        y = (100 - cropHeight) / 2;
      }

      setCrop({
        unit: "%",
        x,
        y,
        width: cropWidth,
        height: cropHeight,
      });
    } else {
      setCrop({
        unit: "%",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      });
    }

    setCompletedCrop(null);
    setCropMode("cropping");
  }, []);

  const handleCancelCrop = useCallback(() => {
    setCropMode("idle");
    setCompletedCrop(null);
  }, []);

  const handleApplyCrop = useCallback(async () => {
    if (!selectedImage || !onCropConfirm || !cropImageRef.current) return;

    const image = cropImageRef.current;

    let pixelCrop =
      completedCrop && completedCrop.width > 0 && completedCrop.height > 0
        ? completedCrop
        : null;

    if (!pixelCrop && crop && crop.width > 0 && crop.height > 0) {
      if (crop.unit === "%") {
        pixelCrop = {
          x: (crop.x / 100) * image.width,
          y: (crop.y / 100) * image.height,
          width: (crop.width / 100) * image.width,
          height: (crop.height / 100) * image.height,
          unit: "px",
        };
      } else {
        pixelCrop = { ...crop, unit: "px" };
      }
    }

    if (!pixelCrop || pixelCrop.width < 1 || pixelCrop.height < 1) return;

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    let finalX = Math.round(pixelCrop.x * scaleX);
    let finalY = Math.round(pixelCrop.y * scaleY);
    let finalWidth = Math.round(pixelCrop.width * scaleX);
    let finalHeight = Math.round(pixelCrop.height * scaleY);

    if (cropAspect !== undefined) {
      if (cropAspect === 1) {
        const size = Math.min(finalWidth, finalHeight);
        finalWidth = size;
        finalHeight = size;
      } else {
        finalHeight = Math.round(finalWidth / cropAspect);
      }

      if (finalX + finalWidth > image.naturalWidth) {
        finalX = image.naturalWidth - finalWidth;
      }
      if (finalY + finalHeight > image.naturalHeight) {
        finalY = image.naturalHeight - finalHeight;
      }
    }

    try {
      const { blob, width, height } = await cropImage(selectedImage.file, {
        x: finalX,
        y: finalY,
        width: finalWidth,
        height: finalHeight,
      });

      await onCropConfirm(selectedImage.id, blob, width, height);

      setCropMode("idle");
      setCompletedCrop(null);
    } catch (err) {
      console.error("Failed to crop image:", err);
    }
  }, [selectedImage, completedCrop, crop, cropAspect, onCropConfirm]);

  // Keyboard handler for crop mode
  useEffect(() => {
    if (cropMode !== "cropping") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === "r") {
        e.preventDefault();
        handleApplyCrop();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleCancelCrop();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cropMode, handleApplyCrop, handleCancelCrop]);

  // "r" key to start cropping
  useEffect(() => {
    if (
      !selectedImage ||
      !selectedImage.fullImageUrl ||
      cropMode === "cropping" ||
      !upscaleStateIsIdle
    )
      return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
        return;
      }

      if (e.key === "r" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        handleStartCrop(lastCropAspect);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    selectedImage,
    cropMode,
    upscaleStateIsIdle,
    lastCropAspect,
    handleStartCrop,
  ]);

  // Reset crop mode when image changes
  useEffect(() => {
    if (selectedImage) {
      setCropMode("idle");
      setCompletedCrop(null);
    }
  }, [selectedImage]);

  return {
    cropMode,
    cropAspect,
    crop,
    completedCrop,
    cropImageRef,
    setCrop,
    setCompletedCrop,
    handleStartCrop,
    handleCancelCrop,
    handleApplyCrop,
  };
}
