import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ImageData } from "../types";
import { UpscaleClient } from "../lib/ai3-upscale-client";
import { StabilityUpscaleClient } from "../lib/stability-upscale-client";
import type { UpscaleProviderConfig } from "../lib/settings";
import { resizeImage } from "../lib/image-utils";

export type UpscaleState = "idle" | "upscaling" | "confirming" | "saving";

export interface UpscaleData {
  forImageId: string;
  state: UpscaleState;
  blob: Blob | null;
  url: string | null;
  originalDimensions: { width: number; height: number } | null;
  dimensions: { width: number; height: number } | null;
  error: string | null;
}

interface SuccessToast {
  from: { width: number; height: number };
  to: { width: number; height: number };
}

const INITIAL_UPSCALE_DATA: Omit<UpscaleData, "forImageId"> = {
  state: "idle",
  blob: null,
  url: null,
  originalDimensions: null,
  dimensions: null,
  error: null,
};

interface UseUpscaleOptions {
  selectedImage: ImageData | null;
  upscaleProviders: UpscaleProviderConfig[];
  upscaleServerUrl?: string;
  stabilityApiKey?: string;
  onUpscaleConfirm?: (
    imageId: string,
    newBlob: Blob,
    newWidth: number,
    newHeight: number,
  ) => Promise<void>;
}

export function useUpscale({
  selectedImage,
  upscaleProviders,
  upscaleServerUrl,
  stabilityApiKey,
  onUpscaleConfirm,
}: UseUpscaleOptions) {
  const [upscaleData, setUpscaleData] = useState<UpscaleData>({
    forImageId: "",
    ...INITIAL_UPSCALE_DATA,
  });
  const [successToast, setSuccessToast] = useState<SuccessToast | null>(null);
  const [customWidth, setCustomWidth] = useState(
    () => localStorage.getItem("picscaption-custom-width") ?? "",
  );
  const [customHeight, setCustomHeight] = useState(
    () => localStorage.getItem("picscaption-custom-height") ?? "",
  );
  const widthInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const selectedImageId = selectedImage?.id ?? "";

  // Get enabled providers in order
  const enabledProviders = useMemo(
    () => upscaleProviders.filter((p) => p.enabled),
    [upscaleProviders],
  );
  const hasUpscaleUrl = Boolean(upscaleServerUrl?.trim());
  const hasAnyEnabledProvider = enabledProviders.length > 0;

  // Create AI3 client as memoized value
  const ai3Client = useMemo(() => {
    if (hasUpscaleUrl && upscaleServerUrl) {
      return new UpscaleClient(upscaleServerUrl);
    }
    return null;
  }, [hasUpscaleUrl, upscaleServerUrl]);

  // Create Stability client as memoized value
  const stabilityClient = useMemo(() => {
    const key = stabilityApiKey?.trim();
    return new StabilityUpscaleClient(key || undefined);
  }, [stabilityApiKey]);

  // Check if providers are enabled
  const ai3Enabled = enabledProviders.some((p) => p.id === "ai3");
  const stabilityEnabled = enabledProviders.some((p) => p.id === "stability");

  // Query for AI3 server capabilities
  const { data: ai3Capabilities } = useQuery({
    queryKey: ["upscale-server-capabilities", upscaleServerUrl],
    queryFn: async () => {
      if (!ai3Client) return null;
      try {
        await ai3Client.ping();
        const { capabilities } = await ai3Client.capabilities();
        return capabilities;
      } catch {
        return null;
      }
    },
    enabled: ai3Enabled && hasUpscaleUrl && ai3Client !== null,
    refetchInterval: 60_000,
    retry: false,
  });

  // Query for Stability API availability
  const { data: stabilityAvailable } = useQuery({
    queryKey: ["stability-server-status", stabilityApiKey],
    queryFn: async () => {
      return stabilityClient.ping();
    },
    enabled: stabilityEnabled,
    refetchInterval: 60_000,
    retry: false,
  });

  // Determine if any provider is available
  const ai3Available =
    ai3Capabilities !== null && ai3Capabilities !== undefined;
  const isAnyProviderAvailable =
    (ai3Enabled && ai3Available) ||
    (stabilityEnabled && stabilityAvailable === true);

  // Collect available scales from enabled providers
  const availableScales: (2 | 4)[] = useMemo(() => {
    const scales = new Set<2 | 4>();
    for (const provider of enabledProviders) {
      if (provider.id === "ai3" && ai3Available && ai3Capabilities) {
        for (const s of ai3Capabilities) scales.add(s);
      }
      if (provider.id === "stability" && stabilityAvailable) {
        scales.add(4);
      }
    }
    return Array.from(scales).sort((a, b) => a - b);
  }, [enabledProviders, ai3Available, ai3Capabilities, stabilityAvailable]);

  // Derive upscale state - reset when image changes
  const currentUpscaleData = useMemo(
    () =>
      upscaleData.forImageId === selectedImageId
        ? upscaleData
        : { forImageId: selectedImageId, ...INITIAL_UPSCALE_DATA },
    [upscaleData, selectedImageId],
  );

  // Clean up old URL when upscale data changes to a new image
  const previousUrlRef = useRef<string | null>(null);
  useEffect(() => {
    if (
      upscaleData.forImageId !== selectedImageId &&
      previousUrlRef.current &&
      previousUrlRef.current !== upscaleData.url
    ) {
      URL.revokeObjectURL(previousUrlRef.current);
    }
    previousUrlRef.current = upscaleData.url;
  }, [upscaleData, selectedImageId]);

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (previousUrlRef.current) {
        URL.revokeObjectURL(previousUrlRef.current);
      }
    };
  }, []);

  // Auto-dismiss success toast after 3 seconds
  useEffect(() => {
    if (successToast) {
      const timer = setTimeout(() => {
        setSuccessToast(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [successToast]);

  // Clear success toast when image changes
  useEffect(() => {
    if (selectedImage) {
      setSuccessToast(null);
    }
  }, [selectedImage]);

  // Try upscale with providers in order (fallback)
  const tryUpscaleWithProviders = useCallback(
    async (sourceBlob: Blob, scale: 2 | 4): Promise<Blob | null> => {
      for (const provider of enabledProviders) {
        try {
          if (provider.id === "ai3" && ai3Client) {
            return await ai3Client.upscale(sourceBlob, { scale });
          }
          if (provider.id === "stability" && stabilityClient) {
            return await stabilityClient.upscale(sourceBlob);
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
    [enabledProviders, ai3Client, stabilityClient],
  );

  // Helper to try upscale with fallback and return scale factor
  const tryUpscaleWithFallback = useCallback(
    async (
      sourceBlob: Blob,
    ): Promise<{ blob: Blob; scaleFactor: number } | null> => {
      for (const provider of enabledProviders) {
        try {
          if (provider.id === "ai3" && ai3Client) {
            const blob = await ai3Client.upscale(sourceBlob, { scale: 2 });
            return { blob, scaleFactor: 2 };
          }
          if (provider.id === "stability" && stabilityClient) {
            const blob = await stabilityClient.upscale(sourceBlob);
            return { blob, scaleFactor: 4 };
          }
        } catch (err) {
          console.warn(
            `Custom resize upscale with ${provider.id} failed, trying next...`,
            err,
          );
        }
      }
      return null;
    },
    [enabledProviders, ai3Client, stabilityClient],
  );

  const handleUpscale = useCallback(
    async (scale: 2 | 4) => {
      if (!selectedImage || currentUpscaleData.state !== "idle") return;
      if (enabledProviders.length === 0) return;

      setUpscaleData({
        forImageId: selectedImage.id,
        state: "upscaling",
        blob: null,
        url: null,
        originalDimensions:
          selectedImage.width && selectedImage.height
            ? { width: selectedImage.width, height: selectedImage.height }
            : null,
        dimensions: null,
        error: null,
      });

      try {
        const blob = await tryUpscaleWithProviders(selectedImage.file, scale);

        if (!blob) {
          throw new Error("All upscale providers failed");
        }

        // Create object URL for preview
        const url = URL.createObjectURL(blob);

        // Get dimensions of upscaled image
        const img = new Image();
        img.onload = () => {
          setUpscaleData((prev) => ({
            ...prev,
            forImageId: selectedImage.id,
            state: "confirming",
            blob,
            url,
            dimensions: { width: img.naturalWidth, height: img.naturalHeight },
            error: null,
          }));
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          setUpscaleData({
            forImageId: selectedImage.id,
            state: "idle",
            blob: null,
            url: null,
            originalDimensions: null,
            dimensions: null,
            error: "Failed to load upscaled image",
          });
        };
        img.src = url;
      } catch (err) {
        setUpscaleData({
          forImageId: selectedImage.id,
          state: "idle",
          blob: null,
          url: null,
          originalDimensions: null,
          dimensions: null,
          error: err instanceof Error ? err.message : "Upscale failed",
        });
        // Re-check server availability
        queryClient.invalidateQueries({
          queryKey: ["stability-server-status", stabilityApiKey],
        });
        queryClient.invalidateQueries({
          queryKey: ["upscale-server-capabilities", upscaleServerUrl],
        });
      }
    },
    [
      selectedImage,
      currentUpscaleData.state,
      enabledProviders,
      tryUpscaleWithProviders,
      stabilityApiKey,
      upscaleServerUrl,
      queryClient,
    ],
  );

  const handleKeep = useCallback(async () => {
    if (
      !selectedImage ||
      !currentUpscaleData.blob ||
      !currentUpscaleData.dimensions ||
      !onUpscaleConfirm
    )
      return;

    const originalDims = currentUpscaleData.originalDimensions;
    const newDims = currentUpscaleData.dimensions;

    setUpscaleData((prev) => ({ ...prev, state: "saving" }));

    try {
      await onUpscaleConfirm(
        selectedImage.id,
        currentUpscaleData.blob,
        currentUpscaleData.dimensions.width,
        currentUpscaleData.dimensions.height,
      );

      // Cleanup
      if (currentUpscaleData.url) {
        URL.revokeObjectURL(currentUpscaleData.url);
      }
      setUpscaleData({
        forImageId: selectedImage.id,
        ...INITIAL_UPSCALE_DATA,
      });

      // Show success toast (only if we have original dimensions)
      if (originalDims) {
        setSuccessToast({
          from: originalDims,
          to: newDims,
        });
      }
    } catch (err) {
      setUpscaleData((prev) => ({
        ...prev,
        state: "confirming",
        error: err instanceof Error ? err.message : "Failed to save",
      }));
    }
  }, [selectedImage, currentUpscaleData, onUpscaleConfirm]);

  const handleDiscard = useCallback(() => {
    if (currentUpscaleData.url) {
      URL.revokeObjectURL(currentUpscaleData.url);
    }
    if (selectedImage) {
      setUpscaleData({
        forImageId: selectedImage.id,
        ...INITIAL_UPSCALE_DATA,
      });
    }
  }, [currentUpscaleData.url, selectedImage]);

  const handleCustomResize = useCallback(
    async (targetWidth: number, targetHeight: number, close: () => void) => {
      if (!selectedImage || currentUpscaleData.state !== "idle") return;
      if (enabledProviders.length === 0) return;

      const originalWidth = selectedImage.width;
      const originalHeight = selectedImage.height;

      if (!originalWidth || !originalHeight) {
        setUpscaleData({
          forImageId: selectedImage.id,
          state: "idle",
          blob: null,
          url: null,
          originalDimensions: null,
          dimensions: null,
          error: "Image dimensions not available",
        });
        return;
      }

      close();

      setUpscaleData({
        forImageId: selectedImage.id,
        state: "upscaling",
        blob: null,
        url: null,
        originalDimensions: { width: originalWidth, height: originalHeight },
        dimensions: null,
        error: null,
      });

      try {
        let sourceBlob: Blob = selectedImage.file;
        let currentWidth = originalWidth;
        let currentHeight = originalHeight;
        const MAX_UPSCALE_ITERATIONS = 5;

        // Upscale repeatedly until we reach or exceed target dimensions
        let iterations = 0;
        while (
          (currentWidth < targetWidth || currentHeight < targetHeight) &&
          iterations < MAX_UPSCALE_ITERATIONS
        ) {
          const result = await tryUpscaleWithFallback(sourceBlob);
          if (!result) {
            console.warn(
              `Upscale iteration ${iterations + 1} failed, using best result so far (${currentWidth}×${currentHeight})`,
            );
            break;
          }

          sourceBlob = result.blob;
          currentWidth *= result.scaleFactor;
          currentHeight *= result.scaleFactor;
          iterations++;
        }

        // Downscale to exact target dimensions if we have enough resolution
        let finalBlob: Blob;
        let finalWidth: number;
        let finalHeight: number;

        if (currentWidth >= targetWidth && currentHeight >= targetHeight) {
          finalBlob = await resizeImage(sourceBlob, targetWidth, targetHeight);
          finalWidth = targetWidth;
          finalHeight = targetHeight;
        } else {
          finalBlob = sourceBlob;
          finalWidth = currentWidth;
          finalHeight = currentHeight;
        }

        const url = URL.createObjectURL(finalBlob);

        setUpscaleData({
          forImageId: selectedImage.id,
          state: "confirming",
          blob: finalBlob,
          url,
          originalDimensions: {
            width: originalWidth,
            height: originalHeight,
          },
          dimensions: { width: finalWidth, height: finalHeight },
          error: null,
        });
      } catch (err) {
        setUpscaleData({
          forImageId: selectedImage.id,
          state: "idle",
          blob: null,
          url: null,
          originalDimensions: null,
          dimensions: null,
          error: err instanceof Error ? err.message : "Resize failed",
        });
        queryClient.invalidateQueries({
          queryKey: ["stability-server-status", stabilityApiKey],
        });
        queryClient.invalidateQueries({
          queryKey: ["upscale-server-capabilities", upscaleServerUrl],
        });
      }
    },
    [
      selectedImage,
      currentUpscaleData.state,
      enabledProviders,
      tryUpscaleWithFallback,
      stabilityApiKey,
      upscaleServerUrl,
      queryClient,
    ],
  );

  return {
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
    tryUpscaleWithFallback,
  };
}
