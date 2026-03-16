import { useCallback, useEffect, useRef } from 'react';
import { useCutStore } from '../store/cutStore';
import { usePersistenceStore } from '../store/persistenceStore';
import {
  getTranscriptionConfigError,
  isTranscriptionConfigured,
  transcribeViaAPI,
} from '../services/whisperService';
import {
  CUT_SOURCE_ACCEPT_ATTRIBUTE,
  getSuggestedProjectName,
  validateCutSourceFile,
} from '../utils/localMedia';

type SourceAttachMode = 'new' | 'replace' | 'reconnect';

function revokeBlobUrl(url: string | null) {
  if (url?.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
}

function shouldAdoptSuggestedName(projectName: string): boolean {
  return !projectName.trim() || /^untitled project(?: \(\d+\))?$/i.test(projectName.trim());
}

function pickLocalSourceFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = CUT_SOURCE_ACCEPT_ATTRIBUTE;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
}

export function useCutSourceWorkflow() {
  const abortRef = useRef<AbortController | null>(null);

  const audioUrl = useCutStore((state) => state.audioUrl);
  const fileName = useCutStore((state) => state.fileName);
  const transcript = useCutStore((state) => state.transcript);
  const transcribing = useCutStore((state) => state.transcribing);
  const soundbites = useCutStore((state) => state.soundbites);
  const setAudio = useCutStore((state) => state.setAudio);
  const setSourceError = useCutStore((state) => state.setSourceError);
  const setTranscript = useCutStore((state) => state.setTranscript);
  const setTranscribing = useCutStore((state) => state.setTranscribing);

  const projectName = usePersistenceStore((state) => state.projectName);
  const setProjectName = usePersistenceStore((state) => state.setProjectName);

  const canTranscribe = isTranscriptionConfigured();

  const runTranscription = useCallback(
    async (sourceUrl: string) => {
      if (!canTranscribe) {
        setSourceError(getTranscriptionConfigError() ?? 'Timed transcription is unavailable.');
        return false;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setSourceError(null);
      setTranscribing(true, 0, 'Preparing source');

      try {
        const result = await transcribeViaAPI(
          sourceUrl,
          (progress) => setTranscribing(true, progress.percent, progress.message),
          controller.signal,
        );
        setTranscript(result);
        return true;
      } catch (error) {
        if (error instanceof Error && error.message === 'Transcription cancelled') {
          return false;
        }

        const message = error instanceof Error ? error.message : 'Transcription failed.';
        setSourceError(message);
        return false;
      } finally {
        setTranscribing(false);
      }
    },
    [canTranscribe, setSourceError, setTranscript, setTranscribing],
  );

  const ingestSourceFile = useCallback(
    async (
      file: File,
      options: {
        mode?: SourceAttachMode;
        autoTranscribe?: boolean;
      } = {},
    ) => {
      const mode = options.mode ?? 'new';
      const validationError = validateCutSourceFile(file);
      if (validationError) {
        setSourceError(validationError);
        return false;
      }

      if (mode !== 'reconnect') {
        revokeBlobUrl(audioUrl);
      }

      const nextUrl = URL.createObjectURL(file);
      const preserveSession = mode === 'reconnect';
      setSourceError(null);
      setAudio(nextUrl, file.name, file, { preserveSession });

      if (mode !== 'reconnect' && shouldAdoptSuggestedName(projectName)) {
        setProjectName(getSuggestedProjectName(file.name));
      }

      const shouldTranscribe =
        options.autoTranscribe
        ?? (mode === 'reconnect' ? transcript === null && canTranscribe : canTranscribe);

      if (shouldTranscribe) {
        return runTranscription(nextUrl);
      }

      return true;
    },
    [audioUrl, canTranscribe, projectName, runTranscription, setAudio, setProjectName, setSourceError, transcript],
  );

  const promptForSourceFile = useCallback(
    async (options: { mode?: SourceAttachMode } = {}) => {
      const mode = options.mode ?? 'new';

      if (
        mode === 'replace'
        && (Boolean(fileName) || Boolean(transcript) || soundbites.length > 0)
        && !window.confirm('Replacing the source will clear the current transcript, selection, and saved clips for this cut session. Continue?')
      ) {
        return false;
      }

      const file = await pickLocalSourceFile();
      if (!file) return false;
      return ingestSourceFile(file, { mode });
    },
    [fileName, ingestSourceFile, soundbites.length, transcript],
  );

  const generateTranscript = useCallback(async () => {
    if (!audioUrl) {
      setSourceError('Attach a local audio or video source before generating a transcript.');
      return false;
    }

    return runTranscription(audioUrl);
  }, [audioUrl, runTranscription, setSourceError]);

  useEffect(() => () => abortRef.current?.abort(), []);

  return {
    canTranscribe,
    generateTranscript,
    ingestSourceFile,
    promptForSourceFile,
    transcribing,
  };
}
