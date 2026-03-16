import type { MediaAsset } from '../types';

export type LocalMediaKind = MediaAsset['type'];

const MEDIA_EXTENSION_KIND: Record<string, LocalMediaKind> = {
  mp3: 'audio',
  m4a: 'audio',
  wav: 'audio',
  ogg: 'audio',
  webm: 'video',
  mp4: 'video',
  mov: 'video',
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  gif: 'image',
  webp: 'image',
  avif: 'image',
};

export const CUT_SOURCE_ACCEPT_ATTRIBUTE = 'audio/*,video/*,.mp3,.mp4,.m4a,.wav,.webm,.ogg,.mov';

function getFileExtension(fileName: string): string {
  const match = fileName.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? '';
}

export function inferLocalMediaKind(file: Pick<File, 'name' | 'type'>): LocalMediaKind | null {
  const mimeType = file.type.toLowerCase();

  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('image/')) return 'image';

  return MEDIA_EXTENSION_KIND[getFileExtension(file.name)] ?? null;
}

export function validateCutSourceFile(file: Pick<File, 'name' | 'type'>): string | null {
  const kind = inferLocalMediaKind(file);

  if (!kind || kind === 'image') {
    return 'Unsupported file type. Upload an audio or video source to start a Co-Cut session.';
  }

  return null;
}

export function getSuggestedProjectName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '').trim() || 'Untitled Project';
}

export async function readLocalMediaMetadata(
  file: File,
  explicitKind?: LocalMediaKind | null,
): Promise<Partial<MediaAsset> & { type: LocalMediaKind }> {
  const kind = explicitKind ?? inferLocalMediaKind(file);

  if (!kind) {
    throw new Error(`Unsupported local media file: ${file.name}`);
  }

  if (kind === 'video') {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        video.currentTime = Math.min(video.duration * 0.25, Math.max(video.duration - 0.05, 0));
        video.onseeked = () => {
          const canvas = document.createElement('canvas');
          canvas.width = 120;
          canvas.height = 68;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(video, 0, 0, 120, 68);
          const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.7);
          URL.revokeObjectURL(video.src);
          resolve({
            type: 'video',
            duration: video.duration,
            width: video.videoWidth,
            height: video.videoHeight,
            thumbnailUrl,
          });
        };
      };
      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        resolve({ type: 'video' });
      };
      video.src = URL.createObjectURL(file);
    });
  }

  if (kind === 'image') {
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 120;
        canvas.height = 68;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(image, 0, 0, 120, 68);
        const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.7);
        URL.revokeObjectURL(image.src);
        resolve({
          type: 'image',
          width: image.naturalWidth,
          height: image.naturalHeight,
          thumbnailUrl,
        });
      };
      image.onerror = () => {
        URL.revokeObjectURL(image.src);
        resolve({ type: 'image' });
      };
      image.src = URL.createObjectURL(file);
    });
  }

  return new Promise((resolve) => {
    const audioContext = new AudioContext();

    file.arrayBuffer()
      .then((buffer) => audioContext.decodeAudioData(buffer))
      .then((audioBuffer) => {
        resolve({
          type: 'audio',
          duration: audioBuffer.duration,
        });
      })
      .catch(() => {
        resolve({ type: 'audio' });
      })
      .finally(() => {
        void audioContext.close().catch(() => {});
      });
  });
}
