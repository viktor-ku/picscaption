import { supportsSaveFilePicker } from "./image-utils";
import type { ImageData } from "../types";

export async function exportCaptions(
  images: ImageData[],
  format: "json" | "jsonl",
  directoryHandle: FileSystemDirectoryHandle | null,
): Promise<void> {
  if (images.length === 0) return;

  const payload = images.map((img) => ({
    filename: img.fileName,
    caption: img.caption.trim(),
  }));

  const content =
    format === "jsonl"
      ? payload.map((item) => JSON.stringify(item)).join("\n")
      : JSON.stringify(payload, null, 2);
  const mimeType =
    format === "jsonl" ? "application/x-ndjson" : "application/json";

  if (supportsSaveFilePicker()) {
    try {
      const fileHandle = await window.showSaveFilePicker({
        suggestedName: `captions.${format}`,
        ...(directoryHandle && { startIn: directoryHandle }),
        types: [
          {
            description: format === "jsonl" ? "JSON Lines" : "JSON",
            accept: { [mimeType]: [`.${format}`] },
          },
        ],
      });
      const writable = await fileHandle.createWritable();
      await writable.write(content);
      await writable.close();
      return;
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
    }
  }

  const blob = new Blob([content], { type: mimeType });
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = `captions.${format}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(blobUrl);
}
