import { useEffect, useMemo, useState } from 'react';
import { C } from '../../theme/colors';
import { FONT_FAMILY } from '../../theme/tokens';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { Icons } from '../../theme/icons';
import {
  deleteProjectFromCloud,
  listCloudProjects,
  loadProjectFromCloud,
  saveProjectToCloud,
  type CloudProject,
  type CloudSaveConflict,
} from '../../services/supabaseProjectService';
import { usePersistenceStore } from '../../store/persistenceStore';

interface Props {
  open: boolean;
  onClose: () => void;
}

interface BannerState {
  tone: 'warning' | 'error' | 'success';
  message: string;
}

function formatTimestamp(value: string | null): string {
  if (!value) return 'Never';
  const date = new Date(value);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}

export function ProjectManager({ open, onClose }: Props) {
  const [projects, setProjects] = useState<CloudProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [pendingOpenId, setPendingOpenId] = useState<string | null>(null);
  const [saveConflict, setSaveConflict] = useState<CloudSaveConflict | null>(null);
  const [banner, setBanner] = useState<BannerState | null>(null);
  const [cloudLibraryIssue, setCloudLibraryIssue] = useState<string | null>(null);

  const projectName = usePersistenceStore((s) => s.projectName);
  const localStatus = usePersistenceStore((s) => s.localStatus);
  const cloudStatus = usePersistenceStore((s) => s.cloudStatus);
  const lastLocalSavedAt = usePersistenceStore((s) => s.lastLocalSavedAt);
  const lastCloudSyncAt = usePersistenceStore((s) => s.lastCloudSyncAt);
  const cloudProjectId = usePersistenceStore((s) => s.cloudProjectId);
  const cloudProjectName = usePersistenceStore((s) => s.cloudProjectName);
  const missingMediaCount = usePersistenceStore((s) => s.missingMediaCount);
  const errorMessage = usePersistenceStore((s) => s.errorMessage);
  const conflict = usePersistenceStore((s) => s.conflict);

  const syncLabel = cloudProjectId ? 'Update Sync' : 'Create Synced Copy';
  const persistenceIssue =
    localStatus === 'retrying'
      ? errorMessage
        ? `Local save retry queued. ${errorMessage}`
        : 'Local save retry queued.'
      : localStatus === 'error'
        ? errorMessage
          ? `Local save failed. ${errorMessage}`
          : 'Local save failed.'
        : cloudStatus === 'conflict'
          ? conflict?.message || 'Project sync conflict needs review before overwriting the synced copy.'
          : cloudStatus === 'error'
            ? errorMessage
              ? `Project sync failed. ${errorMessage}`
              : 'Project sync failed.'
            : errorMessage;
  const persistenceIssueTone =
    localStatus === 'error' || cloudStatus === 'error'
      ? C.red
      : C.orange;

  const statusSummary = useMemo(() => {
    const local =
      localStatus === 'saving'
        ? 'Saving this draft...'
        : localStatus === 'retrying'
          ? 'Retrying local save...'
        : localStatus === 'error'
          ? 'Local save failed'
          : localStatus === 'dirty'
            ? 'This draft has unsaved changes'
            : lastLocalSavedAt
              ? `Draft saved ${formatTimestamp(lastLocalSavedAt)}`
              : 'Draft not saved yet';

    const synced =
      cloudStatus === 'syncing'
        ? 'Sync in progress'
        : cloudStatus === 'conflict'
          ? 'Sync conflict needs attention'
          : cloudStatus === 'error'
            ? 'Sync failed'
            : cloudStatus === 'unsynced'
              ? 'Synced copy is behind this draft'
              : cloudProjectId
                ? `${cloudProjectName || 'Project copy'} synced ${formatTimestamp(lastCloudSyncAt)}`
                : 'Only on this device';

    return { local, synced };
  }, [cloudProjectId, cloudProjectName, cloudStatus, lastCloudSyncAt, lastLocalSavedAt, localStatus]);

  async function refreshProjects(options: { showBanner?: boolean } = {}) {
    setLoading(true);
    const result = await listCloudProjects();
    if (!result.ok) {
      setProjects([]);
      setCloudLibraryIssue(result.error);
      if (options.showBanner ?? true) {
        setBanner({ tone: 'warning', message: result.error });
      }
      setLoading(false);
      return;
    }
    setCloudLibraryIssue(null);
    setProjects(result.projects);
    setLoading(false);
  }

  useEffect(() => {
    if (!open) return;

    const frame = window.requestAnimationFrame(() => {
      setSaveName(projectName);
      setPendingOpenId(null);
      setSaveConflict(null);
      setBanner(null);
      setCloudLibraryIssue(null);
      refreshProjects().catch(() => setLoading(false));
    });

    return () => window.cancelAnimationFrame(frame);
  }, [open, projectName]);

  if (!open) return null;

  const handleSave = async (mode: 'sync' | 'copy' | 'overwrite') => {
    setSaving(true);
    setBanner(null);

    const result = await saveProjectToCloud({
      name: saveName.trim() || projectName,
      createCopy: mode === 'copy',
      overwrite: mode === 'overwrite',
    });

    setSaving(false);

    if (!result.ok) {
      if ('conflict' in result && result.conflict === 'remote-newer') {
        setSaveConflict(result);
        setBanner({ tone: 'warning', message: result.message });
      } else {
        setBanner({ tone: 'error', message: 'error' in result ? result.error : result.message });
      }
      return;
    }

    setSaveConflict(null);
    setBanner({
      tone: 'success',
      message: result.created
        ? `"${result.name}" is now available in Projects.`
        : `"${result.name}" synced successfully.`,
    });
    setSaveName(result.name);
    await refreshProjects({ showBanner: false });
  };

  const handleLoad = async (id: string, force = false) => {
    setLoading(true);
    setBanner(null);

    const result = await loadProjectFromCloud(id, { force });
    setLoading(false);

    if (!result.ok) {
      if ('conflict' in result && result.conflict === 'replace-local-state') {
        setPendingOpenId(id);
        setBanner({ tone: 'warning', message: result.message });
      } else {
        setBanner({ tone: 'error', message: 'error' in result ? result.error : result.message });
      }
      return;
    }

    setPendingOpenId(null);
    setBanner({
      tone: result.missingMediaCount > 0 ? 'warning' : 'success',
      message:
        result.missingMediaCount > 0
          ? `"${result.name}" loaded. ${result.missingMediaCount} local media source${result.missingMediaCount === 1 ? '' : 's'} need relinking on this browser.`
          : `"${result.name}" loaded into this browser.`,
    });
    await refreshProjects({ showBanner: false });
    onClose();
  };

  const handleDelete = async (id: string) => {
    const ok = await deleteProjectFromCloud(id);
    if (!ok) {
      setBanner({ tone: 'error', message: 'Failed to remove the synced project.' });
      return;
    }
    setProjects((prev) => prev.filter((project) => project.id !== id));
    if (pendingOpenId === id) {
      setPendingOpenId(null);
    }
  };

  const overlay: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3000,
    fontFamily: FONT_FAMILY,
  };

  const modal: React.CSSProperties = {
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 12,
    width: 560,
    maxHeight: '76vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
  };

  const bannerStyle: React.CSSProperties | undefined = banner
    ? {
        margin: '12px 20px 0',
        padding: '10px 12px',
        borderRadius: 8,
        fontSize: 11,
        lineHeight: 1.5,
        color: banner.tone === 'error' ? C.red : banner.tone === 'success' ? C.green : C.orange,
        background: banner.tone === 'error' ? `${C.red}14` : banner.tone === 'success' ? `${C.green}14` : `${C.orange}16`,
        border: `1px solid ${banner.tone === 'error' ? `${C.red}33` : banner.tone === 'success' ? `${C.green}33` : `${C.orange}33`}`,
      }
    : undefined;

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Projects</div>
            <div style={{ fontSize: 10, color: C.textDim, marginTop: 3 }}>
              Project sync keeps structure, transcript state, and saved clips together. Source media stays on this browser.
            </div>
          </div>
          <Button small onClick={onClose}><Icon d={Icons.close} size={14} /></Button>
        </div>

        <div style={{ padding: '14px 20px 0', display: 'grid', gap: 8 }}>
          <div style={{ padding: '10px 12px', borderRadius: 8, background: C.surface2, border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 11, color: C.text, fontWeight: 600, marginBottom: 4 }}>{projectName}</div>
            <div style={{ fontSize: 10, color: C.textDim }}>{statusSummary.local}</div>
            <div style={{ fontSize: 10, color: C.textDim, marginTop: 2 }}>{statusSummary.synced}</div>
            {persistenceIssue && (
              <div style={{ fontSize: 10, color: persistenceIssueTone, marginTop: 6, lineHeight: 1.5 }}>
                {persistenceIssue}
              </div>
            )}
            {!persistenceIssue && (
              <div style={{ fontSize: 10, color: C.textMuted, marginTop: 6, lineHeight: 1.5 }}>
                Local draft is canonical. Sync creates or updates the structured cloud copy without uploading source media.
              </div>
            )}
            {missingMediaCount > 0 && (
              <div style={{ fontSize: 10, color: C.orange, marginTop: 6 }}>
                {missingMediaCount} local media source{missingMediaCount === 1 ? '' : 's'} still need relinking in this browser.
              </div>
            )}
          </div>
        </div>

        {banner && <div style={bannerStyle}>{banner.message}</div>}

        {saveConflict && (
          <div style={{ padding: '12px 20px 0', display: 'flex', gap: 8 }}>
            <Button small onClick={() => handleSave('overwrite')}>
              Overwrite Sync
            </Button>
            <Button small onClick={() => handleSave('copy')}>
              Save as Copy
            </Button>
          </div>
        )}

        <div style={{ padding: '12px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            placeholder="Project name..."
            style={{
              flex: 1,
              background: C.surface2,
              border: `1px solid ${C.border}`,
              borderRadius: 6,
              padding: '7px 10px',
              color: C.text,
              fontSize: 12,
              outline: 'none',
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSave('sync');
              }
            }}
          />
          <Button small onClick={() => handleSave('sync')} disabled={saving}>
            {saving ? '...' : syncLabel}
          </Button>
          <Button small onClick={() => handleSave('copy')} disabled={saving}>
            Save Copy
          </Button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
          {loading ? (
            <div style={{ padding: 20, textAlign: 'center', color: C.textDim, fontSize: 12 }}>Loading...</div>
          ) : projects.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: C.textDim, fontSize: 12 }}>
              {cloudLibraryIssue || 'No synced projects yet. Save the current draft above.'}
            </div>
          ) : (
            projects.map((project) => {
              const isCurrent = project.id === cloudProjectId;
              const isPendingOpen = project.id === pendingOpenId;

              return (
                <div
                  key={project.id}
                  style={{
                    padding: '10px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    borderBottom: `1px solid ${C.border}`,
                    background: isCurrent ? `${C.accent}0f` : 'transparent',
                  }}
                >
                  <Icon d={Icons.cloud} size={14} color={isCurrent ? C.accent2 : C.textDim} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: C.text, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.name}</span>
                      {isCurrent && (
                        <span style={{ fontSize: 9, color: C.accent2, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                          Current
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 10, color: C.textDim }}>
                      Updated {formatTimestamp(project.updated_at)}
                    </div>
                  </div>
                  <Button small onClick={() => handleLoad(project.id, isPendingOpen)}>
                    {isPendingOpen ? 'Open Anyway' : 'Open'}
                  </Button>
                  <Button small onClick={() => handleDelete(project.id)}>
                    <Icon d={Icons.trash} size={12} color={C.red} />
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
