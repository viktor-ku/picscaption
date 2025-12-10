import { useState, useCallback, useMemo } from "react";
import type { ImageData, BulkUpscaleProgress } from "../types";
import type { Settings } from "../lib/settings";
import { UpscaleClient } from "../lib/ai3-upscale-client";
import { StabilityUpscaleClient } from "../lib/stability-upscale-client";
import { resizeImage } from "../lib/image-utils";

interface UseBulkUpscaleOptions {
  images: ImageData[];
  settings: Settings;
  directoryHandleRef: React.RefObject<FileSystemDirectoryHandle | null>;
  setImages: React.Dispatch<React.SetStateAction<ImageData[]>>;
}

export function useBulkUpscale({
  images,
  settings,
  directoryHandleRef,
  setImages,
}: UseBulkUpscaleOptions) {
  const [bulkUpscaleProgress, setBulkUpscaleProgress] =
    useState<BulkUpscaleProgress | null>(null);

  const ai3UpscaleClient = useMemo(() => {
    const url = settings.upscaleServerUrl?.trim();
    return url ? new UpscaleClient(url) : null;
  }, [settings.upscaleServerUrl]);

  const stabilityUpscaleClient = useMemo(() => {
    const key = settings.stabilityApiKey?.trim();
    return new StabilityUpscaleClient(key || undefined);
  }, [settings.stabilityApiKey]);

  const tryUpscaleWithFallback = useCallback(
    async (
      sourceBlob: Blob,
    ): Promise<{ blob: Blob; scaleFactor: number } | null> => {
      const enabledProviders = settings.upscaleProviders.filter(
        (p) => p.enabled,
      );
      for (const provider of enabledProviders) {
        try {
          if (provider.id === "ai3" && ai3UpscaleClient) {
            const blob = await ai3UpscaleClient.upscale(sourceBlob, {
              scale: 2,
            });
            return { blob, scaleFactor: 2 };
          }
          if (provider.id === "stability") {
            const blob = await stabilityUpscaleClient.upscale(sourceBlob);
            return { blob, scaleFactor: 4 };
          }
        } catch (err) {
          console.warn(
            `Upscale with ${provider.id} failed, trying next...`,
            err,
          );
        }
      }
      return null;
    },
    [settings.upscaleProviders, ai3UpscaleClient, stabilityUpscaleClient],
  );

  const handleBulkUpscale = useCallback(
    async (targetWidth: number, targetHeight: number) => {
      const enabledProviders = settings.upscaleProviders.filter(
        (p) => p.enabled,
      );
      if (enabledProviders.length === 0 || images.length === 0) return;

      setBulkUpscaleProgress({ current: 0, total: images.length });

      for (let i = 0; i < images.length; i++) {
        const imageData = images[i];
        const origW = imageData.width ?? 0;
        const origH = imageData.height ?? 0;

        if (
          origW === 0 ||
          origH === 0 ||
          (origW >= targetWidth && origH >= targetHeight)
        ) {
          setBulkUpscaleProgress({ current: i + 1, total: images.length });
          continue;
        }

        try {
          let sourceBlob: Blob = imageData.file;
          let currentWidth = origW;
          let currentHeight = origH;

          for (let iter = 0; iter < 5; iter++) {
            if (currentWidth >= targetWidth && currentHeight >= targetHeight)
              break;
            const result = await tryUpscaleWithFallback(sourceBlob);
            if (!result) break;
            sourceBlob = result.blob;
            currentWidth *= result.scaleFactor;
            currentHeight *= result.scaleFactor;
          }

          const finalBlob =
            currentWidth >= targetWidth && currentHeight >= targetHeight
              ? await resizeImage(sourceBlob, targetWidth, targetHeight)
              : sourceBlob;
          const finalWidth =
            currentWidth >= targetWidth ? targetWidth : currentWidth;
          const finalHeight =
            currentHeight >= targetHeight ? targetHeight : currentHeight;

          const newFile = new File([finalBlob], imageData.fileName, {
            type: finalBlob.type || "image/png",
          });
          const newFullImageUrl = URL.createObjectURL(newFile);

          if (imageData.fullImageUrl)
            URL.revokeObjectURL(imageData.fullImageUrl);

          setImages((prev) =>
            prev.map((img) =>
              img.id === imageData.id
                ? {
                    ...img,
                    file: newFile,
                    fullImageUrl: newFullImageUrl,
                    width: finalWidth,
                    height: finalHeight,
                  }
                : img,
            ),
          );

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
              console.error(`Failed to save ${imageData.fileName}:`, err);
            }
          }
        } catch (err) {
          console.error(`Failed to upscale ${imageData.fileName}:`, err);
        }

        setBulkUpscaleProgress({ current: i + 1, total: images.length });
      }

      setBulkUpscaleProgress(null);
    },
    [
      settings.upscaleProviders,
      tryUpscaleWithFallback,
      images,
      directoryHandleRef,
      setImages,
    ],
  );

  return {
    bulkUpscaleProgress,
    handleBulkUpscale,
    ai3UpscaleClient,
    stabilityUpscaleClient,
  };
}
