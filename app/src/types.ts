export interface ImageData {
  id: string;
  uuid: string; // Persistent cross-session identity
  file: File;
  thumbnailUrl: string | null; // Generated progressively, null = placeholder
  fullImageUrl: string | null; // Full resolution, loaded on demand
  fileName: string;
  namespace: string;
  caption: string;
  width?: number;
  height?: number;
}

export type SaveStatus = "saving" | "saved" | null;

export interface PendingDeletion {
  image: ImageData;
  originalIndex: number;
  toastId: string;
  fileData: ArrayBuffer; // Actual file contents for restore
}

export interface PendingCrop {
  imageId: string;
  originalData: ArrayBuffer; // Actual file contents for restore
  originalType: string;
  originalWidth: number;
  originalHeight: number;
  newWidth: number;
  newHeight: number;
  toastId: string;
}

export interface BulkUpscaleProgress {
  current: number;
  total: number;
}
