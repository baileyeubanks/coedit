import { useState } from 'react';
import { C } from '../../theme/colors';
import { FONT_FAMILY, FONT_FAMILY_BRAND } from '../../theme/tokens';
import { Icons } from '../../theme/icons';
import { Icon } from './Icon';
import { Button } from './Button';
import { useCutStore } from '../../store/cutStore';
import { useUIStore, COMPOSITION_PRESETS } from '../../store/uiStore';
import { useElementStore } from '../../store/elementStore';
import { useMediaStore } from '../../store/mediaStore';
import { usePersistenceStore } from '../../store/persistenceStore';
import { usePlaybackStore } from '../../store/playbackStore';
import { useTimelineStore } from '../../store/timelineStore';

interface Template {
  id: string;
  name: string;
  description: string;
  icon: string;
  preset: number; // index into COMPOSITION_PRESETS
}

const TEMPLATES: Template[] = [
  {
    id: 'transcript-session',
    name: 'Transcript Session',
    description: 'Start with source ingest and transcript cutting',
    icon: Icons.upload,
    preset: 0,
  },
  {
    id: 'blank-assembly',
    name: 'Blank Assembly',
    description: 'Open an empty visual assembly workspace',
    icon: Icons.square,
    preset: 0,
  },
];

export function NewProjectDialog() {
  const showDialog = useUIStore((s) => s.showNewProjectDialog);
  const setShowDialog = useUIStore((s) => s.setShowNewProjectDialog);
  const setCanvasSize = useUIStore((s) => s.setCanvasSize);
  const clearAll = useElementStore((s) => s.clearAll);
  const setTracks = useTimelineStore((s) => s.setTracks);
  const setDuration = usePlaybackStore((s) => s.setDuration);
  const clearAudio = useCutStore((s) => s.clearAudio);
  const setAssets = useMediaStore((s) => s.setAssets);
  const [selectedTemplate, setSelectedTemplate] = useState(0);
  const [selectedPreset, setSelectedPreset] = useState(0);

  if (!showDialog) return null;

  const template = TEMPLATES[selectedTemplate];
  const preset = COMPOSITION_PRESETS[selectedPreset];

  const handleCreate = () => {
    const isTranscriptSession = template.id === 'transcript-session';
    usePersistenceStore.getState().startNewProject('Untitled Project');
    clearAll();
    setTracks([]);
    setAssets([]);
    clearAudio();
    usePlaybackStore.setState({ currentTime: 0, isPlaying: false });
    setDuration(30);
    setCanvasSize(preset.width, preset.height);
    useUIStore.setState({
      appMode: isTranscriptSession ? 'cut' : 'edit',
      showSubtitleEditor: false,
      showAutoCut: false,
    });
    useElementStore.temporal.getState().clear();
    setShowDialog(false);
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 6000, fontFamily: FONT_FAMILY,
      }}
      onClick={() => setShowDialog(false)}
    >
      <div
        style={{
          width: 'min(640px, calc(100vw - 24px))', maxHeight: '80vh',
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 14, boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '18px 24px', borderBottom: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: 2,
            background: C.accent, boxShadow: `0 0 10px ${C.accentGlow}`,
          }} />
          <span style={{ fontFamily: FONT_FAMILY_BRAND, fontSize: 16, fontWeight: 700 }}>
            Start a Co-Cut Project
          </span>
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 16, color: C.textDim, cursor: 'pointer' }} onClick={() => setShowDialog(false)}>
            ✕
          </span>
        </div>

        {/* Composition Presets */}
        <div style={{ padding: '16px 24px 8px' }}>
          <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.6, marginBottom: 14 }}>
            Choose whether you are starting in transcript cut mode or jumping directly into assembly, then set the frame that downstream exports should inherit.
          </div>
          <div style={{ fontSize: 10, color: C.textDim, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>
            Canvas Size
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {COMPOSITION_PRESETS.map((p, i) => (
              <div
                key={i}
                onClick={() => {
                  setSelectedPreset(i);
                }}
                style={{
                  padding: '6px 12px', borderRadius: 6, cursor: 'pointer',
                  border: `1px solid ${i === selectedPreset ? C.accent : C.border}`,
                  background: i === selectedPreset ? `${C.accent}15` : 'transparent',
                  fontSize: 10, color: i === selectedPreset ? C.accent : C.text, // Updated color
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 2 }}>{p.label}</div>
                <div style={{ fontSize: 9, color: C.textDim }}>{p.platform}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Templates */}
        <div style={{ padding: '12px 24px' }}>
          <div style={{ fontSize: 10, color: C.textDim, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>
            Workflow Entry
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
            {TEMPLATES.map((t, i) => {
              const tPreset = COMPOSITION_PRESETS[t.preset];
              const aspectW = tPreset.width / Math.max(tPreset.width, tPreset.height);
              const aspectH = tPreset.height / Math.max(tPreset.width, tPreset.height);
              return (
                <div
                  key={t.id}
                  onClick={() => {
                    setSelectedTemplate(i);
                    setSelectedPreset(t.preset);
                  }}
                  style={{
                    padding: 12, borderRadius: 8, cursor: 'pointer',
                    border: `1px solid ${i === selectedTemplate ? C.accent : C.border}`,
                    background: i === selectedTemplate ? `${C.accent}10` : C.surface2,
                    transition: 'all 0.15s',
                    textAlign: 'center',
                  }}
                >
                  <div style={{
                    width: aspectW * 80, height: aspectH * 80,
                    margin: '0 auto 8px', borderRadius: 4,
                    background: C.surface3, border: `1px solid ${C.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon d={t.icon} size={20} color={i === selectedTemplate ? C.accent : C.textDim} />
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.text, marginBottom: 2 }}>{t.name}</div>
                  <div style={{ fontSize: 9, color: C.textDim }}>{t.description}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 24px', borderTop: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 10, color: C.textDim }}>
            {preset.width} × {preset.height} • {preset.platform}
          </span>
          <Button
            onClick={handleCreate}
            style={{
              padding: '8px 24px', background: C.accent, color: '#fff',
              fontWeight: 600, fontSize: 12, border: 'none', borderRadius: 8,
            }}
          >
            <Icon d={Icons.zap} size={13} color="#fff" />
            {template.id === 'transcript-session' ? 'Open Cut Workspace' : 'Open Assembly Workspace'}
          </Button>
        </div>
      </div>
    </div>
  );
}
