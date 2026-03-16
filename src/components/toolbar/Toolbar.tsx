import { useRef } from 'react';
import { C } from '../../theme/colors';
import { Icons } from '../../theme/icons';
import { FONT_FAMILY_BRAND, TOOLBAR_HEIGHT } from '../../theme/tokens';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { useCutStore } from '../../store/cutStore';
import { useElementStore } from '../../store/elementStore';
import { usePersistenceStore } from '../../store/persistenceStore';
import { usePlaybackStore } from '../../store/playbackStore';
import { useUIStore, COMPOSITION_PRESETS, type AppMode } from '../../store/uiStore';
import { saveProject, exportProjectJSON, importProjectJSON } from '../../services/projectService';
import { getSupabaseClient, isSupabaseConfigured } from '../../lib/supabase';
import { showToast } from '../ui/Toast';

function ModeButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '5px 14px',
        borderRadius: 999,
        border: 'none',
        background: active ? C.accent : 'transparent',
        color: active ? '#ffffff' : C.textDim,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 0.4,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
    >
      {label}
    </button>
  );
}

function formatStatusTime(value: string | null): string | null {
  if (!value) return null;
  return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function getIssueBadgeLabel(localStatus: string, cloudStatus: string, hasErrorMessage: boolean): string | null {
  if (localStatus === 'retrying') return 'Retrying save';
  if (localStatus === 'error') return 'Save failed';
  if (cloudStatus === 'conflict') return 'Sync conflict';
  if (cloudStatus === 'error') return 'Sync failed';
  if (hasErrorMessage) return 'Attention needed';
  return null;
}

export function Toolbar() {
  const elements = useElementStore((s) => s.elements);
  const appMode = useUIStore((s) => s.appMode);
  const setAppMode = useUIStore((s) => s.setAppMode);
  const showMediaBin = useUIStore((s) => s.showMediaBin);
  const toggleMediaBin = useUIStore((s) => s.toggleMediaBin);
  const setShowNewProjectDialog = useUIStore((s) => s.setShowNewProjectDialog);
  const setExportDialogOpen = useUIStore((s) => s.setExportDialogOpen);
  const canvasWidth = useUIStore((s) => s.canvasWidth);
  const canvasHeight = useUIStore((s) => s.canvasHeight);
  const setCanvasSize = useUIStore((s) => s.setCanvasSize);

  const soundbites = useCutStore((s) => s.soundbites);
  const setShowExportModal = useCutStore((s) => s.setShowExportModal);

  const currentTime = usePlaybackStore((s) => s.currentTime);
  const duration = usePlaybackStore((s) => s.duration);

  const projectName = usePersistenceStore((s) => s.projectName);
  const localStatus = usePersistenceStore((s) => s.localStatus);
  const cloudStatus = usePersistenceStore((s) => s.cloudStatus);
  const lastLocalSavedAt = usePersistenceStore((s) => s.lastLocalSavedAt);
  const lastCloudSyncAt = usePersistenceStore((s) => s.lastCloudSyncAt);
  const missingMediaCount = usePersistenceStore((s) => s.missingMediaCount);
  const errorMessage = usePersistenceStore((s) => s.errorMessage);
  const conflict = usePersistenceStore((s) => s.conflict);

  const { undo, redo } = useElementStore.temporal.getState();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentSizeKey = `${canvasWidth}x${canvasHeight}`;
  const localStatusLabel =
    localStatus === 'saving'
      ? 'Saving locally'
      : localStatus === 'retrying'
        ? 'Retrying local save'
        : localStatus === 'error'
          ? 'Local save failed'
          : localStatus === 'dirty'
            ? 'Unsaved changes'
            : formatStatusTime(lastLocalSavedAt)
              ? `Saved ${formatStatusTime(lastLocalSavedAt)}`
              : 'Draft ready';
  const cloudStatusLabel =
    cloudStatus === 'syncing'
      ? 'Syncing'
      : cloudStatus === 'conflict'
        ? 'Needs review'
        : cloudStatus === 'error'
          ? 'Sync failed'
          : cloudStatus === 'unsynced'
            ? 'Sync needed'
            : cloudStatus === 'synced' && formatStatusTime(lastCloudSyncAt)
              ? `Synced ${formatStatusTime(lastCloudSyncAt)}`
              : 'On this device';
  const persistenceDetail =
    localStatus === 'retrying'
      ? errorMessage
        ? `Local save retry queued. ${errorMessage}`
        : 'Local save retry queued.'
      : localStatus === 'error'
        ? errorMessage
          ? `Local save failed. ${errorMessage}`
          : 'Local save failed.'
        : cloudStatus === 'conflict'
          ? conflict?.message || 'Project sync conflict. Open Projects to resolve it.'
          : cloudStatus === 'error'
            ? errorMessage
              ? `Project sync failed. ${errorMessage}`
              : 'Project sync failed.'
            : errorMessage;
  const persistenceDetailColor =
    localStatus === 'error' || cloudStatus === 'error'
      ? C.red
      : localStatus === 'retrying' || cloudStatus === 'conflict' || Boolean(errorMessage)
        ? C.orange
        : C.textDim;
  const issueBadgeLabel = getIssueBadgeLabel(localStatus, cloudStatus, Boolean(errorMessage));

  const handleSave = () => {
    saveProject(undefined, { reason: 'manual', force: true })
      .then(() => showToast('Project saved locally.', 'success', 2500))
      .catch(() => showToast('Save failed — try again.', 'error'));
  };

  const handleBackup = () => exportProjectJSON();
  const handleOpenProject = () => fileInputRef.current?.click();
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) await importProjectJSON(file);
    event.target.value = '';
  };

  const handleSignOut = () => {
    if (!isSupabaseConfigured) return;
    void getSupabaseClient().auth.signOut();
  };

  const modeLabels: Record<AppMode, string> = {
    onboarding: 'New',
    cut: 'Cut',
    edit: 'Assemble',
  };

  return (
    <header
      style={{
        minHeight: TOOLBAR_HEIGHT,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        rowGap: 8,
        flexWrap: 'wrap',
        padding: '8px 20px',
        borderBottom: `1px solid ${C.border}`,
        background: C.bg,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        flexShrink: 0,
        overflowY: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: 3,
            background: C.accent,
            boxShadow: `0 0 12px ${C.accentGlow}`,
            flexShrink: 0,
          }}
        />
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontFamily: FONT_FAMILY_BRAND, fontSize: 18, fontWeight: 700, color: C.text }}>
              Co-Cut
            </span>
            <span
              style={{
                fontSize: 10,
                color: C.textDim,
                textTransform: 'uppercase',
                letterSpacing: 0.8,
                fontWeight: 700,
              }}
            >
              {modeLabels[appMode]}
            </span>
            {issueBadgeLabel && (
              <span
                title={persistenceDetail ?? undefined}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '3px 8px',
                  borderRadius: 999,
                  border: `1px solid ${persistenceDetailColor}33`,
                  background: `${persistenceDetailColor}14`,
                  color: persistenceDetailColor,
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                }}
              >
                {issueBadgeLabel}
              </span>
            )}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 10,
              color: C.textDim,
              minWidth: 0,
              whiteSpace: 'nowrap',
            }}
          >
            <span
              style={{
                maxWidth: 180,
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
                color: C.text,
                fontWeight: 600,
              }}
            >
              {projectName}
            </span>
            <span style={{ color: C.textMuted }}>•</span>
            <span>{localStatusLabel}</span>
            <span style={{ color: C.textMuted }}>•</span>
            <span>{cloudStatusLabel}</span>
            {missingMediaCount > 0 && (
              <>
                <span style={{ color: C.textMuted }}>•</span>
                <span style={{ color: C.orange }}>{missingMediaCount} source missing</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: 3,
          borderRadius: 999,
          border: `1px solid ${C.border}`,
          background: C.surface2,
          flexShrink: 0,
        }}
      >
        <ModeButton active={appMode === 'cut'} label="Cut" onClick={() => setAppMode('cut')} />
        <ModeButton active={appMode === 'edit'} label="Assemble" onClick={() => setAppMode('edit')} />
      </div>

      {appMode === 'edit' && (
        <>
          <Select
            value={currentSizeKey}
            onChange={(value) => {
              const [width, height] = value.split('x').map(Number);
              setCanvasSize(width, height);
            }}
            options={COMPOSITION_PRESETS.map((preset) => ({
              label: `${preset.label} — ${preset.platform}`,
              value: `${preset.width}x${preset.height}`,
            }))}
            style={{ fontSize: 10, minWidth: 180, flexShrink: 0 }}
          />
          <Button small active={showMediaBin} onClick={toggleMediaBin}>
            <Icon d={Icons.folder} size={12} /> Media
          </Button>
          <Button small onClick={() => undo()} title="Undo">
            <Icon d={Icons.undo} size={12} />
          </Button>
          <Button small onClick={() => redo()} title="Redo">
            <Icon d={Icons.redo} size={12} />
          </Button>
        </>
      )}

      <div style={{ flex: 1 }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, color: C.textDim, flexShrink: 0 }}>
        {appMode === 'edit' ? (
          <span>{elements.length} layer{elements.length === 1 ? '' : 's'} • {Math.round(duration)}s timeline</span>
        ) : (
          <span>{soundbites.length} clip{soundbites.length === 1 ? '' : 's'} saved</span>
        )}
        {appMode === 'edit' && (
          <span>{Math.round(currentTime)}s</span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <Button small onClick={() => setShowNewProjectDialog(true)}>
          <Icon d={Icons.zap} size={12} /> New
        </Button>
        <Button small accent onClick={handleSave} title="Save the current draft locally in this browser">
          <Icon d={Icons.save} size={12} /> Save
        </Button>
        <Button small onClick={handleBackup} title="Download a project backup. Source media is not included.">
          <Icon d={Icons.download} size={12} /> Backup
        </Button>
        <Button small onClick={handleOpenProject} title="Restore a project backup file">
          <Icon d={Icons.upload} size={12} /> Restore
        </Button>
        <Button small onClick={() => useUIStore.getState().toggleProjectManager()}>
          <Icon d={Icons.cloud} size={12} /> Projects
        </Button>
        {appMode === 'cut' ? (
          <Button small onClick={() => setShowExportModal(true)} disabled={soundbites.length === 0}>
            <Icon d={Icons.download} size={12} /> Export Clips
          </Button>
        ) : (
          <Button small onClick={() => setExportDialogOpen(true)}>
            <Icon d={Icons.download} size={12} /> Export
          </Button>
        )}
        {isSupabaseConfigured && (
          <Button small onClick={handleSignOut} title="Sign out">
            <Icon d={Icons.logOut} size={12} />
          </Button>
        )}
        <Button
          small
          onClick={() => useUIStore.getState().setShowNASBackup(true)}
          title="Back up 04_FINALS to NAS"
        >
          <Icon d={Icons.cloud} size={12} /> NAS
        </Button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </header>
  );
}
