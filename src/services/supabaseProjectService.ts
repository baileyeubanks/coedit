/**
 * Co-Cut project sync via Supabase.
 *
 * Canonical current contract:
 * - structured project snapshots sync per signed-in user
 * - source media remains local to the browser
 *
 * Transitional constraint:
 * - sync is snapshot-based and still relies on later local relink for missing media.
 *
 * Table contract: projects (id uuid, user_id uuid, name text, data jsonb, created_at timestamptz, updated_at timestamptz)
 */

import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';
import { useCutStore } from '../store/cutStore';
import { useElementStore } from '../store/elementStore';
import { useMediaStore } from '../store/mediaStore';
import { usePersistenceStore, type PersistenceConflict } from '../store/persistenceStore';
import { buildProjectSnapshot, hydrateProjectSnapshot, saveProject, type ProjectSnapshot } from './projectService';

export interface CloudProject {
  id: string;
  name: string;
  updated_at: string;
  created_at: string;
}

export interface CloudProjectListSuccess {
  ok: true;
  projects: CloudProject[];
}

export interface CloudProjectListFailure {
  ok: false;
  error: string;
}

export type CloudProjectListResult = CloudProjectListSuccess | CloudProjectListFailure;

export interface CloudSaveSuccess {
  ok: true;
  id: string;
  name: string;
  updatedAt: string;
  created: boolean;
}

export interface CloudSaveConflict {
  ok: false;
  conflict: 'remote-newer';
  message: string;
  projectId: string;
  projectName: string;
  remoteUpdatedAt: string;
}

export interface CloudSaveFailure {
  ok: false;
  error: string;
}

export type CloudSaveResult = CloudSaveSuccess | CloudSaveConflict | CloudSaveFailure;

export interface CloudLoadSuccess {
  ok: true;
  name: string;
  missingMediaCount: number;
}

export interface CloudLoadConflict {
  ok: false;
  conflict: 'replace-local-state';
  message: string;
}

export interface CloudLoadFailure {
  ok: false;
  error: string;
}

export type CloudLoadResult = CloudLoadSuccess | CloudLoadConflict | CloudLoadFailure;

interface CloudRecord {
  id: string;
  name: string;
  updated_at: string;
  created_at: string;
  data: ProjectSnapshot | Record<string, unknown>;
}

interface SaveToCloudOptions {
  name?: string;
  createCopy?: boolean;
  overwrite?: boolean;
}

function getSupabase() {
  if (!isSupabaseConfigured) return null;
  return getSupabaseClient();
}

function hasMeaningfulLocalWork(): boolean {
  const elements = useElementStore.getState().elements;
  const media = useMediaStore.getState().assets;
  const cut = useCutStore.getState();

  return (
    elements.length > 0 ||
    media.length > 0 ||
    Boolean(cut.fileName) ||
    Boolean(cut.transcript) ||
    cut.soundbites.length > 0
  );
}

function buildReplaceLocalConflict(targetName?: string): PersistenceConflict {
  return {
    kind: 'load-cloud',
    message: targetName
      ? `Opening "${targetName}" will replace the current local draft.`
      : 'Opening this synced project will replace the current local draft.',
    projectName: targetName || null,
  };
}

async function fetchCloudRecord(id: string): Promise<CloudRecord | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('projects')
    .select('id, name, updated_at, created_at, data')
    .eq('user_id', user.id)
    .eq('id', id)
    .single();

  if (error || !data) {
    return null;
  }

  return data as CloudRecord;
}

export async function listCloudProjects(): Promise<CloudProjectListResult> {
  const supabase = getSupabase();
  if (!supabase) {
    return { ok: false, error: 'Cloud sync is not configured for this build.' };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: 'Sign in to view cloud projects.' };
  }

  const { data, error } = await supabase
    .from('projects')
    .select('id, name, updated_at, created_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Failed to list cloud projects:', error);
    return { ok: false, error: 'Failed to load cloud projects.' };
  }

  return { ok: true, projects: data || [] };
}

export async function saveProjectToCloud(options: SaveToCloudOptions = {}): Promise<CloudSaveResult> {
  const supabase = getSupabase();
  if (!supabase) {
    return { ok: false, error: 'Supabase is not configured.' };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: 'Sign in to save to cloud.' };
  }

  const persistence = usePersistenceStore.getState();
  const name = options.name?.trim() || persistence.projectName || 'Untitled Project';
  const targetId = options.createCopy ? null : persistence.cloudProjectId;
  const existing = targetId ? await fetchCloudRecord(targetId) : null;
  const resolvedTargetId = existing ? targetId : null;

  if (targetId && !existing) {
    usePersistenceStore.getState().clearCloudBinding();
  }

  if (
    existing &&
    !options.overwrite &&
    persistence.cloudProjectUpdatedAt &&
    existing.updated_at !== persistence.cloudProjectUpdatedAt
  ) {
    const conflict: PersistenceConflict = {
      kind: 'save-cloud',
      message: `"${existing.name}" changed in the cloud since this draft was last synced.`,
      projectId: existing.id,
      projectName: existing.name,
      remoteUpdatedAt: existing.updated_at,
    };

    usePersistenceStore.getState().failCloudSync(conflict.message, conflict);

    return {
      ok: false,
      conflict: 'remote-newer',
      message: conflict.message,
      projectId: existing.id,
      projectName: existing.name,
      remoteUpdatedAt: existing.updated_at,
    };
  }

  usePersistenceStore.getState().startCloudSync();

  try {
    const snapshot = buildProjectSnapshot(name);
    snapshot.sync = {
      cloudProjectId: resolvedTargetId,
      cloudProjectName: resolvedTargetId ? name : null,
      cloudProjectUpdatedAt: existing?.updated_at || null,
      lastCloudSyncAt: resolvedTargetId ? existing?.updated_at || null : null,
      lastCloudFingerprint: resolvedTargetId ? snapshot.meta.fingerprint : null,
    };

    const payload = {
      user_id: user.id,
      name,
      data: snapshot,
      updated_at: new Date().toISOString(),
    };

    const query = resolvedTargetId
      ? supabase
          .from('projects')
          .upsert({ ...payload, id: resolvedTargetId }, { onConflict: 'id' })
          .select('id, name, updated_at')
          .single()
      : supabase
          .from('projects')
          .insert(payload)
          .select('id, name, updated_at')
          .single();

    const { data, error } = await query;

    if (error || !data) {
      throw error || new Error('Cloud save failed.');
    }

    usePersistenceStore.getState().finishCloudSync({
      cloudProjectId: data.id,
      cloudProjectName: data.name,
      cloudProjectUpdatedAt: data.updated_at,
      syncedAt: data.updated_at,
      fingerprint: snapshot.meta.fingerprint,
    });

    await saveProject(undefined, { reason: 'cloud-sync', force: true });

    return {
      ok: true,
      id: data.id,
      name: data.name,
      updatedAt: data.updated_at,
      created: !resolvedTargetId,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save to cloud.';
    usePersistenceStore.getState().failCloudSync(message);
    return { ok: false, error: message };
  }
}

export async function loadProjectFromCloud(id: string, options: { force?: boolean } = {}): Promise<CloudLoadResult> {
  if (!getSupabase()) {
    return { ok: false, error: 'Supabase is not configured.' };
  }

  const record = await fetchCloudRecord(id);

  if (!record || !record.data) {
    return { ok: false, error: 'Failed to load cloud project.' };
  }

  const persistence = usePersistenceStore.getState();
  const isSwitchingProjects = persistence.cloudProjectId !== id;
  const shouldWarn =
    !options.force &&
    hasMeaningfulLocalWork() &&
    (persistence.dirty || persistence.cloudStatus === 'unsynced' || !persistence.cloudProjectId || isSwitchingProjects);

  if (shouldWarn) {
    const conflict = buildReplaceLocalConflict(record.name);
    usePersistenceStore.getState().setConflict(conflict);
    return {
      ok: false,
      conflict: 'replace-local-state',
      message: conflict.message,
    };
  }

  const { missingMediaCount } = await hydrateProjectSnapshot(record.data, {
    source: 'cloud',
    cloudProjectId: record.id,
    cloudProjectName: record.name,
    cloudProjectUpdatedAt: record.updated_at,
  });

  usePersistenceStore.getState().clearConflict();
  await saveProject(undefined, { reason: 'cloud-load', force: true });

  return {
    ok: true,
    name: record.name,
    missingMediaCount,
  };
}

export async function deleteProjectFromCloud(id: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { error } = await supabase.from('projects').delete().eq('user_id', user.id).eq('id', id);
  if (error) {
    console.error('Failed to delete cloud project:', error);
    return false;
  }

  if (usePersistenceStore.getState().cloudProjectId === id) {
    usePersistenceStore.getState().clearCloudBinding();
    await saveProject(undefined, { reason: 'cloud-sync', force: true }).catch(() => {});
  }

  return true;
}
