import type { TranscriptionResult, WhisperWord } from '../services/whisperService';
import type { CutMarkers } from '../store/cutStore';

interface WordRange {
  start: number;
  end: number;
}

function clampWord(word: string): string {
  return word.replace(/\s+/g, ' ').trim();
}

export function normalizeWordRange(start: number, end: number): WordRange {
  return start <= end ? { start, end } : { start: end, end: start };
}

export function getNormalizedSelection(markers: CutMarkers): WordRange | null {
  if (markers.in === null || markers.out === null) return null;
  return normalizeWordRange(markers.in, markers.out);
}

export function wordIntersectsRange(word: WhisperWord, range: WordRange): boolean {
  return word.end > range.start && word.start < range.end;
}

export function getWordsInRange(words: WhisperWord[], range: WordRange | null): WhisperWord[] {
  if (!range) return [];
  return words.filter((word) => wordIntersectsRange(word, range));
}

export function getSelectionText(
  transcript: TranscriptionResult | null,
  markers: CutMarkers,
  maxWords?: number,
): string {
  const range = getNormalizedSelection(markers);
  if (!range || !transcript) return '';

  const words = getWordsInRange(transcript.words ?? [], range)
    .map((word) => clampWord(word.word))
    .filter(Boolean);

  const clipped = typeof maxWords === 'number' ? words.slice(0, maxWords) : words;
  return clipped.join(' ').trim();
}

export function getSelectionWordCount(
  transcript: TranscriptionResult | null,
  markers: CutMarkers,
): number {
  return getWordsInRange(transcript?.words ?? [], getNormalizedSelection(markers)).length;
}

export function buildClipLabel(text: string, fallbackIndex = 1): string {
  const tokens = text
    .replace(/[“”"]/g, '')
    .split(/\s+/)
    .map(clampWord)
    .filter(Boolean);

  if (tokens.length === 0) {
    return `Clip ${String(fallbackIndex).padStart(2, '0')}`;
  }

  const base = tokens.slice(0, 6).join(' ');
  return base.length > 48 ? `${base.slice(0, 45).trimEnd()}...` : base;
}

export function getSelectionFromWordIndexes(
  words: WhisperWord[],
  firstIndex: number,
  lastIndex: number,
): WordRange | null {
  if (!words.length) return null;

  const startIndex = Math.max(0, Math.min(firstIndex, lastIndex));
  const endIndex = Math.min(words.length - 1, Math.max(firstIndex, lastIndex));
  const startWord = words[startIndex];
  const endWord = words[endIndex];

  if (!startWord || !endWord) return null;
  return normalizeWordRange(startWord.start, endWord.end);
}
