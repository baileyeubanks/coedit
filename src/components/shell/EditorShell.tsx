import type { ReactNode } from 'react';
import { useState } from 'react';
import { C } from '../../theme/colors';
import { FONT_FAMILY } from '../../theme/tokens';
import { Toolbar } from '../toolbar/Toolbar';
import { CanvasViewport } from '../canvas/CanvasViewport';
import { LayerPanel } from '../layers/LayerPanel';
import { PropertiesPanel } from '../properties/PropertiesPanel';
import { TimelinePanel } from '../timeline/TimelinePanel';
import { PremiereBin } from '../media/PremiereBin';
import { SourceMonitor } from '../media/SourceMonitor';
import { AnalyticsPanel } from '../ai/AnalyticsPanel';
import { ContextMenu } from '../ui/ContextMenu';
import { NewProjectDialog } from '../ui/NewProjectDialog';
import { AIAssistant } from '../ai/AIAssistant';
import { ExportDialog } from '../export/ExportDialog';
import { SubtitleEditor } from '../subtitles/SubtitleEditor';
import { AutoCutPanel } from '../autocut/AutoCutPanel';
import { ProjectManager } from '../projects/ProjectManager';
import { NASBackupDialog } from '../ui/NASBackupDialog';
import { ToastContainer } from '../ui/Toast';
import { usePlayback } from '../../hooks/usePlayback';
import { useKeyboard } from '../../hooks/useKeyboard';
import { useUIStore } from '../../store/uiStore';
import { usePersistenceStore } from '../../store/persistenceStore';
import { CutView } from '../cut/CutView';

function ShellFloatingPanel({
  width,
  maxHeight,
  children,
}: {
  width: number;
  maxHeight: number;
  children: ReactNode;
}) {
  return (
    <div
      className="cocut-shell-utility-panel"
      style={{
        width,
        maxWidth: 'min(100%, 420px)',
        maxHeight,
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
        overflow: 'hidden',
        pointerEvents: 'auto',
      }}
    >
      {children}
    </div>
  );
}

/** Thin 1px rule between panels */
function PanelRule({ axis }: { axis: 'h' | 'v' }) {
  return (
    <div
      style={{
        [axis === 'v' ? 'width' : 'height']: 1,
        background: C.border,
        flexShrink: 0,
      }}
    />
  );
}

export function EditorShell() {
  usePlayback();
  useKeyboard();

  const appMode = useUIStore((s) => s.appMode);
  const showSubtitleEditor = useUIStore((s) => s.showSubtitleEditor);
  const showAutoCut = useUIStore((s) => s.showAutoCut);
  const showProjectManager = useUIStore((s) => s.showProjectManager);
  const showNASBackup = useUIStore((s) => s.showNASBackup);
  const projectName = usePersistenceStore((s) => s.projectName);

  // Right panel tab: analytics overview OR element properties
  const [rightTab, setRightTab] = useState<'analytics' | 'properties'>('analytics');

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: C.bg,
        color: C.text,
        fontFamily: FONT_FAMILY,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
        isolation: 'isolate',
        fontSize: 12,
      }}
    >
      <Toolbar />

      <main
        style={{
          flex: 1,
          minHeight: 0,
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
        }}
      >
        {appMode === 'cut' ? (
          <CutView />
        ) : (
          /* ═══ Premiere-style Edit Shell ═══════════════════════════════════ */
          <div
            className="cocut-edit-shell"
            style={{
              flex: 1,
              display: 'grid',
              gridTemplateRows: 'minmax(0, 1fr) 1px minmax(240px, 34vh)',
              overflow: 'hidden',
              background: C.bg,
            }}
          >
            {/* ── TOP ROW ─────────────────────────────────────────────────── */}
            <div
              className="cocut-edit-top"
              style={{
                display: 'grid',
                gridTemplateColumns: '220px 1px minmax(0, 1fr) 1px 256px',
                minHeight: 0,
                overflow: 'hidden',
              }}
            >
              {/* LEFT COLUMN: Media Bin */}
              <div
                style={{
                  minHeight: 0,
                  overflow: 'hidden',
                  padding: '10px 0 0 10px',
                }}
              >
                <PremiereBin />
              </div>

              <PanelRule axis="v" />

              {/* CENTER: Source Monitor (top half) + Program Monitor [Canvas] (bottom half) */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateRows: '1fr 1px 1fr',
                  minHeight: 0,
                  overflow: 'hidden',
                  padding: '10px 0',
                }}
              >
                {/* Source Monitor */}
                <div
                  style={{
                    minHeight: 0,
                    padding: '0 10px',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <SourceMonitor />
                </div>

                <PanelRule axis="h" />

                {/* Program Monitor (canvas viewport) */}
                <div
                  style={{
                    minHeight: 0,
                    padding: '0 10px',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  {/*
                   * Wrap the canvas in a dark shell that looks like Premiere's
                   * "Program Monitor" panel. CanvasViewport renders its own
                   * header internally, so we just contain it here.
                   */}
                  <div
                    style={{
                      flex: 1,
                      minHeight: 0,
                      background: C.darkBg,
                      border: `1px solid ${C.darkBorder}`,
                      borderRadius: 14,
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      position: 'relative',
                    }}
                  >
                    {/* Dark overlay label */}
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        padding: '4px 10px',
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: 1,
                        textTransform: 'uppercase',
                        color: C.copper,
                        background: 'rgba(11,25,40,0.6)',
                        borderBottomRightRadius: 6,
                        pointerEvents: 'none',
                        zIndex: 10,
                      }}
                    >
                      Program Monitor
                    </div>
                    <CanvasViewport />
                  </div>
                </div>
              </div>

              <PanelRule axis="v" />

              {/* RIGHT COLUMN: Analytics / Properties */}
              <div
                style={{
                  minHeight: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  padding: '10px 10px 0 0',
                }}
              >
                {/* Tab bar */}
                <div
                  style={{
                    display: 'flex',
                    borderBottom: `1px solid ${C.border}`,
                    marginBottom: 8,
                    flexShrink: 0,
                    background: C.surface,
                    borderRadius: '10px 10px 0 0',
                    border: `1px solid ${C.border}`,
                    borderBottomWidth: 0,
                    overflow: 'hidden',
                  }}
                >
                  {(['analytics', 'properties'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setRightTab(tab)}
                      style={{
                        flex: 1,
                        background: rightTab === tab ? C.bg : C.surface,
                        border: 'none',
                        borderBottom: `2px solid ${rightTab === tab ? C.accent : 'transparent'}`,
                        color: rightTab === tab ? C.accent : C.textMuted,
                        cursor: 'pointer',
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: 0.6,
                        padding: '7px 8px',
                        textTransform: 'uppercase',
                        transition: 'color 0.15s, background 0.15s, border-color 0.15s',
                        fontFamily: 'inherit',
                      }}
                    >
                      {tab === 'analytics' ? '📊 Analytics' : '⚙ Properties'}
                    </button>
                  ))}
                </div>

                <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                  {rightTab === 'analytics' ? (
                    <AnalyticsPanel />
                  ) : (
                    <PropertiesPanel />
                  )}
                </div>
              </div>
            </div>

            {/* ── DIVIDER ─────────────────────────────────────────────────── */}
            <PanelRule axis="h" />

            {/* ── BOTTOM ROW: Layer panel | Timeline ─────────────────────── */}
            <div
              className="cocut-edit-bottom"
              style={{
                minHeight: 0,
                display: 'grid',
                gridTemplateColumns: '220px 1px minmax(0, 1fr)',
                overflow: 'hidden',
              }}
            >
              {/* Layer panel (sits below the bin) */}
              <div
                style={{
                  minHeight: 0,
                  overflow: 'hidden',
                  padding: '0 0 10px 10px',
                }}
              >
                <LayerPanel />
              </div>

              <PanelRule axis="v" />

              {/* Timeline */}
              <div
                style={{
                  minHeight: 0,
                  overflow: 'hidden',
                  padding: '0 10px 10px 0',
                }}
              >
                <TimelinePanel />
              </div>
            </div>
          </div>
        )}

        {/* ── Floating utility panels ──────────────────────────────────────── */}
        <div
          className="cocut-shell-utility-dock"
          style={{
            position: 'absolute',
            right: 16,
            bottom: 16,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 12,
            pointerEvents: 'none',
            zIndex: 2000,
          }}
        >
          {appMode === 'edit' && showSubtitleEditor && (
            <ShellFloatingPanel width={340} maxHeight={500}>
              <SubtitleEditor />
            </ShellFloatingPanel>
          )}
          {appMode === 'edit' && showAutoCut && (
            <ShellFloatingPanel width={320} maxHeight={460}>
              <AutoCutPanel />
            </ShellFloatingPanel>
          )}
          <div
            style={{
              pointerEvents: 'auto',
              width: '100%',
              display: 'flex',
              justifyContent: 'flex-end',
            }}
          >
            <AIAssistant embedded />
          </div>
        </div>
      </main>

      {/* ── Global dialogs + notifications ─────────────────────────────────── */}
      <ContextMenu />
      <NewProjectDialog />
      <ExportDialog />
      <NASBackupDialog
        open={showNASBackup}
        onClose={() => useUIStore.getState().setShowNASBackup(false)}
        projectName={projectName ?? undefined}
      />
      <ProjectManager
        open={showProjectManager}
        onClose={() => useUIStore.setState({ showProjectManager: false })}
      />
      <ToastContainer />
    </div>
  );
}
