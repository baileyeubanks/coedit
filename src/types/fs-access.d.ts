// Type declarations for the File System Access API
// These are not yet in the standard TypeScript lib but are supported in Chrome/Edge.

interface FileSystemDirectoryHandle {
  getDirectoryHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<FileSystemDirectoryHandle>;
  getFileHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<FileSystemFileHandle>;
  values(): AsyncIterableIterator<FileSystemHandle>;
  name: string;
}

interface FileSystemFileHandle {
  createWritable(): Promise<FileSystemWritableFileStream>;
  getFile(): Promise<File>;
  name: string;
}

interface FileSystemWritableFileStream extends WritableStream {
  write(data: BufferSource | Blob | string): Promise<void>;
  close(): Promise<void>;
}

interface ShowDirectoryPickerOptions {
  mode?: 'read' | 'readwrite';
  startIn?: 'desktop' | 'downloads' | 'documents' | 'pictures' | 'music' | 'videos';
  id?: string;
}

interface Window {
  showDirectoryPicker(options?: ShowDirectoryPickerOptions): Promise<FileSystemDirectoryHandle>;
}
