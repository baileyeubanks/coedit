import { useEffect } from 'react';
import { C } from './theme/colors';
import { FONT_FAMILY } from './theme/tokens';
import { Toolbar } from './components/toolbar/Toolbar';
import { CanvasViewport } from './components/canvas/CanvasViewport';
import { LayerPanel } from './components/layers/LayerPanel';
import { PropertiesPanel } from './components/properties/PropertiesPanel';
import { TimelinePanel } from './components/timeline/TimelinePanel';
import { MediaBin } from './components/media/MediaBin';
import { ContextMenu } from './components/ui/ContextMenu';
import { AIAssistant } from './components/ai/AIAssistant';
import { ExportDialog } from './components/export/ExportDialog';
import { SubtitleEditor } from './components/subtitles/SubtitleEditor';
import { AutoCutPanel } from './components/autocut/AutoCutPanel';
import { usePlayback } from './hooks/usePlayback';
import { useKeyboard } from './hooks/useKeyboard';
import { loadProject, startAutosave, stopAutosave } from './services/projectService';
import { useElementStore } from './store/elementStore';
import { useUIStore } from './store/uiStore';
import { createTextElement, createShapeElement } from './utils/elementFactory';

function loadDefaultScene() {
  const store = useElementStore.getState();
  if (store.elements.length > 0) return;

  store.addElements([
    createShapeElement('shape', {
      name: 'Background',
      x: 160,
      y: 60,
      width: 1600,
      height: 960,
      fill: '#1a1a2e',
      borderRadius: 24,
    }),
    createTextElement({
      name: 'Title',
      x: 500,
      y: 280,
      width: 900,
      height: 140,
      content: 'CONTENT CO-OP',
      fontSize: 96,
      fontFamily: 'Arial Black',
      color: '#ffffff',
      animation: 'slideLeft',
      animDuration: 0.8,
    }),
    createTextElement({
      name: 'Subtitle',
      x: 520,
      y: 440,
      width: 860,
      height: 80,
      content: 'Video Production Studio',
      fontSize: 42,
      fontFamily: 'Georgia',
      color: C.accent2,
      fontWeight: 'normal',
      animation: 'fadeIn',
      animDuration: 1.0,
      startTime: 0.4,
    }),
    createShapeElement('circle', {
      name: 'Accent Circle',
      x: 1300,
      y: 500,
      width: 200,
      height: 200,
      fill: C.accent,
      animation: 'scaleUp',
      startTime: 0.2,
      opacity: 0.7,
    }),
    createShapeElement('shape', {
      name: 'Divider Line',
      x: 400,
      y: 680,
      width: 1120,
      height: 4,
      fill: C.accent,
      animation: 'slideRight',
      startTime: 0.6,
      borderRadius: 2,
    }),
    createTextElement({
      name: 'Tagline',
      x: 440,
      y: 740,
      width: 1040,
      height: 60,
      content: 'Drop files  \u2022  Edit  \u2022  Export',
      fontSize: 32,
      fontFamily: 'Courier New',
      color: C.textDim,
      fontWeight: 'normal',
      animation: 'typewriter',
      startTime: 1.0,
      animDuration: 1.2,
    }),
  ]);
}

export default function App() {
  usePlayback();
  useKeyboard();

  const showMediaBin = useUIStore((s) => s.showMediaBin);
  const showSubtitleEditor = useUIStore((s) => s.showSubtitleEditor);
  const showAutoCut = useUIStore((s) => s.showAutoCut);

  useEffect(() => {
    // Try to restore auto-saved project, fall back to default scene
    loadProject().then((loaded) => {
      if (!loaded) loadDefaultScene();
    });
    startAutosave();
    return () => stopAutosave();
  }, []);

  return (
    <div
      style={{
        width: '100%',
        height: '100vh',
        background: C.bg,
        color: C.text,
        fontFamily: FONT_FAMILY,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontSize: 12,
      }}
    >
      <Toolbar />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <LayerPanel />
        <CanvasViewport />
        <PropertiesPanel />
      </div>

      <TimelinePanel />
      {showMediaBin && <MediaBin />}
      {showSubtitleEditor && (
        <div
          style={{
            position: 'fixed',
            right: 260,
            bottom: 200,
            width: 340,
            maxHeight: 500,
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
            overflow: 'hidden',
            zIndex: 2000,
          }}
        >
          <SubtitleEditor />
        </div>
      )}
      {showAutoCut && (
        <div
          style={{
            position: 'fixed',
            right: 260,
            bottom: 200,
            width: 320,
            maxHeight: 460,
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
            overflow: 'hidden',
            zIndex: 2000,
          }}
        >
          <AutoCutPanel />
        </div>
      )}
      <ContextMenu />
      <ExportDialog />
      <AIAssistant />
    </div>
  );
}
