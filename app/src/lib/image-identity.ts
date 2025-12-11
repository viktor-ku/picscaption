/**
 * Image Identity - Sidecar file handling for cross-session persistence
 *
 * Each image gets a .picscaption sidecar file containing:
 * - UUID: Unique identifier that persists across sessions
 * - pHash: Perceptual hash for similarity matching
 * - caption: The current caption text
 * - tags: Array of tags (future use)
 * - timestamps: Creation and update times
 */

export interface SidecarData {
  uuid: string;
  pHash: string;
  caption: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Read sidecar data for an image file.
 * Returns null if no sidecar exists.
 */
export async function readSidecar(
  dirHandle: FileSystemDirectoryHandle,
  fileName: string,
): Promise<SidecarData | null> {
  try {
    const fileHandle = await dirHandle.getFileHandle(`${fileName}.picscaption`);
    const file = await fileHandle.getFile();
    const text = await file.text();
    return JSON.parse(text) as SidecarData;
  } catch {
    return null; // No sidecar exists or parse error
  }
}

/**
 * Write sidecar data for an image file.
 * Creates the sidecar file if it doesn't exist.
 */
export async function writeSidecar(
  dirHandle: FileSystemDirectoryHandle,
  fileName: string,
  data: SidecarData,
): Promise<void> {
  const fileHandle = await dirHandle.getFileHandle(`${fileName}.picscaption`, {
    create: true,
  });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(data, null, 2));
  await writable.close();
}

/**
 * Generate a new UUID for an image.
 */
export function generateUUID(): string {
  return crypto.randomUUID();
}

/**
 * Create initial sidecar data for a new image.
 */
export function createSidecarData(
  uuid: string,
  pHash: string,
  caption = "",
  tags: string[] = [],
): SidecarData {
  const now = new Date().toISOString();
  return {
    uuid,
    pHash,
    caption,
    tags,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Update sidecar data, preserving creation time.
 */
export function updateSidecarData(
  existing: SidecarData,
  updates: Partial<Pick<SidecarData, "caption" | "tags" | "pHash">>,
): SidecarData {
  return {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
}
