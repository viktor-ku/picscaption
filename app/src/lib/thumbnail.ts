// Thumbnail generation utilities for lazy loading large images

const THUMBNAIL_SIZE = 160; // 2x for retina (80px display in filmstrip)
const BATCH_SIZE = 5; // Process this many thumbnails before yielding to UI
const BATCH_DELAY_MS = 10; // Small delay between batches to keep UI responsive

/**
 * Generate a thumbnail blob URL from an image file.
 * Uses Canvas API to resize the image to a small thumbnail.
 */
export async function generateThumbnail(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const originalUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(originalUrl);

      // Calculate thumbnail dimensions maintaining aspect ratio
      let width = img.naturalWidth;
      let height = img.naturalHeight;

      if (width > height) {
        if (width > THUMBNAIL_SIZE) {
          height = Math.round((height * THUMBNAIL_SIZE) / width);
          width = THUMBNAIL_SIZE;
        }
      } else {
        if (height > THUMBNAIL_SIZE) {
          width = Math.round((width * THUMBNAIL_SIZE) / height);
          height = THUMBNAIL_SIZE;
        }
      }

      // Create canvas and draw resized image
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }

      // Use better image smoothing for thumbnails
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, width, height);

      // Convert to blob and create URL
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(URL.createObjectURL(blob));
          } else {
            reject(new Error("Failed to create thumbnail blob"));
          }
        },
        "image/jpeg",
        0.8, // 80% quality for thumbnails - good balance of size/quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(originalUrl);
      reject(new Error(`Failed to load image: ${file.name}`));
    };

    img.src = originalUrl;
  });
}

/**
 * Generate thumbnails for multiple files in batches.
 * Yields to the UI thread between batches to keep the app responsive.
 *
 * @param files - Array of files to generate thumbnails for
 * @param onProgress - Callback called with (index, thumbnailUrl) as each thumbnail completes
 * @param onError - Optional callback for errors (index, error). If not provided, errors are logged.
 */
export async function generateThumbnailsBatch(
  files: File[],
  onProgress: (index: number, thumbnailUrl: string) => void,
  onError?: (index: number, error: Error) => void,
): Promise<void> {
  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, Math.min(i + BATCH_SIZE, files.length));

    // Process batch in parallel
    const results = await Promise.allSettled(
      batch.map((file) => generateThumbnail(file)),
    );

    // Report results
    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      const index = i + j;

      if (result.status === "fulfilled") {
        onProgress(index, result.value);
      } else {
        const error =
          result.reason instanceof Error
            ? result.reason
            : new Error(String(result.reason));
        if (onError) {
          onError(index, error);
        } else {
          console.error(
            `Failed to generate thumbnail for index ${index}:`,
            error,
          );
        }
      }
    }

    // Yield to UI thread between batches (except for the last batch)
    if (i + BATCH_SIZE < files.length) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }
}

/**
 * Load the full-resolution image and return an object URL.
 * This is used for the main preview when an image is selected.
 */
export function loadFullImage(file: File): string {
  return URL.createObjectURL(file);
}

/**
 * Unload a full-resolution image by revoking its object URL.
 */
export function unloadFullImage(url: string): void {
  URL.revokeObjectURL(url);
}
