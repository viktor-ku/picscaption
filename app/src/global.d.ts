// File System Access API declarations
interface FileSystemHandle {
  kind: "file" | "directory";
  name: string;
}

interface FileSystemFileHandle extends FileSystemHandle {
  kind: "file";
  getFile(): Promise<File>;
  createWritable(): Promise<FileSystemWritableFileStream>;
}

interface FileSystemDirectoryHandle extends FileSystemHandle {
  kind: "directory";
  values(): AsyncIterableIterator<
    FileSystemFileHandle | FileSystemDirectoryHandle
  >;
  getFileHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<FileSystemFileHandle>;
  removeEntry(name: string): Promise<void>;
}

interface FileSystemWritableFileStream extends WritableStream {
  write(data: BufferSource | Blob | string): Promise<void>;
  close(): Promise<void>;
}

interface FilePickerAcceptType {
  description?: string;
  accept: Record<string, string[]>;
}

interface SaveFilePickerOptions {
  suggestedName?: string;
  startIn?: FileSystemDirectoryHandle | "desktop" | "documents" | "downloads";
  types?: FilePickerAcceptType[];
}

interface Window {
  showDirectoryPicker(): Promise<FileSystemDirectoryHandle>;
  showSaveFilePicker(
    options?: SaveFilePickerOptions,
  ): Promise<FileSystemFileHandle>;
}
