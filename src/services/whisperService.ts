import { runtimeConfig } from '../config/runtime';

/**
 * Co-Cut timed transcription services.
 *
 * Product contract:
 * - timed transcripts are generated through the API-backed path below
 * - if local transcription is not configured, the UI must block and explain why
 */

export interface WhisperWord {
  word: string;
  start: number; // seconds
  end: number; // seconds
}

export interface TranscriptionResult {
  text: string;
  words: WhisperWord[];
  language: string;
  duration: number;
}

export interface TranscriptionProgress {
  phase: 'extracting-audio' | 'transcribing' | 'done' | 'error';
  percent: number;
  message: string;
}

type ProgressCallback = (progress: TranscriptionProgress) => void;

interface WhisperApiWord {
  word: string;
  start: number;
  end: number;
}

interface WhisperApiResponse {
  text?: string;
  words?: WhisperApiWord[];
  language?: string;
  duration?: number;
}

export const TRANSCRIPTION_CONFIG_ERROR =
  'Timed transcription requires VITE_OPENAI_API_KEY in .env.local.';

export function getTranscriptionConfigError(): string | null {
  return runtimeConfig.aiApiKeys.openai ? null : TRANSCRIPTION_CONFIG_ERROR;
}

export function isTranscriptionConfigured(): boolean {
  return getTranscriptionConfigError() === null;
}

/**
 * Transcribe audio via OpenAI Whisper API with word-level timestamps.
 * Accepts any browser-readable URL (blob: or https:).
 */
export async function transcribeViaAPI(
  src: string,
  onProgress?: ProgressCallback,
  signal?: AbortSignal,
): Promise<TranscriptionResult> {
  const apiKey = runtimeConfig.aiApiKeys.openai;
  if (!apiKey) throw new Error(TRANSCRIPTION_CONFIG_ERROR);

  onProgress?.({ phase: 'extracting-audio', percent: 10, message: 'Fetching source audio...' });

  const fetchResp = await fetch(src, { signal });
  if (!fetchResp.ok) throw new Error(`Failed to fetch source audio: ${fetchResp.statusText}`);
  const blob = await fetchResp.blob();

  if (signal?.aborted) throw new Error('Transcription cancelled');

  const mimeToExt: Record<string, string> = {
    'audio/mp3': 'mp3',
    'audio/mpeg': 'mp3',
    'audio/mp4': 'mp4',
    'audio/m4a': 'm4a',
    'audio/x-m4a': 'm4a',
    'audio/wav': 'wav',
    'audio/wave': 'wav',
    'audio/webm': 'webm',
    'audio/ogg': 'ogg',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/ogg': 'ogg',
    'video/quicktime': 'mp4',
  };
  const ext = mimeToExt[blob.type] ?? 'mp3';

  if (blob.size > 25 * 1024 * 1024) {
    throw new Error(
      `File is ${(blob.size / 1024 / 1024).toFixed(0)}MB. Whisper API limit is 25MB, so trim the source first.`,
    );
  }

  onProgress?.({
    phase: 'transcribing',
    percent: 35,
    message: 'Uploading source audio to Whisper API...',
  });

  const formData = new FormData();
  formData.append('file', blob, `audio.${ext}`);
  formData.append('model', 'whisper-1');
  formData.append('response_format', 'verbose_json');
  formData.append('timestamp_granularities[]', 'word');

  const whisperResp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
    signal,
  });

  if (!whisperResp.ok) {
    const errText = await whisperResp.text();
    throw new Error(`Whisper API error ${whisperResp.status}: ${errText}`);
  }

  onProgress?.({ phase: 'transcribing', percent: 85, message: 'Processing timed transcript...' });

  const data = (await whisperResp.json()) as WhisperApiResponse;
  const words: WhisperWord[] = (data.words ?? []).map((word) => ({
    word: word.word,
    start: word.start,
    end: word.end,
  }));

  onProgress?.({ phase: 'done', percent: 100, message: 'Timed transcript ready' });

  return {
    text: data.text ?? '',
    words,
    language: data.language ?? 'en',
    duration: data.duration ?? 0,
  };
}
