import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  useTransition,
} from "react";
import {
  ImageIcon,
  Sparkles,
  Loader2,
  Check,
  X,
  ArrowRightLeft,
  Crop as CropIcon,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import ReactCrop, {
  type Crop as CropState,
  type PixelCrop,
} from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import pica from "pica";
import type { ImageData } from "../types";
import { UpscaleClient } from "../lib/ai3-upscale-client";
import { StabilityUpscaleClient } from "../lib/stability-upscale-client";
import type { UpscaleProviderConfig } from "../lib/settings";

// Pica instance for high-quality image resizing (Lanczos3)
const resizer = pica();

/**
 * Load an image from a blob and return the HTMLImageElement
 */
function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
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

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Crop an image blob to the specified pixel area
 */
async function cropImage(
  sourceBlob: Blob,
  cropArea: CropArea,
): Promise<{ blob: Blob; width: number; height: number }> {
  const img = await loadImage(sourceBlob);

  const canvas = document.createElement("canvas");
  canvas.width = cropArea.width;
  canvas.height = cropArea.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to get canvas context");
  }

  ctx.drawImage(
    img,
    cropArea.x,
    cropArea.y,
    cropArea.width,
    cropArea.height,
    0,
    0,
    cropArea.width,
    cropArea.height,
  );

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error("Failed to create blob"));
      },
      sourceBlob.type || "image/png",
      1.0,
    );
  });

  return { blob, width: cropArea.width, height: cropArea.height };
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

type UpscaleState = "idle" | "upscaling" | "confirming" | "saving";

interface UpscaleData {
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

type CropMode = "idle" | "cropping";

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

  // Crop state
  const [cropMode, setCropMode] = useState<CropMode>("idle");
  const [cropAspect, setCropAspect] = useState<number | undefined>(undefined);
  const [crop, setCrop] = useState<CropState>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const [lastCropAspect, setLastCropAspect] = useState<number | undefined>(1); // Default to 1:1
  const cropImageRef = useRef<HTMLImageElement>(null);

  // Track whether the full image has loaded
  const [fullImageReady, setFullImageReady] = useState(false);
  const [, startTransition] = useTransition();
  const selectedImageId = selectedImage?.id ?? "";

  // Ref to hold the current image loader so we can cancel it
  const imageLoaderRef = useRef<HTMLImageElement | null>(null);

  // Load the full image with cancellation support
  useEffect(() => {
    setFullImageReady(false);

    // Cancel any previous load
    if (imageLoaderRef.current) {
      imageLoaderRef.current.src = ""; // Cancel pending load/decode
      imageLoaderRef.current = null;
    }

    const displayUrl = selectedImage?.fullImageUrl;
    if (!displayUrl) return;

    // Create new loader
    const loader = new Image();
    imageLoaderRef.current = loader;

    loader.onload = () => {
      // Verify this loader is still the current one (not stale)
      if (imageLoaderRef.current !== loader) return;

      startTransition(() => {
        setFullImageReady(true);
      });
    };

    loader.src = displayUrl;

    // Cleanup: cancel load when switching away or unmounting
    return () => {
      loader.src = ""; // Cancel pending load/decode
      if (imageLoaderRef.current === loader) {
        imageLoaderRef.current = null;
      }
    };
  }, [selectedImageId, selectedImage?.fullImageUrl]);

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

  // Check if AI3 is enabled
  const ai3Enabled = enabledProviders.some((p) => p.id === "ai3");
  const stabilityEnabled = enabledProviders.some((p) => p.id === "stability");

  // Query for AI3 server capabilities - polls every 60 seconds when enabled
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

  const queryClient = useQueryClient();

  // Try upscale with providers in order (fallback)
  const tryUpscaleWithProviders = useCallback(
    async (sourceBlob: Blob, scale: 2 | 4): Promise<Blob | null> => {
      for (const provider of enabledProviders) {
        try {
          if (provider.id === "ai3" && ai3Client) {
            return await ai3Client.upscale(sourceBlob, { scale });
          }
          if (provider.id === "stability" && stabilityClient) {
            // Stability always does 4x regardless of requested scale
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

  // Crop handlers
  const handleStartCrop = useCallback((aspect: number | undefined) => {
    setCropAspect(aspect);
    setLastCropAspect(aspect);

    // Calculate initial crop to maximize area
    // For aspect-constrained crops, try to use full width first
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
        // Image is wider than the crop aspect - use full height
        // heightNeeded for full width would exceed image height
        // So use full height and calculate width
        cropHeight = 100;
        cropWidth = (aspect / imageAspect) * 100;
        x = (100 - cropWidth) / 2;
        y = 0;
      } else {
        // Image is taller than the crop aspect - use full width
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
      // Free aspect or image not loaded - use full image
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

    // Use completedCrop if valid, otherwise calculate from crop state
    // completedCrop might be null if user didn't interact with the crop
    let pixelCrop =
      completedCrop && completedCrop.width > 0 && completedCrop.height > 0
        ? completedCrop
        : null;

    if (!pixelCrop && crop && crop.width > 0 && crop.height > 0) {
      // Convert percentage crop to pixels
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

    // Scale crop coordinates from displayed size to natural size
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    let finalX = Math.round(pixelCrop.x * scaleX);
    let finalY = Math.round(pixelCrop.y * scaleY);
    let finalWidth = Math.round(pixelCrop.width * scaleX);
    let finalHeight = Math.round(pixelCrop.height * scaleY);

    // Enforce aspect ratio after rounding to avoid 1px differences
    // For 1:1 crops, ensure width === height
    if (cropAspect !== undefined) {
      if (cropAspect === 1) {
        // 1:1 - use the smaller dimension
        const size = Math.min(finalWidth, finalHeight);
        finalWidth = size;
        finalHeight = size;
      } else {
        // Other aspect ratios - adjust height based on width
        finalHeight = Math.round(finalWidth / cropAspect);
      }

      // Ensure we don't exceed image bounds
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

      // Reset crop mode
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

  // "r" key to start cropping (when not already cropping and not in input)
  useEffect(() => {
    if (
      !selectedImage ||
      !selectedImage.fullImageUrl ||
      cropMode === "cropping" ||
      currentUpscaleData.state !== "idle"
    )
      return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if user is typing in an input/textarea
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
    currentUpscaleData.state,
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

        // Upscale repeatedly until we reach or exceed target dimensions (max 5 iterations)
        // If an iteration fails (e.g., OOM on server), use the best result achieved so far
        let iterations = 0;
        while (
          (currentWidth < targetWidth || currentHeight < targetHeight) &&
          iterations < MAX_UPSCALE_ITERATIONS
        ) {
          const result = await tryUpscaleWithFallback(sourceBlob);
          if (!result) {
            // All providers failed
            console.warn(
              `Upscale iteration ${iterations + 1} failed, using best result so far (${currentWidth}×${currentHeight})`,
            );
            break;
          }

          // Success - update our best result
          sourceBlob = result.blob;
          currentWidth *= result.scaleFactor;
          currentHeight *= result.scaleFactor;
          iterations++;
        }

        // Only resize with pica if we have enough dimensions (downscale only)
        // If we couldn't reach target, use the best upscaled result as-is
        let finalBlob: Blob;
        let finalWidth: number;
        let finalHeight: number;

        if (currentWidth >= targetWidth && currentHeight >= targetHeight) {
          // Downscale to exact target dimensions with high-quality pica
          finalBlob = await resizeImage(sourceBlob, targetWidth, targetHeight);
          finalWidth = targetWidth;
          finalHeight = targetHeight;
        } else {
          // Couldn't reach target - use best upscaled result as-is
          finalBlob = sourceBlob;
          finalWidth = currentWidth;
          finalHeight = currentHeight;
        }

        // Create object URL for preview
        const url = URL.createObjectURL(finalBlob);

        // Set confirming state with final dimensions
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
      tryUpscaleWithFallback,
      stabilityApiKey,
      upscaleServerUrl,
      queryClient,
    ],
  );

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

  // Show upscaled preview during confirming/saving, otherwise show full image
  // fullImageUrl may be null while loading (lazy loading)
  const displayUrl =
    (isConfirming || isSaving) && currentUpscaleData.url
      ? currentUpscaleData.url
      : selectedImage.fullImageUrl;

  // Show thumbnail placeholder until full image is loaded
  const showThumbnailPlaceholder = !fullImageReady || !displayUrl;

  return (
    <div className="h-full bg-preview-bg flex flex-col">
      {/* Action bar header */}
      <div className="flex-shrink-0 flex items-center justify-center py-2 px-4">
        {/* Upscale label + buttons - only show when providers are configured */}
        {hasAnyEnabledProvider && (
          <div className="group relative flex items-center gap-2">
            <div
              className={`flex items-center gap-1.5 text-sm font-medium ${
                availableScales.length > 0 ? "text-white/80" : "text-white/30"
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>Upscale</span>
            </div>

            {/* Scale buttons */}
            {availableScales.length > 0 && (
              <div className="flex gap-1.5 ml-1">
                {availableScales
                  .sort((a, b) => a - b)
                  .map((scale) => (
                    <button
                      key={scale}
                      type="button"
                      onClick={() => handleUpscale(scale)}
                      disabled={!canUpscale}
                      className={`
                        px-2.5 py-1 rounded-md text-xs font-semibold
                        transition-all
                        ${
                          canUpscale
                            ? "bg-white/15 hover:bg-white/25 text-white cursor-pointer"
                            : "bg-white/5 text-white/30 cursor-not-allowed"
                        }
                      `}
                    >
                      {scale}x
                    </button>
                  ))}

                {/* Custom size button */}
                <Popover className="relative">
                  {({ close }) => (
                    <>
                      <PopoverButton
                        disabled={currentUpscaleData.state !== "idle"}
                        onClick={() => {
                          // Focus width input when opening
                          setTimeout(() => widthInputRef.current?.focus(), 0);
                        }}
                        className={`
                          px-2.5 py-1 rounded-md text-xs font-semibold
                          transition-all
                          ${
                            currentUpscaleData.state === "idle"
                              ? "bg-white/15 hover:bg-white/25 text-white cursor-pointer"
                              : "bg-white/5 text-white/30 cursor-not-allowed"
                          }
                        `}
                      >
                        Custom
                      </PopoverButton>

                      <PopoverPanel
                        transition
                        anchor="bottom"
                        className="absolute z-50 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg p-4 origin-top transition duration-100 ease-out data-[closed]:scale-95 data-[closed]:opacity-0"
                      >
                        <div className="text-sm font-medium text-gray-700 mb-3">
                          Custom size
                        </div>
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            const w = Number.parseInt(customWidth, 10);
                            const h = Number.parseInt(customHeight, 10);
                            if (w > 0 && h > 0) {
                              // Save to localStorage on Apply
                              localStorage.setItem(
                                "picscaption-custom-width",
                                customWidth,
                              );
                              localStorage.setItem(
                                "picscaption-custom-height",
                                customHeight,
                              );
                              handleCustomResize(w, h, close);
                            }
                          }}
                        >
                          <div className="flex items-center gap-3 mb-3">
                            <label className="flex-1">
                              <span className="block text-xs text-gray-500 mb-1">
                                Width
                              </span>
                              <input
                                ref={widthInputRef}
                                type="number"
                                value={customWidth}
                                onChange={(e) => setCustomWidth(e.target.value)}
                                placeholder="px"
                                min={1}
                                className="w-full px-2 py-1.5 bg-white border border-gray-300 rounded text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                              />
                            </label>
                            <label className="flex-1">
                              <span className="block text-xs text-gray-500 mb-1">
                                Height
                              </span>
                              <input
                                type="number"
                                value={customHeight}
                                onChange={(e) =>
                                  setCustomHeight(e.target.value)
                                }
                                placeholder="px"
                                min={1}
                                className="w-full px-2 py-1.5 bg-white border border-gray-300 rounded text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                              />
                            </label>
                          </div>
                          <button
                            type="submit"
                            disabled={
                              !customWidth ||
                              !customHeight ||
                              Number.parseInt(customWidth, 10) <= 0 ||
                              Number.parseInt(customHeight, 10) <= 0
                            }
                            className="w-full py-2 flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
                          >
                            <ArrowRightLeft className="w-4 h-4" />
                            Apply
                          </button>
                        </form>
                      </PopoverPanel>
                    </>
                  )}
                </Popover>
              </div>
            )}

            {/* Tooltip for unavailable server */}
            {!isAnyProviderAvailable && (
              <div
                className="
                  absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-2 
                  bg-gray-900 text-white text-xs rounded-lg
                  opacity-0 group-hover:opacity-100 transition-opacity
                  whitespace-nowrap pointer-events-none
                  shadow-lg z-10
                "
              >
                Upscale server unavailable
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45" />
              </div>
            )}
          </div>
        )}

        {/* Divider - only show when upscale section is visible */}
        {hasAnyEnabledProvider && <div className="w-px h-6 bg-white/20 mx-3" />}

        {/* Crop section */}
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-1.5 text-sm font-medium ${
              hasPendingCrop ? "text-primary" : "text-white/80"
            }`}
          >
            <CropIcon className="w-4 h-4" />
            <span>Crop</span>
          </div>

          {hasPendingCrop ? (
            <button
              type="button"
              onClick={onCancelCrop}
              className="px-2.5 py-1 rounded-md text-xs font-semibold bg-white/15 hover:bg-white/25 text-white cursor-pointer transition-all"
            >
              Cancel
            </button>
          ) : (
            <div className="flex gap-1.5 ml-1">
              <button
                type="button"
                onClick={() => handleStartCrop(1)}
                disabled={
                  cropMode === "cropping" ||
                  currentUpscaleData.state !== "idle" ||
                  !hasFullImage
                }
                className={`
                    px-2.5 py-1 rounded-md text-xs font-semibold
                    transition-all
                    ${
                      cropMode === "idle" &&
                      currentUpscaleData.state === "idle" &&
                      hasFullImage
                        ? "bg-white/15 hover:bg-white/25 text-white cursor-pointer"
                        : "bg-white/5 text-white/30 cursor-not-allowed"
                    }
                  `}
              >
                1:1
              </button>
              <button
                type="button"
                onClick={() => handleStartCrop(undefined)}
                disabled={
                  cropMode === "cropping" ||
                  currentUpscaleData.state !== "idle" ||
                  !hasFullImage
                }
                className={`
                    px-2.5 py-1 rounded-md text-xs font-semibold
                    transition-all
                    ${
                      cropMode === "idle" &&
                      currentUpscaleData.state === "idle" &&
                      hasFullImage
                        ? "bg-white/15 hover:bg-white/25 text-white cursor-pointer"
                        : "bg-white/5 text-white/30 cursor-not-allowed"
                    }
                  `}
              >
                Free
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Image container */}
      <div className="flex-1 flex items-center justify-center p-4 relative min-h-0">
        {/* Thumbnail placeholder - stretched to fill preview area while loading */}
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

        {/* Full image - shown when ready (hidden during crop mode, crop overlay uses its own image) */}
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

        {/* Crop overlay - positioned absolutely over the image */}
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

        {/* Crop instructions */}
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

        {/* Loading overlay */}
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

        {/* Confirm buttons overlay */}
        {(isConfirming || isSaving) && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-3">
            <button
              type="button"
              onClick={handleDiscard}
              disabled={isSaving}
              className="
                flex items-center gap-2 px-5 py-3 rounded-xl
                bg-gray-800/90 hover:bg-gray-800 text-white
                font-medium shadow-xl backdrop-blur-sm
                transition-all hover:scale-105
                disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
              "
            >
              <X className="w-5 h-5" />
              <span>Discard</span>
            </button>
            <button
              type="button"
              onClick={handleKeep}
              disabled={isSaving}
              className="
                flex items-center gap-2 px-5 py-3 rounded-xl
                bg-green-600 hover:bg-green-500 text-white
                font-medium shadow-xl backdrop-blur-sm
                transition-all hover:scale-105
                disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
              "
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

        {/* Upscaled dimensions badge */}
        {isConfirming && currentUpscaleData.dimensions && (
          <div className="absolute top-4 left-4 px-3 py-2 bg-green-600/90 text-white text-sm rounded-lg shadow-lg backdrop-blur-sm">
            Upscaled: {currentUpscaleData.dimensions.width} ×{" "}
            {currentUpscaleData.dimensions.height}
          </div>
        )}

        {/* Error toast */}
        {currentUpscaleData.error && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 px-4 py-3 bg-red-600 text-white text-sm rounded-lg shadow-xl">
            {currentUpscaleData.error}
          </div>
        )}

        {/* Success toast */}
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
