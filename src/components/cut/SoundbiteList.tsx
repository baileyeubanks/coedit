import { C } from '../../theme/colors';
import { FONT_FAMILY, FONT_FAMILY_MONO } from '../../theme/tokens';
import { Icons } from '../../theme/icons';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/Button';
import { useCutStore } from '../../store/cutStore';
import { formatTime } from '../../utils/formatTime';

export function SoundbiteList({ fullWidth = false }: { fullWidth?: boolean }) {
  const soundbites = useCutStore((s) => s.soundbites);
  const selectedSoundbiteId = useCutStore((s) => s.selectedSoundbiteId);
  const markers = useCutStore((s) => s.markers);
  const deleteSoundbite = useCutStore((s) => s.deleteSoundbite);
  const selectSoundbite = useCutStore((s) => s.selectSoundbite);
  const setShowExportModal = useCutStore((s) => s.setShowExportModal);
  const setShowSaveModal = useCutStore((s) => s.setShowSaveModal);

  const totalDuration = soundbites.reduce((total, clip) => total + (clip.end - clip.start), 0);
  const hasSelection = markers.in !== null && markers.out !== null;

  return (
    <aside
      style={{
        minHeight: 0,
        width: '100%',
        maxWidth: fullWidth ? 'none' : 340,
        flexShrink: 0,
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
          gap: 10,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
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
            Clip Bin
          </div>
          <div style={{ fontSize: 18, color: C.text, fontWeight: 700, marginBottom: 4 }}>
            Saved Selects
          </div>
          <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.6 }}>
            Load a clip to restore its markers into review, or preview it to audition that exact range against the source.
          </div>
          {selectedSoundbiteId && (
            <div style={{ fontSize: 11, color: C.accent, marginTop: 8 }}>
              Active clip is driving the current selection.
            </div>
          )}
        </div>

        <div
          style={{
            padding: '8px 10px',
            borderRadius: 16,
            border: `1px solid ${C.border}`,
            background: C.surface2,
            minWidth: 88,
            textAlign: 'right',
          }}
        >
          <div style={{ fontSize: 10, color: C.textDim, textTransform: 'uppercase', letterSpacing: 0.7 }}>
            Clips
          </div>
          <div style={{ fontSize: 18, color: C.text, fontWeight: 700, lineHeight: 1.1 }}>
            {soundbites.length}
          </div>
        </div>
      </div>

      <div
        style={{
          padding: '12px 18px',
          borderBottom: `1px solid ${C.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          fontSize: 11,
          color: C.textDim,
        }}
      >
        <span>Total selected runtime</span>
        <span style={{ fontFamily: FONT_FAMILY_MONO, color: C.text }}>
          {formatTime(totalDuration)}
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {soundbites.length === 0 ? (
          <div
            style={{
              height: '100%',
              minHeight: 240,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              padding: '18px 16px',
              borderRadius: 14,
              border: `1px dashed ${C.border}`,
              color: C.textDim,
              fontSize: 12,
              lineHeight: 1.8,
              fontFamily: FONT_FAMILY,
              background: C.surface2,
            }}
          >
            No clips saved yet.
            <br />
            Frame a quote from the transcript or waveform, then save it here so it stays reusable downstream.
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gap: 10,
              gridTemplateColumns: fullWidth ? 'repeat(auto-fit, minmax(220px, 1fr))' : undefined,
            }}
          >
            {soundbites.map((clip, index) => (
              <div
                key={clip.id}
                onClick={() => selectSoundbite(clip.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    selectSoundbite(clip.id);
                  }
                }}
                role="button"
                tabIndex={0}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '14px 14px 12px',
                  borderRadius: 14,
                  border: `1px solid ${selectedSoundbiteId === clip.id ? `${C.accent}55` : C.border}`,
                  background: selectedSoundbiteId === clip.id ? `${C.accent}10` : C.surface2,
                  cursor: 'pointer',
                  transition: 'all 0.14s ease',
                  boxShadow: selectedSoundbiteId === clip.id ? `0 14px 28px ${C.accentGlow}` : 'none',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    marginBottom: 8,
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      color: C.accent,
                      fontFamily: FONT_FAMILY_MONO,
                      fontWeight: 700,
                      marginTop: 1,
                    }}
                  >
                    {String(index + 1).padStart(2, '0')}
                  </span>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 3 }}>
                      {clip.label}
                    </div>
                    <div style={{ fontSize: 11, color: C.textDim, lineHeight: 1.6 }}>
                      {clip.text || 'Saved clip without transcript excerpt'}
                    </div>
                  </div>

                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      deleteSoundbite(clip.id);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: C.textMuted,
                      padding: 0,
                      lineHeight: 1,
                    }}
                    title="Delete clip"
                  >
                    <Icon d={Icons.trash} size={12} />
                  </button>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 10,
                    color: C.textDim,
                    fontFamily: FONT_FAMILY_MONO,
                  }}
                >
                  <span style={{ color: C.accent }}>
                    {formatTime(clip.start)} → {formatTime(clip.end)}
                  </span>
                  <span style={{ color: C.textMuted }}>•</span>
                  <span>{formatTime(clip.end - clip.start)}</span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    marginTop: 10,
                    paddingTop: 10,
                    borderTop: `1px solid ${C.border}`,
                  }}
                >
                  <Button
                    small
                    active={selectedSoundbiteId === clip.id}
                    onClick={(event) => {
                      event.stopPropagation();
                      selectSoundbite(clip.id);
                    }}
                    style={{ justifyContent: 'center' }}
                  >
                    <Icon d={Icons.layers} size={11} />
                    Load
                  </Button>
                  <Button
                    small
                    onClick={(event) => {
                      event.stopPropagation();
                      selectSoundbite(clip.id, { preview: true });
                    }}
                    style={{ justifyContent: 'center' }}
                  >
                    <Icon d={Icons.play} size={11} />
                    Preview
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div
        style={{
          padding: '12px 14px 14px',
          borderTop: `1px solid ${C.border}`,
          display: 'flex',
          gap: 8,
        }}
      >
        <Button
          small
          accent
          onClick={() => setShowSaveModal(true)}
          disabled={!hasSelection}
          style={{ flex: 1, justifyContent: 'center' }}
        >
          <Icon d={Icons.plus} size={12} /> New Clip
        </Button>
        <Button
          small
          onClick={() => setShowExportModal(true)}
          disabled={soundbites.length === 0}
          style={{ justifyContent: 'center' }}
        >
          <Icon d={Icons.download} size={12} /> Export
        </Button>
      </div>
    </aside>
  );
}
