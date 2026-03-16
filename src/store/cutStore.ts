import { create } from 'zustand';
import type { TranscriptionResult } from '../services/whisperService';
import { buildClipLabel, getNormalizedSelection, getSelectionText } from '../utils/cutSelection';

export interface Soundbite {
  id: string;
  label: string;
  start: number;
  end: number;
  text: string;
}

export interface CutMarkers {
  in: number | null;
  out: number | null;
}

export type SelectionSource = 'waveform' | 'transcript' | 'clip' | null;

interface CutState {
  // Media
  audioUrl: string | null;
  audioBlob: Blob | null;
  fileName: string | null;
  sourceMissing: boolean;
  sourceError: string | null;
  duration: number;

  // Playback
  currentTime: number;
  isPlaying: boolean;

  // Transcription
  transcript: TranscriptionResult | null;
  transcribing: boolean;
  transcribeProgress: number;
  transcribePhase: string;

  // Markers
  markers: CutMarkers;
  selectionSource: SelectionSource;
  selectedSoundbiteId: string | null;

  // Soundbites
  soundbites: Soundbite[];

  // UI
  showExportModal: boolean;
  showSaveModal: boolean;
}

interface CutActions {
  setAudio: (
    url: string,
    fileName: string,
    audioBlob?: Blob | null,
    options?: { preserveSession?: boolean },
  ) => void;
  clearAudio: () => void;
  setCurrentTime: (t: number) => void;
  setIsPlaying: (v: boolean) => void;
  togglePlayback: () => void;
  setDuration: (d: number) => void;
  setTranscript: (t: TranscriptionResult | null) => void;
  setTranscribing: (v: boolean, progress?: number, phase?: string) => void;
  setSourceError: (message: string | null) => void;
  setMarkerIn: (t: number | null, source?: Exclude<SelectionSource, null>) => void;
  setMarkerOut: (t: number | null, source?: Exclude<SelectionSource, null>) => void;
  setSelection: (
    range: CutMarkers,
    options?: {
      source?: Exclude<SelectionSource, null>;
      soundbiteId?: string | null;
      seek?: boolean;
    },
  ) => void;
  clearSelection: () => void;
  saveSoundbite: (label: string) => void;
  deleteSoundbite: (id: string) => void;
  selectSoundbite: (id: string, options?: { preview?: boolean }) => void;
  playSelection: () => void;
  seekToTime: (t: number) => void;
  setShowExportModal: (v: boolean) => void;
  setShowSaveModal: (v: boolean) => void;
}

export type CutStore = CutState & CutActions;

// Seek callback — registered by InterviewWaveform audio element
let _seekCallback: ((t: number) => void) | null = null;
let _playCallback: ((v: boolean) => void) | null = null;

export function registerSeekCallback(cb: (t: number) => void) {
  _seekCallback = cb;
}

export function registerPlayCallback(cb: (v: boolean) => void) {
  _playCallback = cb;
}

function normalizeMarkers(markers: CutMarkers): CutMarkers {
  const normalized = getNormalizedSelection(markers);
  if (!normalized) return markers;
  return { in: normalized.start, out: normalized.end };
}

export const useCutStore = create<CutStore>()((set, get) => ({
  audioUrl: null,
  audioBlob: null,
  fileName: null,
  sourceMissing: false,
  sourceError: null,
  duration: 0,
  currentTime: 0,
  isPlaying: false,
  transcript: null,
  transcribing: false,
  transcribeProgress: 0,
  transcribePhase: '',
  markers: { in: null, out: null },
  selectionSource: null,
  selectedSoundbiteId: null,
  soundbites: [],
  showExportModal: false,
  showSaveModal: false,

  setAudio: (url, fileName, audioBlob = null, options) =>
    set((state) => {
      const preserveSession = Boolean(options?.preserveSession);

      return {
        audioUrl: url,
        audioBlob,
        fileName,
        sourceMissing: false,
        sourceError: null,
        transcript: preserveSession ? state.transcript : null,
        markers: preserveSession ? state.markers : { in: null, out: null },
        selectionSource: preserveSession ? state.selectionSource : null,
        selectedSoundbiteId: preserveSession ? state.selectedSoundbiteId : null,
        soundbites: preserveSession ? state.soundbites : [],
        currentTime: preserveSession ? state.currentTime : 0,
        isPlaying: false,
        duration: preserveSession ? state.duration : 0,
        transcribing: false,
        transcribeProgress: 0,
        transcribePhase: '',
      };
    }),

  clearAudio: () =>
    set({
      audioUrl: null,
      audioBlob: null,
      fileName: null,
      sourceMissing: false,
      sourceError: null,
      transcript: null,
      markers: { in: null, out: null },
      selectionSource: null,
      selectedSoundbiteId: null,
      soundbites: [],
      currentTime: 0,
      isPlaying: false,
      duration: 0,
      transcribing: false,
      transcribeProgress: 0,
      transcribePhase: '',
    }),

  setCurrentTime: (t) => set({ currentTime: t }),
  setIsPlaying: (v) => {
    set({ isPlaying: v });
    _playCallback?.(v);
  },
  togglePlayback: () => {
    const { isPlaying, markers, currentTime } = get();
    if (isPlaying) {
      get().setIsPlaying(false);
      return;
    }

    const selection = getNormalizedSelection(markers);
    if (selection && (currentTime < selection.start || currentTime >= selection.end)) {
      set({ currentTime: selection.start });
      _seekCallback?.(selection.start);
    }

    get().setIsPlaying(true);
  },
  setDuration: (d) => set({ duration: d }),
  setTranscript: (t) => set({ transcript: t, sourceError: null }),
  setTranscribing: (v, progress = 0, phase = '') =>
    set({ transcribing: v, transcribeProgress: progress, transcribePhase: phase }),
  setSourceError: (message) => set({ sourceError: message }),

  setMarkerIn: (t, source = 'waveform') =>
    set((state) => ({
      markers: normalizeMarkers({ ...state.markers, in: t }),
      selectionSource: t === null && state.markers.out === null ? null : source,
      selectedSoundbiteId: source === 'clip' ? state.selectedSoundbiteId : null,
    })),

  setMarkerOut: (t, source = 'waveform') =>
    set((state) => ({
      markers: normalizeMarkers({ ...state.markers, out: t }),
      selectionSource: t === null && state.markers.in === null ? null : source,
      selectedSoundbiteId: source === 'clip' ? state.selectedSoundbiteId : null,
    })),

  setSelection: (range, options) => {
    const nextMarkers = normalizeMarkers(range);
    const source = options?.source ?? 'waveform';

    set({
      markers: nextMarkers,
      selectionSource:
        nextMarkers.in === null && nextMarkers.out === null ? null : source,
      selectedSoundbiteId: options?.soundbiteId ?? (source === 'clip' ? get().selectedSoundbiteId : null),
    });

    if (options?.seek && nextMarkers.in !== null) {
      set({ currentTime: nextMarkers.in });
      _seekCallback?.(nextMarkers.in);
    }
  },

  clearSelection: () =>
    set({
      markers: { in: null, out: null },
      selectionSource: null,
      selectedSoundbiteId: null,
    }),

  saveSoundbite: (label) => {
    const { markers, transcript, currentTime, duration, soundbites } = get();
    const normalized = normalizeMarkers(markers);
    const inPt = normalized.in ?? 0;
    const outPt = normalized.out ?? Math.min(currentTime + 5, duration);
    if (inPt >= outPt) return;

    const text = getSelectionText(
      transcript,
      { in: inPt, out: outPt },
    );
    const resolvedLabel = label.trim() || buildClipLabel(text, soundbites.length + 1);

    const sb: Soundbite = {
      id: `sb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      label: resolvedLabel,
      start: inPt,
      end: outPt,
      text,
    };

    set((s) => ({
      soundbites: [...s.soundbites, sb],
      markers: { in: sb.start, out: sb.end },
      selectionSource: 'clip',
      selectedSoundbiteId: sb.id,
      showSaveModal: false,
    }));
  },

  deleteSoundbite: (id) =>
    set((state) => ({
      soundbites: state.soundbites.filter((clip) => clip.id !== id),
      selectedSoundbiteId: state.selectedSoundbiteId === id ? null : state.selectedSoundbiteId,
      selectionSource:
        state.selectedSoundbiteId === id && state.selectionSource === 'clip'
          ? 'waveform'
          : state.selectionSource,
    })),

  selectSoundbite: (id, options) => {
    const soundbite = get().soundbites.find((clip) => clip.id === id);
    if (!soundbite) return;

    set({
      markers: { in: soundbite.start, out: soundbite.end },
      selectionSource: 'clip',
      selectedSoundbiteId: soundbite.id,
      currentTime: soundbite.start,
    });
    _seekCallback?.(soundbite.start);

    if (options?.preview) {
      get().setIsPlaying(true);
    }
  },

  playSelection: () => {
    const range = getNormalizedSelection(get().markers);
    if (!range) return;
    set({ currentTime: range.start });
    _seekCallback?.(range.start);
    get().setIsPlaying(true);
  },

  seekToTime: (t) => {
    set({ currentTime: t });
    _seekCallback?.(t);
  },

  setShowExportModal: (v) => set({ showExportModal: v }),
  setShowSaveModal: (v) => set({ showSaveModal: v }),
}));
