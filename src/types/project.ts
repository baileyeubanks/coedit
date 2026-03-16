export interface MediaAsset {
  id: string;
  name: string;
  type: 'video' | 'image' | 'audio';
  mimeType: string;
  size: number;
  duration?: number;
  width?: number;
  height?: number;
  thumbnailUrl?: string;
  waveformData?: number[];
  blobKey: string;
  fileBlob?: Blob | null;
  sourceMissing?: boolean;
}
