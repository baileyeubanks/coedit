import { create } from 'zustand';
import { uid } from '../utils/uid';

export type LocalPersistenceStatus = 'idle' | 'hydrating' | 'dirty' | 'saving' | 'saved' | 'retrying' | 'error';
export type CloudSyncStatus = 'local-only' | 'unsynced' | 'syncing' | 'synced' | 'conflict' | 'error';

export interface PersistenceConflict {
  kind: 'load-cloud' | 'save-cloud';
  message: string;
  projectId?: string | null;
  projectName?: string | null;
  remoteUpdatedAt?: string | null;
}

interface FinishHydrationPayload {
  fingerprint: string;
  projectId?: string;
  projectName?: string;
  projectCreatedAt?: string;
  lastLocalSavedAt?: string | null;
  restoredFromPersistence?: boolean;
  cloudProjectId?: string | null;
  cloudProjectName?: string | null;
  cloudProjectUpdatedAt?: string | null;
  lastCloudSyncAt?: string | null;
  lastCloudFingerprint?: string | null;
  missingMediaCount?: number;
  errorMessage?: string | null;
}

interface FinishLocalSavePayload {
  fingerprint: string;
  savedAt: string;
  projectName?: string;
  manual?: boolean;
}

interface FinishCloudSyncPayload {
  cloudProjectId: string;
  cloudProjectName: string;
  cloudProjectUpdatedAt: string;
  syncedAt: string;
  fingerprint: string;
}

interface PersistenceState {
  initialized: boolean;
  hydrating: boolean;
  projectId: string;
  projectName: string;
  projectCreatedAt: string;
  dirty: boolean;
  localStatus: LocalPersistenceStatus;
  cloudStatus: CloudSyncStatus;
  lastLocalSavedAt: string | null;
  lastManualSaveAt: string | null;
  lastCloudSyncAt: string | null;
  lastChangeAt: string | null;
  currentFingerprint: string | null;
  lastLocalFingerprint: string | null;
  lastCloudFingerprint: string | null;
  cloudProjectId: string | null;
  cloudProjectName: string | null;
  cloudProjectUpdatedAt: string | null;
  missingMediaCount: number;
  conflict: PersistenceConflict | null;
  errorMessage: string | null;
  startHydration: () => void;
  finishHydration: (payload: FinishHydrationPayload) => void;
  markDirty: (fingerprint: string) => void;
  startLocalSave: () => void;
  finishLocalSave: (payload: FinishLocalSavePayload) => void;
  failLocalSave: (message: string) => void;
  setLocalRetrying: (message: string) => void;
  startCloudSync: () => void;
  finishCloudSync: (payload: FinishCloudSyncPayload) => void;
  failCloudSync: (message: string, conflict?: PersistenceConflict | null) => void;
  clearConflict: () => void;
  setConflict: (conflict: PersistenceConflict) => void;
  setProjectName: (name: string) => void;
  setMissingMediaCount: (count: number) => void;
  clearCloudBinding: () => void;
  startNewProject: (name?: string) => void;
}

function nextCloudStatus(state: Pick<PersistenceState, 'cloudProjectId' | 'lastCloudFingerprint'>, fingerprint: string): CloudSyncStatus {
  if (!state.cloudProjectId) return 'local-only';
  return state.lastCloudFingerprint === fingerprint ? 'synced' : 'unsynced';
}

export const usePersistenceStore = create<PersistenceState>()((set) => ({
  initialized: false,
  hydrating: false,
  projectId: uid(),
  projectName: 'Untitled Project',
  projectCreatedAt: new Date().toISOString(),
  dirty: false,
  localStatus: 'idle',
  cloudStatus: 'local-only',
  lastLocalSavedAt: null,
  lastManualSaveAt: null,
  lastCloudSyncAt: null,
  lastChangeAt: null,
  currentFingerprint: null,
  lastLocalFingerprint: null,
  lastCloudFingerprint: null,
  cloudProjectId: null,
  cloudProjectName: null,
  cloudProjectUpdatedAt: null,
  missingMediaCount: 0,
  conflict: null,
  errorMessage: null,

  startHydration: () =>
    set({
      initialized: true,
      hydrating: true,
      localStatus: 'hydrating',
      errorMessage: null,
      conflict: null,
    }),

  finishHydration: (payload) =>
    set((state) => {
      const fingerprint = payload.fingerprint;
      const restoredFromPersistence = payload.restoredFromPersistence ?? Boolean(payload.lastLocalSavedAt);
      const cloudProjectId = payload.cloudProjectId ?? state.cloudProjectId;
      const lastCloudFingerprint = payload.lastCloudFingerprint ?? state.lastCloudFingerprint;
      return {
        initialized: true,
        hydrating: false,
        projectId: payload.projectId ?? state.projectId,
        projectName: payload.projectName ?? state.projectName,
        projectCreatedAt: payload.projectCreatedAt ?? state.projectCreatedAt,
        dirty: false,
        localStatus: restoredFromPersistence ? 'saved' : 'idle',
        cloudStatus: cloudProjectId
          ? (lastCloudFingerprint === fingerprint ? 'synced' : 'unsynced')
          : 'local-only',
        lastLocalSavedAt: restoredFromPersistence ? (payload.lastLocalSavedAt ?? state.lastLocalSavedAt) : null,
        currentFingerprint: fingerprint,
        lastLocalFingerprint: fingerprint,
        lastCloudFingerprint,
        cloudProjectId,
        cloudProjectName: payload.cloudProjectName ?? state.cloudProjectName,
        cloudProjectUpdatedAt: payload.cloudProjectUpdatedAt ?? state.cloudProjectUpdatedAt,
        lastCloudSyncAt: payload.lastCloudSyncAt ?? state.lastCloudSyncAt,
        missingMediaCount: payload.missingMediaCount ?? 0,
        conflict: null,
        errorMessage: payload.errorMessage ?? null,
      };
    }),

  markDirty: (fingerprint) =>
    set((state) => {
      const dirty = state.lastLocalFingerprint !== fingerprint;
      return {
        currentFingerprint: fingerprint,
        dirty,
        lastChangeAt: dirty ? new Date().toISOString() : state.lastChangeAt,
        localStatus: dirty ? 'dirty' : state.lastLocalSavedAt ? 'saved' : 'idle',
        cloudStatus: nextCloudStatus(state, fingerprint),
        errorMessage: dirty ? null : state.errorMessage,
      };
    }),

  startLocalSave: () =>
    set((state) => ({
      localStatus: state.hydrating ? 'hydrating' : 'saving',
      errorMessage: null,
    })),

  finishLocalSave: ({ fingerprint, savedAt, projectName, manual }) =>
    set((state) => ({
      projectName: projectName ?? state.projectName,
      dirty: false,
      localStatus: 'saved',
      lastLocalSavedAt: savedAt,
      lastManualSaveAt: manual ? savedAt : state.lastManualSaveAt,
      currentFingerprint: fingerprint,
      lastLocalFingerprint: fingerprint,
      cloudStatus: nextCloudStatus(state, fingerprint),
      errorMessage: null,
    })),

  failLocalSave: (message) =>
    set({
      localStatus: 'error',
      errorMessage: message,
    }),

  setLocalRetrying: (message) =>
    set({
      localStatus: 'retrying',
      errorMessage: message,
    }),

  startCloudSync: () =>
    set({
      cloudStatus: 'syncing',
      errorMessage: null,
      conflict: null,
    }),

  finishCloudSync: ({ cloudProjectId, cloudProjectName, cloudProjectUpdatedAt, syncedAt, fingerprint }) =>
    set({
      cloudProjectId,
      cloudProjectName,
      cloudProjectUpdatedAt,
      lastCloudSyncAt: syncedAt,
      lastCloudFingerprint: fingerprint,
      cloudStatus: 'synced',
      conflict: null,
      errorMessage: null,
    }),

  failCloudSync: (message, conflict = null) =>
    set((state) => ({
      cloudStatus: conflict ? 'conflict' : 'error',
      conflict,
      errorMessage: message,
      cloudProjectId: state.cloudProjectId,
    })),

  clearConflict: () => set({ conflict: null }),

  setConflict: (conflict) => set({ conflict, cloudStatus: 'conflict' }),

  setProjectName: (name) => set({ projectName: name }),

  setMissingMediaCount: (count) => set({ missingMediaCount: count }),

  clearCloudBinding: () =>
    set({
      cloudProjectId: null,
      cloudProjectName: null,
      cloudProjectUpdatedAt: null,
      lastCloudSyncAt: null,
      lastCloudFingerprint: null,
      cloudStatus: 'local-only',
      conflict: null,
      errorMessage: null,
    }),

  startNewProject: (name = 'Untitled Project') =>
    set({
      projectId: uid(),
      projectName: name,
      projectCreatedAt: new Date().toISOString(),
      dirty: true,
      localStatus: 'dirty',
      cloudStatus: 'local-only',
      lastLocalSavedAt: null,
      lastManualSaveAt: null,
      lastCloudSyncAt: null,
      lastChangeAt: new Date().toISOString(),
      currentFingerprint: null,
      lastLocalFingerprint: null,
      lastCloudFingerprint: null,
      cloudProjectId: null,
      cloudProjectName: null,
      cloudProjectUpdatedAt: null,
      missingMediaCount: 0,
      conflict: null,
      errorMessage: null,
    }),
}));
