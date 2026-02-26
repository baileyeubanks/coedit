import { useRef } from 'react';
import { C } from '../../theme/colors';
import { Icons } from '../../theme/icons';
import { FONT_FAMILY, FONT_FAMILY_BRAND, TOOLBAR_HEIGHT } from '../../theme/tokens';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/Button';
import { useElementStore } from '../../store/elementStore';
import { usePlaybackStore } from '../../store/playbackStore';
import { useUIStore } from '../../store/uiStore';
import { createElement } from '../../utils/elementFactory';
import { formatTime } from '../../utils/formatTime';
import { saveProject, exportProjectJSON, importProjectJSON } from '../../services/projectService';

export function Toolbar() {
  const addElement = useElementStore((s) => s.addElement);
  const elements = useElementStore((s) => s.elements);
  const currentTime = usePlaybackStore((s) => s.currentTime);
  const duration = usePlaybackStore((s) => s.duration);
  const toggleGrid = useUIStore((s) => s.toggleGrid);
  const showGrid = useUIStore((s) => s.showGrid);
  const setExportDialogOpen = useUIStore((s) => s.setExportDialogOpen);
  const toggleSubtitleEditor = useUIStore((s) => s.toggleSubtitleEditor);
  const showSubtitleEditor = useUIStore((s) => s.showSubtitleEditor);
  const toggleAutoCut = useUIStore((s) => s.toggleAutoCut);
  const showAutoCut = useUIStore((s) => s.showAutoCut);

  const { undo, redo } = useElementStore.temporal.getState();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = () => saveProject('My Project');
  const handleExportJSON = () => exportProjectJSON();
  const handleOpenProject = () => fileInputRef.current?.click();
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await importProjectJSON(file);
    e.target.value = '';
  };

  const handleAdd = (type: string) => {
    const el = createElement(type, { startTime: currentTime });
    addElement(el);
  };

  return (
    <div
      style={{
        height: TOOLBAR_HEIGHT,
        background: C.surface,
        borderBottom: `1px solid ${C.border}`,
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        gap: 6,
        flexShrink: 0,
        fontFamily: FONT_FAMILY,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginRight: 12 }}>
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: 2,
            background: C.accent,
            boxShadow: `0 0 10px ${C.accentGlow}`,
          }}
        />
        <span style={{ fontFamily: FONT_FAMILY_BRAND, fontSize: 14, fontWeight: 700, letterSpacing: 0.5, color: C.text }}>
          CoEdit
        </span>
        <span style={{ fontSize: 8, color: C.textDim, marginLeft: 2, fontWeight: 500, letterSpacing: 1, textTransform: 'uppercase' as const }}>
          by Content Co-op
        </span>
      </div>

      <div style={{ width: 1, height: 24, background: C.border, margin: '0 6px' }} />

      <Button small onClick={handleSave} title="Save project (Ctrl+S)">
        <Icon d={Icons.download} size={13} /> Save
      </Button>
      <Button small onClick={handleOpenProject} title="Open project file">
        <Icon d={Icons.upload} size={13} /> Open
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      <div style={{ width: 1, height: 24, background: C.border, margin: '0 6px' }} />

      <Button small onClick={() => handleAdd('text')}>
        <Icon d={Icons.text} size={13} /> Text
      </Button>
      <Button small onClick={() => handleAdd('shape')}>
        <Icon d={Icons.square} size={13} /> Rect
      </Button>
      <Button small onClick={() => handleAdd('circle')}>
        <Icon d={Icons.circle} size={13} /> Circle
      </Button>
      <Button small onClick={() => handleAdd('image')}>
        <Icon d={Icons.image} size={13} /> Image
      </Button>

      <div style={{ width: 1, height: 24, background: C.border, margin: '0 6px' }} />

      <Button small onClick={() => undo()}>
        <Icon d={Icons.undo} size={13} />
      </Button>
      <Button small onClick={() => redo()}>
        <Icon d={Icons.redo} size={13} />
      </Button>
      <Button small active={showGrid} onClick={toggleGrid}>
        <Icon d={Icons.grid} size={13} />
      </Button>

      <div style={{ width: 1, height: 24, background: C.border, margin: '0 6px' }} />

      <Button small active={showSubtitleEditor} onClick={toggleSubtitleEditor}>
        <Icon d={Icons.text} size={13} /> Subs
      </Button>
      <Button small active={showAutoCut} onClick={toggleAutoCut}>
        <Icon d={Icons.wand} size={13} /> Auto-Cut
      </Button>
      <Button small onClick={() => setExportDialogOpen(true)}>
        <Icon d={Icons.download} size={13} /> Export
      </Button>

      <div style={{ flex: 1 }} />

      <span style={{ fontSize: 10, color: C.textDim }}>
        {elements.length} layers &bull; {formatTime(currentTime)} / {formatTime(duration)}
      </span>
    </div>
  );
}
