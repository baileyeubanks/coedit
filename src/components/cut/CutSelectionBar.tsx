import { C } from '../../theme/colors';
import { FONT_FAMILY_MONO } from '../../theme/tokens';
import { Icons } from '../../theme/icons';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/Button';
import { useCutStore } from '../../store/cutStore';
import { formatTime } from '../../utils/formatTime';
import { getSelectionText, getSelectionWordCount } from '../../utils/cutSelection';

export function CutSelectionBar({ compact = false }: { compact?: boolean }) {
  const transcript = useCutStore((s) => s.transcript);
  const markers = useCutStore((s) => s.markers);
  const selectionSource = useCutStore((s) => s.selectionSource);
  const selectedSoundbiteId = useCutStore((s) => s.selectedSoundbiteId);
  const soundbites = useCutStore((s) => s.soundbites);
  const playSelection = useCutStore((s) => s.playSelection);
  const clearSelection = useCutStore((s) => s.clearSelection);
  const setShowSaveModal = useCutStore((s) => s.setShowSaveModal);

  const hasSelection = markers.in !== null && markers.out !== null;
  const selectedClip = soundbites.find((clip) => clip.id === selectedSoundbiteId) ?? null;
  const selectionDuration =
    hasSelection ? formatTime(Math.abs(markers.out! - markers.in!)) : null;
  const selectionText = getSelectionText(transcript, markers, 28);
  const selectionWordCount = getSelectionWordCount(transcript, markers);
  const isEmpty = !hasSelection && !selectedClip;

  const sourceLabel =
    isEmpty
      ? 'Build a select'
      : selectionSource === 'clip'
        ? 'Loaded clip'
        : selectionSource === 'transcript'
          ? 'Transcript selection'
          : selectionSource === 'waveform'
            ? 'Waveform selection'
            : 'Active select';

  return (
    <section
      style={{
        display: 'grid',
        gap: 14,
        padding: compact ? '14px 16px' : '16px 18px',
        borderRadius: 20,
        border: `1px solid ${hasSelection ? `${C.accent}44` : C.border}`,
        background: hasSelection
          ? `linear-gradient(180deg, ${C.accent}14 0%, rgba(11, 17, 28, 0.98) 100%)`
          : 'linear-gradient(180deg, rgba(14, 23, 36, 0.98) 0%, rgba(10, 16, 27, 0.98) 100%)',
        boxShadow: '0 20px 40px rgba(0,0,0,0.16)',
      }}
    >
      <div
        style={{
          display: 'grid',
          gap: 12,
          minWidth: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: compact ? 'flex-start' : 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexDirection: compact ? 'column' : 'row',
          }}
        >
          <div style={{ minWidth: 0, display: 'grid', gap: 10 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                flexWrap: 'wrap',
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 10px',
                  borderRadius: 999,
                  border: `1px solid ${hasSelection ? `${C.accent}33` : C.border}`,
                  background: hasSelection ? `${C.accent}14` : C.surface2,
                  fontSize: 10,
                  color: hasSelection ? C.accent2 : C.textDim,
                  fontWeight: 700,
                  letterSpacing: 0.7,
                  textTransform: 'uppercase',
                }}
              >
                <Icon d={Icons.layers} size={11} color={hasSelection ? C.accent2 : C.textDim} />
                {sourceLabel}
              </span>

              {hasSelection && (
                <>
                  <span
                    style={{
                      fontSize: 12,
                      color: C.text,
                      fontFamily: FONT_FAMILY_MONO,
                    }}
                  >
                    {formatTime(markers.in!)} → {formatTime(markers.out!)}
                  </span>
                  <span style={{ color: C.textMuted }}>•</span>
                  <span style={{ fontSize: 12, color: C.textDim }}>
                    {selectionDuration}
                  </span>
                  {selectionWordCount > 0 && (
                    <>
                      <span style={{ color: C.textMuted }}>•</span>
                      <span style={{ fontSize: 12, color: C.textDim }}>
                        {selectionWordCount} word{selectionWordCount === 1 ? '' : 's'}
                      </span>
                    </>
                  )}
                </>
              )}
            </div>

            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 16,
                  color: C.text,
                  fontWeight: 700,
                  marginBottom: 4,
                }}
              >
                {selectedClip ? selectedClip.label : hasSelection ? 'Active Select' : 'No clip framed yet'}
              </div>
              <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.65 }}>
                {selectedClip
                  ? 'This saved clip is now driving the active selection. Load it to keep editing, or preview it against the source.'
                  : hasSelection
                    ? 'The transcript excerpt below matches the exact In and Out points currently loaded into review.'
                    : 'Use the transcript to jump to promising lines, then frame them with transcript drag or waveform In/Out marks before saving a clip.'}
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
              justifyContent: compact ? 'flex-start' : 'flex-end',
            }}
          >
            <Button small onClick={playSelection} disabled={!hasSelection}>
              <Icon d={Icons.play} size={11} />
              Play Select
            </Button>
            <Button small accent onClick={() => setShowSaveModal(true)} disabled={!hasSelection}>
              <Icon d={Icons.plus} size={11} />
              Save Clip
            </Button>
            <Button small onClick={clearSelection} disabled={!hasSelection}>
              <Icon d={Icons.close} size={11} />
              Clear
            </Button>
          </div>
        </div>
      </div>

      <div
        style={{
          minHeight: 20,
          padding: '12px 14px',
          borderRadius: 16,
          border: `1px solid ${hasSelection ? `${C.accent}22` : C.border}`,
          background: hasSelection ? `${C.accent}10` : C.surface2,
        }}
      >
        {hasSelection ? (
          <div style={{ fontSize: 13, color: C.text, lineHeight: 1.65 }}>
            {selectionText || 'This range is ready to save, but no transcript words intersect the current bounds yet.'}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.65 }}>
            Click transcript words to audition the source, drag across a phrase to define the quote, or set <strong>I</strong> / <strong>O</strong> directly on the waveform. Saved clips reload the same bounds here for another pass.
          </div>
        )}
      </div>
    </section>
  );
}
