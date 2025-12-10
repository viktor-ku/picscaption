export interface ImageData {
  id: string;
  file: File;
  thumbnailUrl: string | null; // Generated progressively, null = placeholder
  fullImageUrl: string | null; // Full resolution, loaded on demand
  fileName: string;
  namespace: string;
  caption: string;
  width?: number;
  height?: number;
}
