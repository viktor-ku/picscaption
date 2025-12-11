/**
 * Perceptual Hash (dHash) implementation
 *
 * Difference hash works by:
 * 1. Resizing image to 9x8 grayscale
 * 2. Comparing each pixel to its right neighbor
 * 3. Producing a 64-bit hash (8x8 = 64 comparisons)
 *
 * Similar images produce similar hashes with small Hamming distances.
 */

const HASH_SIZE = 8;

/**
 * Compute a difference hash (dHash) for an image blob.
 * Returns a 16-character hex string (64 bits).
 */
export async function computeDHash(blob: Blob): Promise<string> {
  const imageBitmap = await createImageBitmap(blob);

  // Create a small canvas for resizing
  const canvas = new OffscreenCanvas(HASH_SIZE + 1, HASH_SIZE);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to get canvas context");
  }

  // Draw resized image (9x8 to get 8 horizontal differences per row)
  ctx.drawImage(imageBitmap, 0, 0, HASH_SIZE + 1, HASH_SIZE);
  imageBitmap.close();

  // Get pixel data
  const imageData = ctx.getImageData(0, 0, HASH_SIZE + 1, HASH_SIZE);
  const pixels = imageData.data;

  // Convert to grayscale and compare adjacent pixels
  const bits: number[] = [];

  for (let y = 0; y < HASH_SIZE; y++) {
    for (let x = 0; x < HASH_SIZE; x++) {
      const leftIdx = (y * (HASH_SIZE + 1) + x) * 4;
      const rightIdx = (y * (HASH_SIZE + 1) + x + 1) * 4;

      // Grayscale using luminance formula
      const leftGray =
        pixels[leftIdx] * 0.299 +
        pixels[leftIdx + 1] * 0.587 +
        pixels[leftIdx + 2] * 0.114;
      const rightGray =
        pixels[rightIdx] * 0.299 +
        pixels[rightIdx + 1] * 0.587 +
        pixels[rightIdx + 2] * 0.114;

      // 1 if left pixel is brighter than right
      bits.push(leftGray > rightGray ? 1 : 0);
    }
  }

  // Convert 64 bits to hex string
  let hash = "";
  for (let i = 0; i < 64; i += 4) {
    const nibble =
      (bits[i] << 3) | (bits[i + 1] << 2) | (bits[i + 2] << 1) | bits[i + 3];
    hash += nibble.toString(16);
  }

  return hash;
}

/**
 * Calculate the Hamming distance between two hashes.
 * Returns the number of differing bits (0-64).
 * Lower values indicate more similar images.
 */
export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) {
    throw new Error("Hash lengths must match");
  }

  let distance = 0;
  for (let i = 0; i < a.length; i++) {
    const aNibble = Number.parseInt(a[i], 16);
    const bNibble = Number.parseInt(b[i], 16);
    // Count differing bits in this nibble
    let xor = aNibble ^ bNibble;
    while (xor) {
      distance += xor & 1;
      xor >>= 1;
    }
  }

  return distance;
}

/**
 * Check if two images are perceptually similar.
 * Default threshold of 10 bits allows for minor edits like cropping or compression.
 */
export function areSimilar(
  hashA: string,
  hashB: string,
  threshold = 10,
): boolean {
  return hammingDistance(hashA, hashB) <= threshold;
}
