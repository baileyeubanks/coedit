import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { C } from '../../theme/colors';
import { FONT_FAMILY } from '../../theme/tokens';
import { Icons } from '../../theme/icons';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { useCutSourceWorkflow } from '../../hooks/useCutSourceWorkflow';
import { useCutStore } from '../../store/cutStore';
import type { WhisperWord } from '../../services/whisperService';
import { formatTime } from '../../utils/formatTime';
import {
  getSelectionFromWordIndexes,
  getSelectionText,
  getSelectionWordCount,
  wordIntersectsRange,
} from '../../utils/cutSelection';

function buildParagraphs(words: WhisperWord[]) {
  const paragraphs: Array<Array<{ index: number; word: WhisperWord }>> = [];
  let current: Array<{ index: number; word: WhisperWord }> = [];

  words.forEach((word, index) => {
    current.push({ index, word });
    const endsSentence = /[.!?]["']?$/.test(word.word.trim());
    if ((endsSentence && current.length >= 8) || current.length >= 24) {
      paragraphs.push(current);
      current = [];
    }
  });

  if (current.length > 0) paragraphs.push(current);
  return paragraphs;
}

interface DraftSelection {
  startIndex: number;
  endIndex: number;
}

export function TranscriptPanel() {
  const audioUrl = useCutStore((s) => s.audioUrl);
  const fileName = useCutStore((s) => s.fileName);
  const transcript = useCutStore((s) => s.transcript);
  const currentTime = useCutStore((s) => s.currentTime);
  const transcribing = useCutStore((s) => s.transcribing);
  const transcribeProgress = useCutStore((s) => s.transcribeProgress);
  const transcribePhase = useCutStore((s) => s.transcribePhase);
  const markers = useCutStore((s) => s.markers);
  const selectionSource = useCutStore((s) => s.selectionSource);
  const selectedSoundbiteId = useCutStore((s) => s.selectedSoundbiteId);
  const soundbites = useCutStore((s) => s.soundbites);
  const sourceMissing = useCutStore((s) => s.sourceMissing);
  const sourceError = useCutStore((s) => s.sourceError);
  const seekToTime = useCutStore((s) => s.seekToTime);
  const setSelection = useCutStore((s) => s.setSelection);
  const { canTranscribe, generateTranscript, promptForSourceFile } = useCutSourceWorkflow();

  const activeWordRef = useRef<HTMLButtonElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const draftSelectionRef = useRef<DraftSelection | null>(null);
  const [draftSelection, setDraftSelection] = useState<DraftSelection | null>(null);

  const words = useMemo<WhisperWord[]>(() => transcript?.words ?? [], [transcript]);
  const paragraphs = useMemo(() => buildParagraphs(words), [words]);
  const activeIdx = words.findIndex((word) => currentTime >= word.start && currentTime < word.end);
  const hasSelection = markers.in !== null && markers.out !== null;
  const selectedClip = soundbites.find((clip) => clip.id === selectedSoundbiteId) ?? null;
  const selectionWordCount = getSelectionWordCount(transcript, markers);
  const selectionText = getSelectionText(transcript, markers, 26);
  const wordsRef = useRef<WhisperWord[]>(words);

  const draftRange = useMemo(() => {
    if (!draftSelection) return null;
    return getSelectionFromWordIndexes(
      words,
      draftSelection.startIndex,
      draftSelection.endIndex,
    );
  }, [draftSelection, words]);

  useEffect(() => {
    draftSelectionRef.current = draftSelection;
  }, [draftSelection]);

  useEffect(() => {
    wordsRef.current = words;
  }, [words]);

  useEffect(() => {
    if (activeWordRef.current && containerRef.current) {
      const container = containerRef.current;
      const word = activeWordRef.current;
      const wordTop = word.offsetTop;
      const scrollTop = container.scrollTop;
      const containerHeight = container.clientHeight;
      const threshold = containerHeight * 0.58;

      if (wordTop - scrollTop > threshold || wordTop - scrollTop < containerHeight * 0.16) {
        container.scrollTo({ top: Math.max(0, wordTop - containerHeight / 2), behavior: 'smooth' });
      }
    }
  }, [activeIdx]);

  const finalizeDraftSelection = useCallback(() => {
    const draft = draftSelectionRef.current;
    if (!draft) return;

    const nextRange = getSelectionFromWordIndexes(
      wordsRef.current,
      draft.startIndex,
      draft.endIndex,
    );
    if (!nextRange) {
      setDraftSelection(null);
      draftSelectionRef.current = null;
      return;
    }

    if (draft.startIndex === draft.endIndex) {
      seekToTime(nextRange.start);
    } else {
      setSelection(
        { in: nextRange.start, out: nextRange.end },
        { source: 'transcript', seek: true },
      );
    }

    setDraftSelection(null);
    draftSelectionRef.current = null;
  }, [seekToTime, setSelection]);

  useEffect(() => {
    const handlePointerUp = () => {
      if (!draftSelectionRef.current) return;
      finalizeDraftSelection();
    };

    window.addEventListener('pointerup', handlePointerUp);
    return () => window.removeEventListener('pointerup', handlePointerUp);
  }, [finalizeDraftSelection]);

  const isMarkedRange = (word: WhisperWord) => {
    if (!hasSelection) return false;
    return wordIntersectsRange(word, { start: markers.in!, end: markers.out! });
  };

  const isDraftRange = (word: WhisperWord) => {
    if (!draftRange) return false;
    return wordIntersectsRange(word, draftRange);
  };

  return (
    <section
      style={{
        minWidth: 0,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 14,
        border: `1px solid ${C.border}`,
        background: C.surface,
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      }}
    >
      <div
        style={{
          padding: '16px 18px 14px',
          borderBottom: `1px solid ${C.border}`,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          flexShrink: 0,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 10,
              color: C.copper,
              fontWeight: 700,
              letterSpacing: 0.8,
              textTransform: 'uppercase',
              marginBottom: 6,
            }}
          >
            Transcript Review
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 4 }}>
            Cut directly from the transcript
          </div>
          <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.6 }}>
            Click any word to audition it. Drag across a phrase to set the clip range, then keep refining against the waveform.
          </div>
        </div>

        <div style={{ display: 'grid', gap: 8, flexShrink: 0 }}>
          <div
            style={{
              padding: '7px 10px',
              borderRadius: 999,
              border: `1px solid ${C.border}`,
              background: C.surface2,
              fontSize: 10,
              color: C.textDim,
              fontFamily: FONT_FAMILY,
            }}
          >
            {transcribing
              ? 'Transcript in progress'
              : transcript
                ? `${words.length > 0 ? words.length : 'Full'} transcript units ready`
                : 'Awaiting transcript'}
          </div>

          {(selectedClip || hasSelection) && (
            <div
              style={{
                padding: '7px 10px',
                borderRadius: 999,
                border: `1px solid ${C.accent}44`,
                background: `${C.accent}12`,
                fontSize: 10,
                color: C.accent,
                fontFamily: FONT_FAMILY,
              }}
            >
              {selectedClip
                ? `Loaded clip: ${selectedClip.label}`
                : selectionSource === 'transcript'
                  ? 'Transcript-defined range'
                  : 'Selection ready'}
            </div>
          )}
        </div>
      </div>

      <div
        ref={containerRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '18px 18px 26px',
          fontFamily: FONT_FAMILY,
        }}
      >
        {(hasSelection || draftRange) && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              margin: '0 auto 16px',
              maxWidth: 920,
              borderRadius: 14,
              border: `1px solid ${(draftRange && !hasSelection) ? `${C.orange}33` : `${C.accent}33`}`,
              background: (draftRange && !hasSelection) ? `${C.orange}12` : `${C.accent}12`,
              color: C.text,
              flexWrap: 'wrap',
            }}
          >
            <span
              style={{
                fontSize: 10,
                color: draftRange && !hasSelection ? C.orange : C.accent2,
                textTransform: 'uppercase',
                letterSpacing: 0.7,
                fontWeight: 700,
              }}
            >
              {draftRange && !hasSelection ? 'Draft range' : 'Active select'}
            </span>
            {hasSelection && (
              <>
                <span style={{ fontSize: 11, color: C.textDim }}>
                  {formatTime(markers.in!)} to {formatTime(markers.out!)}
                </span>
                <span style={{ color: C.textMuted }}>•</span>
                <span style={{ fontSize: 11, color: C.textDim }}>
                  {selectionWordCount} word{selectionWordCount === 1 ? '' : 's'}
                </span>
                <span style={{ color: C.textMuted }}>•</span>
                <span style={{ fontSize: 11, color: C.textDim }}>
                  {selectionText || 'Playback range ready'}
                </span>
              </>
            )}
            {draftRange && !hasSelection && (
              <span style={{ fontSize: 11, color: C.textDim }}>
                Release to mark {formatTime(draftRange.start)} to {formatTime(draftRange.end)} from the transcript.
              </span>
            )}
          </div>
        )}

        {!transcribing && words.length > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
              maxWidth: 920,
              margin: '0 auto 16px',
            }}
          >
            {['Click word = audition', 'Drag phrase = set clip', 'Saved clips reload here'].map((hint) => (
              <span
                key={hint}
                style={{
                  padding: '6px 10px',
                  borderRadius: 999,
                  border: `1px solid ${C.border}`,
                  background: C.surface2,
                  fontSize: 10,
                  color: C.textDim,
                  letterSpacing: 0.4,
                }}
              >
                {hint}
              </span>
            ))}
          </div>
        )}

        {transcribing && (
          <div style={{ textAlign: 'center', paddingTop: 80 }}>
            <div style={{ fontSize: 13, color: C.text, marginBottom: 8, fontWeight: 600 }}>
              {transcribePhase || 'Transcribing source'}
            </div>
            <div style={{ fontSize: 11, color: C.textDim, marginBottom: 18 }}>
              Co-Cut is generating timed transcript words for faster selection.
            </div>
            <div
              style={{
                width: 'min(480px, 100%)',
                margin: '0 auto',
                height: 4,
                background: C.surface3,
                borderRadius: 999,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${transcribeProgress}%`,
                  background: `linear-gradient(90deg, ${C.accent}, ${C.accent2})`,
                  borderRadius: 999,
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>
        )}

        {!transcribing && !transcript && (
          <div
            style={{
              maxWidth: 760,
              margin: '60px auto 0',
              padding: '24px 24px 22px',
              borderRadius: 18,
              border: `1px solid ${C.border}`,
              background: C.surface2,
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 16, color: C.text, fontWeight: 700, marginBottom: 8 }}>
              {audioUrl
                ? 'Transcript is ready to generate from this source'
                : sourceMissing
                  ? 'Reconnect the local source to continue transcript review'
                  : 'Transcript appears here once the source is attached'}
            </div>
            <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.7 }}>
              {sourceMissing
                ? `Transcript and saved clips still belong to ${fileName || 'this project'}. Reconnect the local media on this browser to resume playback and transcript generation.`
                : audioUrl
                  ? canTranscribe
                    ? 'The source is attached locally. Generate timed transcript words whenever you are ready.'
                    : 'The source is attached locally. Add VITE_OPENAI_API_KEY to .env.local to enable timed transcription in this browser.'
                  : 'Import source media to start a cut session. Co-Cut keeps the heavy source local to this browser and stores transcript state with the project.'}
            </div>
            {sourceError && (
              <div
                style={{
                  marginTop: 14,
                  padding: '10px 12px',
                  borderRadius: 12,
                  border: `1px solid ${C.orange}33`,
                  background: `${C.orange}10`,
                  color: C.orange,
                  fontSize: 11,
                  lineHeight: 1.5,
                }}
              >
                {sourceError}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginTop: 16 }}>
              <Button
                small
                accent
                onClick={() => {
                  void promptForSourceFile({ mode: sourceMissing ? 'reconnect' : audioUrl ? 'replace' : 'new' });
                }}
              >
                <Icon d={Icons.upload} size={12} /> {sourceMissing ? 'Reconnect Source' : audioUrl ? 'Replace Source' : 'Import Source'}
              </Button>
              <Button
                small
                onClick={() => {
                  void generateTranscript();
                }}
                disabled={!audioUrl || !canTranscribe}
                title={
                  canTranscribe
                    ? 'Generate transcript from the attached local source'
                    : 'Timed transcription requires VITE_OPENAI_API_KEY in .env.local'
                }
              >
                <Icon d={Icons.text} size={12} /> Generate Transcript
              </Button>
            </div>
          </div>
        )}

        {!transcribing && words.length > 0 && (
          <div style={{ display: 'grid', gap: 18, maxWidth: 920, margin: '0 auto' }}>
            {paragraphs.map((paragraph, paragraphIndex) => {
              const paragraphHasMarkedRange = paragraph.some(({ word }) => isMarkedRange(word));
              const paragraphHasDraftRange = paragraph.some(({ word }) => isDraftRange(word));

              return (
                <p
                  key={paragraphIndex}
                  style={{
                    margin: 0,
                    padding: '16px 18px',
                    borderRadius: 14,
                    border: `1px solid ${
                      paragraphHasDraftRange
                        ? `${C.orange}22`
                        : paragraphHasMarkedRange
                          ? `${C.accent}22`
                          : C.border
                    }`,
                    background: paragraphHasDraftRange
                      ? `${C.orange}08`
                      : paragraphHasMarkedRange
                        ? `${C.accent}08`
                        : C.surface2,
                    fontSize: 15,
                    lineHeight: 2.1,
                    color: C.text,
                  }}
                >
                  {paragraph.map(({ index, word }) => {
                    const active = index === activeIdx;
                    const inMarkedRange = isMarkedRange(word);
                    const inDraftRange = isDraftRange(word);

                    return (
                      <button
                        key={index}
                        ref={active ? activeWordRef : undefined}
                        onPointerDown={(event) => {
                          if (event.button !== 0) return;
                          event.preventDefault();
                          setDraftSelection({ startIndex: index, endIndex: index });
                          draftSelectionRef.current = { startIndex: index, endIndex: index };
                        }}
                        onPointerEnter={() => {
                          if (!draftSelectionRef.current) return;
                          const nextDraft = {
                            ...draftSelectionRef.current,
                            endIndex: index,
                          };
                          draftSelectionRef.current = nextDraft;
                          setDraftSelection(nextDraft);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            seekToTime(word.start);
                          }
                        }}
                        title={`${word.start.toFixed(2)}s`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: active ? '4px 8px' : inDraftRange || inMarkedRange ? '3px 6px' : '2px 4px',
                          marginRight: 4,
                          marginBottom: 6,
                          borderRadius: 999,
                          border: `1px solid ${
                            active
                              ? `${C.accent2}55`
                              : inDraftRange
                                ? `${C.orange}44`
                                : inMarkedRange
                                  ? `${C.accent}22`
                                  : 'transparent'
                          }`,
                          background: active
                            ? C.accent
                            : inDraftRange
                              ? `${C.orange}18`
                              : inMarkedRange
                                ? `${C.accent}18`
                                : 'transparent',
                          color: active
                            ? '#08111f'
                            : inDraftRange
                              ? C.orange
                              : inMarkedRange
                                ? C.accent2
                                : C.text,
                          fontWeight: active ? 700 : inDraftRange || inMarkedRange ? 600 : 500,
                          fontSize: 15,
                          cursor: 'pointer',
                          transition: 'all 0.12s ease',
                          boxShadow: active ? `0 12px 28px ${C.accentGlow}` : 'none',
                          userSelect: 'none',
                        }}
                      >
                        {word.word}
                      </button>
                    );
                  })}
                </p>
              );
            })}
          </div>
        )}

        {!transcribing && transcript && words.length === 0 && transcript.text && (
          <div
            style={{
              maxWidth: 860,
              margin: '0 auto',
              padding: '22px 24px',
              borderRadius: 18,
              border: `1px solid ${C.border}`,
              background: C.surface2,
              fontSize: 15,
              color: C.text,
              lineHeight: 1.9,
              whiteSpace: 'pre-wrap',
            }}
          >
            {transcript.text}
          </div>
        )}
      </div>
    </section>
  );
}
