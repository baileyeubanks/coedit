import { C } from '../../theme/colors';
import { Icons } from '../../theme/icons';
import { FONT_FAMILY, FONT_FAMILY_BRAND, FONT_FAMILY_MONO } from '../../theme/tokens';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { useCutSourceWorkflow } from '../../hooks/useCutSourceWorkflow';
import { useCutStore } from '../../store/cutStore';
import { usePersistenceStore } from '../../store/persistenceStore';
import { formatTime } from '../../utils/formatTime';

function WorkflowRow({
  label,
  detail,
  tone,
}: {
  label: string;
  detail: string;
  tone: 'accent' | 'success' | 'warning' | 'muted';
}) {
  const dotColor =
    tone === 'success' ? C.green : tone === 'warning' ? C.orange : tone === 'accent' ? C.accent2 : C.textMuted;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '10px minmax(0, 1fr)',
        gap: 10,
        padding: '10px 12px',
        borderRadius: 12,
        border: `1px solid ${tone === 'muted' ? C.border : `${dotColor}33`}`,
        background: tone === 'muted' ? C.surface2 : `${dotColor}10`,
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: dotColor,
          marginTop: 5,
          boxShadow: `0 0 10px ${dotColor}55`,
        }}
      />
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 10,
            color: C.textDim,
            textTransform: 'uppercase',
            letterSpacing: 0.7,
            fontWeight: 700,
            marginBottom: 3,
          }}
        >
          {label}
        </div>
        <div style={{ fontSize: 12, color: C.text, lineHeight: 1.5 }}>
          {detail}
        </div>
      </div>
    </div>
  );
}

export function CutSidebar({ compact = false }: { compact?: boolean }) {
  const projectName = usePersistenceStore((s) => s.projectName);
  const audioUrl = useCutStore((s) => s.audioUrl);
  const fileName = useCutStore((s) => s.fileName);
  const transcript = useCutStore((s) => s.transcript);
  const transcribing = useCutStore((s) => s.transcribing);
  const transcribePhase = useCutStore((s) => s.transcribePhase);
  const markers = useCutStore((s) => s.markers);
  const soundbites = useCutStore((s) => s.soundbites);
  const sourceMissing = useCutStore((s) => s.sourceMissing);
  const sourceError = useCutStore((s) => s.sourceError);
  const setShowSaveModal = useCutStore((s) => s.setShowSaveModal);
  const setShowExportModal = useCutStore((s) => s.setShowExportModal);
  const { canTranscribe, generateTranscript, promptForSourceFile } = useCutSourceWorkflow();

  const hasSelection = markers.in !== null && markers.out !== null;
  const totalClipDuration = soundbites.reduce((total, clip) => total + (clip.end - clip.start), 0);
  const transcriptDetail = transcribing
    ? transcribePhase || 'Generating transcript'
    : transcript?.words?.length
      ? `${transcript.words.length} timestamped words ready to review`
      : transcript?.text
        ? 'Transcript loaded without word timing'
        : 'Transcript not generated yet';
  const selectionDetail = hasSelection
    ? `${formatTime(markers.in!)} to ${formatTime(markers.out!)} selected`
    : 'Set an In and Out point to frame the current select';
  const sourceButtonLabel = sourceMissing ? 'Reconnect Source' : audioUrl ? 'Replace Source' : 'Import Source';
  const transcriptButtonLabel = transcript ? 'Re-run Transcript' : 'Generate Transcript';
  const canGenerateTranscript = Boolean(audioUrl) && !transcribing;

  return (
    <aside
      style={{
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: compact ? 12 : 14,
        borderRadius: 14,
        border: `1px solid ${C.border}`,
        background: C.surface,
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '16px 16px 14px',
          borderRadius: 14,
          background: C.bg,
          border: `1px solid ${C.border}`,
        }}
      >
        <div
          style={{
            fontSize: 10,
            color: C.copper,
            textTransform: 'uppercase',
            letterSpacing: 0.9,
            fontWeight: 700,
            marginBottom: 8,
          }}
        >
          Transcript Session
        </div>
        <div
          style={{
            fontFamily: FONT_FAMILY_BRAND,
            fontSize: 24,
            lineHeight: 1.05,
            color: C.text,
            marginBottom: 10,
          }}
        >
          {projectName}
        </div>
        <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.6 }}>
          Shape the story in transcript first, then hand the strongest selects into the assembly timeline.
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gap: 10,
          gridTemplateColumns: compact ? 'repeat(auto-fit, minmax(220px, 1fr))' : undefined,
        }}
      >
        <WorkflowRow
          label="Ingest"
          detail={
            sourceMissing
              ? `Reconnect ${fileName || 'the source media'} to audition this session`
              : fileName || 'Import an interview audio or video file to begin'
          }
          tone={sourceMissing ? 'warning' : fileName ? 'success' : 'muted'}
        />
        <WorkflowRow label="Transcript" detail={transcriptDetail} tone={transcribing ? 'accent' : transcript ? 'success' : 'warning'} />
        <WorkflowRow label="Selection" detail={selectionDetail} tone={hasSelection ? 'accent' : 'muted'} />
        <WorkflowRow
          label="Clip Bin"
          detail={
            soundbites.length > 0
              ? `${soundbites.length} saved clip${soundbites.length === 1 ? '' : 's'} totaling ${formatTime(totalClipDuration)}`
              : 'Save selects as you mark them to build a reusable clip bin'
          }
          tone={soundbites.length > 0 ? 'success' : 'muted'}
        />
      </div>

      <div
        style={{
          display: 'grid',
          gap: 12,
          gridTemplateColumns: compact ? 'repeat(auto-fit, minmax(240px, 1fr))' : undefined,
          marginTop: compact ? 0 : 'auto',
        }}
      >
        <div
          style={{
            padding: '14px 16px',
            borderRadius: 16,
            border: `1px solid ${sourceMissing ? `${C.orange}33` : C.border}`,
            background: sourceMissing ? `${C.orange}12` : C.surface2,
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: C.textDim,
              textTransform: 'uppercase',
              letterSpacing: 0.8,
              fontWeight: 700,
              marginBottom: 8,
            }}
          >
            Session Source
          </div>
          <div style={{ fontSize: 12, color: C.text, fontWeight: 600, marginBottom: 4 }}>
            {fileName || 'No source attached yet'}
          </div>
          <div style={{ fontSize: 11, color: C.textDim, lineHeight: 1.6 }}>
            {sourceMissing
              ? 'Transcript and saved clips are still part of this project. Reconnect a local copy to restore playback on this browser.'
              : audioUrl
                ? 'This source file is attached to the current local project draft. Heavy media stays in browser storage only.'
                : 'Attach the interview source first so the transcript and clip review stay anchored to one primary file.'}
          </div>
          {sourceError && (
            <div
              style={{
                marginTop: 10,
                padding: '9px 10px',
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
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <Button
              small
              accent
              onClick={() => {
                void promptForSourceFile({ mode: sourceMissing ? 'reconnect' : audioUrl ? 'replace' : 'new' });
              }}
              style={{ justifyContent: 'center' }}
            >
              <Icon d={Icons.upload} size={12} /> {sourceButtonLabel}
            </Button>
            <Button
              small
              onClick={() => {
                void generateTranscript();
              }}
              disabled={!canGenerateTranscript || !canTranscribe}
              style={{ justifyContent: 'center' }}
              title={
                canTranscribe
                  ? 'Generate or refresh the transcript from the attached local source'
                  : 'Timed transcription requires VITE_OPENAI_API_KEY in .env.local'
              }
            >
              <Icon d={Icons.text} size={12} /> {transcriptButtonLabel}
            </Button>
          </div>
        </div>

        <div
          style={{
            padding: '14px 16px',
            borderRadius: 16,
            border: `1px solid ${hasSelection ? `${C.accent}44` : C.border}`,
            background: hasSelection ? `${C.accent}12` : C.surface2,
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: C.textDim,
              textTransform: 'uppercase',
              letterSpacing: 0.8,
              fontWeight: 700,
              marginBottom: 8,
            }}
          >
            Current Selection
          </div>

          {hasSelection ? (
            <>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <div
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    borderRadius: 12,
                    background: `${C.green}12`,
                    border: `1px solid ${C.green}22`,
                  }}
                >
                  <div style={{ fontSize: 9, color: C.green, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2 }}>
                    In
                  </div>
                  <div style={{ fontSize: 12, color: C.text, fontFamily: FONT_FAMILY_MONO }}>
                    {formatTime(markers.in!)}
                  </div>
                </div>
                <div
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    borderRadius: 12,
                    background: `${C.orange}12`,
                    border: `1px solid ${C.orange}22`,
                  }}
                >
                  <div style={{ fontSize: 9, color: C.orange, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2 }}>
                    Out
                  </div>
                  <div style={{ fontSize: 12, color: C.text, fontFamily: FONT_FAMILY_MONO }}>
                    {formatTime(markers.out!)}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 11, color: C.textDim, marginBottom: 12 }}>
                Selection length {formatTime(markers.out! - markers.in!)}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 12, lineHeight: 1.6, color: C.textDim, marginBottom: 12 }}>
              Drag across transcript words to frame the quote, or refine it with waveform marks. Saved clips reload the same selection back into review.
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              small
              accent
              onClick={() => setShowSaveModal(true)}
              disabled={!hasSelection}
              style={{ flex: 1, justifyContent: 'center' }}
            >
              <Icon d={Icons.plus} size={12} /> Save Clip
            </Button>
            <Button
              small
              onClick={() => setShowExportModal(true)}
              disabled={soundbites.length === 0}
              style={{ justifyContent: 'center' }}
            >
              <Icon d={Icons.download} size={12} />
            </Button>
          </div>
        </div>

        <div
          style={{
            padding: '14px 16px',
            borderRadius: 16,
            border: `1px solid ${C.border}`,
            background: C.surface2,
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: C.textDim,
              textTransform: 'uppercase',
              letterSpacing: 0.8,
              fontWeight: 700,
              marginBottom: 10,
            }}
          >
            Cut Shortcuts
          </div>
          <div style={{ display: 'grid', gap: 8, fontSize: 11, color: C.textDim, fontFamily: FONT_FAMILY }}>
            <div><code style={{ color: C.accent }}>Space</code> Play or pause the source</div>
            <div><code style={{ color: C.accent }}>I</code> Mark the start of the quote</div>
            <div><code style={{ color: C.accent }}>O</code> Mark the end of the quote</div>
            <div><code style={{ color: C.accent }}>Enter</code> Save the active clip</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
