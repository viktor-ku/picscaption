import pica from "pica";

// Pica instance for high-quality image resizing (Lanczos3)
const resizer = pica();

export const IMAGE_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".bmp",
  ".svg",
];

export function hasImageExtension(file: File): boolean {
  if (file.type.startsWith("image/")) {
    return true;
  }
  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
  return IMAGE_EXTENSIONS.includes(ext);
}

export function isImageFile(file: File): boolean {
  // Skip empty files (0 bytes)
  if (file.size === 0) {
    return false;
  }
  return hasImageExtension(file);
}

// Check if File System Access API is supported
export function supportsDirectoryPicker(): boolean {
  return "showDirectoryPicker" in window;
}

// Check if Save File Picker is supported
export function supportsSaveFilePicker(): boolean {
  return "showSaveFilePicker" in window;
}

/**
 * Load an image from a blob and return the HTMLImageElement
 */
export function loadImage(blob: Blob): Promise<HTMLImageElement> {
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
export async function resizeImage(
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

/**
 * Resize an image to fit within max dimensions (by longest side)
 * Returns the original blob if already smaller than maxSize
 */
export async function resizeImageToMaxSize(
  sourceBlob: Blob,
  maxSize: number,
): Promise<Blob> {
  const img = await loadImage(sourceBlob);
  const { naturalWidth, naturalHeight } = img;

  // If already within limits, return original
  const longSide = Math.max(naturalWidth, naturalHeight);
  if (longSide <= maxSize) {
    return sourceBlob;
  }

  // Calculate new dimensions maintaining aspect ratio
  const scale = maxSize / longSide;
  const targetWidth = Math.round(naturalWidth * scale);
  const targetHeight = Math.round(naturalHeight * scale);

  return resizeImage(sourceBlob, targetWidth, targetHeight);
}

export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Crop an image blob to the specified pixel area
 */
export async function cropImage(
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
