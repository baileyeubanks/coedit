import { useEffect, useRef, useState } from 'react';
import { C } from '../../theme/colors';
import { useCutStore } from '../../store/cutStore';
import { Icons } from '../../theme/icons';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { useCutSourceWorkflow } from '../../hooks/useCutSourceWorkflow';
import { UploadZone } from './UploadZone';
import { CutSidebar } from './CutSidebar';
import { CutSelectionBar } from './CutSelectionBar';
import { InterviewWaveform } from './InterviewWaveform';
import { TranscriptPanel } from './TranscriptPanel';
import { SoundbiteList } from './SoundbiteList';
import { SaveSoundbiteModal } from './SaveSoundbiteModal';
import { ExportModal } from './ExportModal';

export function CutView() {
  const shellRef = useRef<HTMLDivElement>(null);
  const [shellWidth, setShellWidth] = useState(0);
  const audioUrl = useCutStore((s) => s.audioUrl);
  const fileName = useCutStore((s) => s.fileName);
  const transcript = useCutStore((s) => s.transcript);
  const soundbites = useCutStore((s) => s.soundbites);
  const sourceMissing = useCutStore((s) => s.sourceMissing);
  const showSaveModal = useCutStore((s) => s.showSaveModal);
  const showExportModal = useCutStore((s) => s.showExportModal);
  const hasPersistedCutSession = Boolean(fileName || transcript || soundbites.length > 0);
  const { promptForSourceFile } = useCutSourceWorkflow();

  // Global keyboard shortcuts for Cut mode
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const tag = target.tagName;
      // Don't steal keys from inputs/textareas
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      const store = useCutStore.getState();

      // Export: Cmd/Ctrl + E
      if ((e.metaKey || e.ctrlKey) && e.code === 'KeyE') {
        e.preventDefault();
        e.stopPropagation();
        store.setShowExportModal(true);
        return;
      }

      switch (e.code) {
        case 'Space': {
          e.preventDefault();
          e.stopPropagation();
          store.togglePlayback();
          break;
        }
        case 'KeyI': {
          e.preventDefault();
          e.stopPropagation();
          store.setMarkerIn(store.currentTime, 'waveform');
          break;
        }
        case 'KeyO': {
          e.preventDefault();
          e.stopPropagation();
          store.setMarkerOut(store.currentTime, 'waveform');
          break;
        }
        case 'Enter': {
          // Only open save modal if not already showing and markers are set
          if (!store.showSaveModal && store.markers.in !== null && store.markers.out !== null) {
            e.preventDefault();
            e.stopPropagation();
            store.setShowSaveModal(true);
          }
          break;
        }
        case 'Escape': {
          if (store.showSaveModal) {
            e.preventDefault();
            store.setShowSaveModal(false);
          } else if (store.showExportModal) {
            e.preventDefault();
            store.setShowExportModal(false);
          } else if (store.markers.in !== null || store.markers.out !== null) {
            e.preventDefault();
            store.clearSelection();
          }
          break;
        }
        case 'ArrowLeft': {
          e.preventDefault();
          store.seekToTime(Math.max(0, store.currentTime - (e.shiftKey ? 10 : 1)));
          break;
        }
        case 'ArrowRight': {
          e.preventDefault();
          store.seekToTime(Math.min(store.duration, store.currentTime + (e.shiftKey ? 10 : 1)));
          break;
        }
      }
    };

    // capture: true so Cut mode shortcuts fire before editor shortcuts
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, []);

  useEffect(() => {
    const node = shellRef.current;
    if (!node) return;

    const updateWidth = () => setShellWidth(node.clientWidth);
    updateWidth();

    const observer = new ResizeObserver(() => updateWidth());
    observer.observe(node);
    return () => observer.disconnect();
  }, [audioUrl, hasPersistedCutSession]);

  const layoutMode =
    shellWidth > 0 && shellWidth < 860
      ? 'single'
      : shellWidth > 0 && shellWidth < 1080
        ? 'stacked'
        : 'wide';
  const isWide = layoutMode === 'wide';
  const isSingleColumn = layoutMode === 'single';
  const usesStackedReview = !isWide;

  return (
    <div
      style={{
        flex: 1,
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        background: C.bg,
        overflow: 'hidden',
      }}
    >
      {!audioUrl && !hasPersistedCutSession ? (
        <UploadZone />
      ) : (
        <div
          ref={shellRef}
          className="cocut-cut-shell"
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: isWide ? 'row' : 'column',
            gap: 14,
          }}
        >
          <div
            style={{
              width: isWide ? 280 : '100%',
              flexShrink: 0,
              minHeight: 0,
              order: isWide ? 0 : 1,
            }}
          >
            <CutSidebar compact={!isWide} />
          </div>

          <div
            style={{
              flex: 1,
              minWidth: 0,
              minHeight: 0,
              display: 'grid',
              gridTemplateRows: 'auto minmax(0, 1fr)',
              gap: 14,
            }}
          >
            {audioUrl ? (
              <InterviewWaveform />
            ) : (
              <div
                style={{
                  padding: '16px 18px',
                  borderRadius: 18,
                  border: `1px solid ${C.orange}33`,
                  background: `${C.orange}12`,
                  color: C.orange,
                  fontSize: 12,
                  lineHeight: 1.6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <span>
                  {sourceMissing
                    ? `The source file for ${fileName || 'this cut session'} is not available on this browser. Transcript and saved clips are restored, but playback requires re-importing the local media.`
                    : 'Import media to continue playback in Cut mode.'}
                </span>
                <Button
                  small
                  onClick={() => {
                    void promptForSourceFile({ mode: sourceMissing ? 'reconnect' : 'new' });
                  }}
                >
                  <Icon d={Icons.upload} size={12} /> {sourceMissing ? 'Reconnect Source' : 'Import Source'}
                </Button>
              </div>
            )}

            <div
              style={{
                minHeight: 0,
                display: usesStackedReview ? 'flex' : 'grid',
                flexDirection: usesStackedReview ? 'column' : undefined,
                gridTemplateColumns: usesStackedReview
                  ? undefined
                  : 'minmax(0, 1.45fr) minmax(320px, 380px)',
                gap: 14,
                overflowY: usesStackedReview ? 'auto' : undefined,
              }}
            >
              <TranscriptPanel />

              {usesStackedReview ? (
                <>
                  <CutSelectionBar compact />
                  <SoundbiteList fullWidth />
                </>
              ) : (
                <div
                  style={{
                    minHeight: 0,
                    display: 'grid',
                    gridTemplateRows: 'auto minmax(0, 1fr)',
                    gap: 14,
                  }}
                >
                  <CutSelectionBar compact={isSingleColumn} />
                  <SoundbiteList fullWidth />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showSaveModal && <SaveSoundbiteModal />}
      {showExportModal && <ExportModal />}
    </div>
  );
}
