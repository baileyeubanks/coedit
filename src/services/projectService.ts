import { openDB, type DBSchema } from 'idb';
import { useElementStore } from '../store/elementStore';
import { useMediaStore } from '../store/mediaStore';
import { usePersistenceStore } from '../store/persistenceStore';
import { usePlaybackStore } from '../store/playbackStore';
import { type AppMode, type PanelTab, type TimelineTool, useUIStore } from '../store/uiStore';
import { useCutStore, type CutMarkers, type Soundbite } from '../store/cutStore';
import { useTimelineStore } from '../store/timelineStore';
import type { Element, MediaAsset, Track } from '../types';
import {
  LEGACY_PRODUCT_PERSISTENCE_DB,
  PRODUCT_PERSISTENCE_DB,
} from '../config/product';
import type { TranscriptionResult } from './whisperService';
import { uid } from '../utils/uid';

const DB_NAME = PRODUCT_PERSISTENCE_DB;
const LEGACY_DB_NAME = LEGACY_PRODUCT_PERSISTENCE_DB;
const DB_VERSION = 2;
const PROJECT_STORE = 'projects';
const BLOB_STORE = 'mediaBlobs';
const LEGACY_LOCAL_PROJECT_KEY = '__autosave__';
const LOCAL_PROJECT_KEY_PREFIX = 'local-project:';
const LEGACY_CUT_AUDIO_BLOB_KEY = '__cut_audio__';
const AUTOSAVE_DEBOUNCE_MS = 1500;

export const PROJECT_SNAPSHOT_VERSION = 2;

export interface PersistedMediaAsset {
  id: string;
  name: string;
  type: MediaAsset['type'];
  mimeType: string;
  size: number;
  duration?: number;
  width?: number;
  height?: number;
  thumbnailUrl?: string;
  hasLocalSource: boolean;
}

export interface PersistedUIState {
  appMode: AppMode;
  activeTab: PanelTab;
  showGrid: boolean;
  showMediaBin: boolean;
  showSubtitleEditor: boolean;
  showAutoCut: boolean;
  canvasWidth: number;
  canvasHeight: number;
  canvasBgColor: string;
  zoom: number;
  timelineTool: TimelineTool;
}

export interface PersistedCutState {
  fileName: string | null;
  duration: number;
  currentTime: number;
  transcript: TranscriptionResult | null;
  markers: CutMarkers;
  soundbites: Soundbite[];
  hasLocalSource: boolean;
}

export interface ProjectSnapshot {
  version: number;
  meta: {
    projectId: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    fingerprint: string;
  };
  sync: {
    cloudProjectId: string | null;
    cloudProjectName: string | null;
    cloudProjectUpdatedAt: string | null;
    lastCloudSyncAt: string | null;
    lastCloudFingerprint: string | null;
  };
  edit: {
    elements: Element[];
    duration: number;
    currentTime: number;
    tracks: Track[];
  };
  media: PersistedMediaAsset[];
  ui: PersistedUIState;
  cut: PersistedCutState;
}

interface LegacyProjectData {
  id?: string;
  name?: string;
  elements?: Element[];
  duration?: number;
  tracks?: Track[];
  createdAt?: string;
  updatedAt?: string;
}

interface SaveProjectOptions {
  reason?: 'manual' | 'autosave' | 'pagehide' | 'cloud-load' | 'import' | 'cloud-sync' | 'migration';
  force?: boolean;
}

interface HydrateProjectOptions {
  source: 'local' | 'cloud' | 'import';
  storageDbName?: string;
  cloudProjectId?: string | null;
  cloudProjectName?: string | null;
  cloudProjectUpdatedAt?: string | null;
  asNewLocalProject?: boolean;
  resetCloudBinding?: boolean;
  restoredFromPersistence?: boolean;
  hydrationMessage?: string | null;
}

export interface HydrateProjectResult {
  snapshot: ProjectSnapshot;
  missingMediaCount: number;
}

interface ProjectPersistenceDB extends DBSchema {
  [PROJECT_STORE]: {
    key: string;
    value: ProjectSnapshot | LegacyProjectData;
  };
  [BLOB_STORE]: {
    key: string;
    value: Blob;
  };
}

let autosaveTimeout: ReturnType<typeof setTimeout> | null = null;
let localRetryTimeout: ReturnType<typeof setTimeout> | null = null;
let storeUnsubscribers: Array<() => void> = [];
let autosaveStarted = false;
let hydratedObjectUrls: string[] = [];
let activeLocalProjectKey = LEGACY_LOCAL_PROJECT_KEY;

function getScopedLocalProjectKey(userId: string): string {
  return `${LOCAL_PROJECT_KEY_PREFIX}${userId}`;
}

function setActiveLocalProjectKey(userId: string) {
  activeLocalProjectKey = getScopedLocalProjectKey(userId);
}

function hashString(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

function openPersistenceDB(dbName = DB_NAME) {
  return openDB<ProjectPersistenceDB>(dbName, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(PROJECT_STORE)) {
        db.createObjectStore(PROJECT_STORE);
      }
      if (!db.objectStoreNames.contains(BLOB_STORE)) {
        db.createObjectStore(BLOB_STORE);
      }
    },
  });
}

function getCutAudioBlobKey(projectId: string): string {
  return `cut-audio:${projectId}`;
}

function getMediaBlobStorageKey(localProjectKey: string, assetId: string): string {
  return `${localProjectKey}:media:${assetId}`;
}

function revokeHydratedObjectUrls() {
  hydratedObjectUrls.forEach((url) => URL.revokeObjectURL(url));
  hydratedObjectUrls = [];
}

function serializeElementForStorage(element: Element): Element {
  if ((element.type === 'image' || element.type === 'video' || element.type === 'audio') && element.mediaAssetId) {
    const shouldStripBlobUrl = typeof element.src === 'string' && element.src.startsWith('blob:');
    return shouldStripBlobUrl ? { ...element, src: '' } : { ...element };
  }
  return { ...element };
}

function serializeMediaAsset(asset: MediaAsset): PersistedMediaAsset {
  return {
    id: asset.id,
    name: asset.name,
    type: asset.type,
    mimeType: asset.mimeType,
    size: asset.size,
    duration: asset.duration,
    width: asset.width,
    height: asset.height,
    thumbnailUrl: asset.thumbnailUrl,
    hasLocalSource: Boolean(asset.fileBlob || asset.blobKey || asset.sourceMissing),
  };
}

function getPersistedUIState(): PersistedUIState {
  const ui = useUIStore.getState();
  return {
    appMode: ui.appMode,
    activeTab: ui.activeTab,
    showGrid: ui.showGrid,
    showMediaBin: ui.showMediaBin,
    showSubtitleEditor: ui.showSubtitleEditor,
    showAutoCut: ui.showAutoCut,
    canvasWidth: ui.canvasWidth,
    canvasHeight: ui.canvasHeight,
    canvasBgColor: ui.canvasBgColor,
    zoom: ui.zoom,
    timelineTool: ui.timelineTool,
  };
}

function getPersistedCutState(): PersistedCutState {
  const cut = useCutStore.getState();
  return {
    fileName: cut.fileName,
    duration: cut.duration,
    currentTime: cut.currentTime,
    transcript: cut.transcript,
    markers: cut.markers,
    soundbites: cut.soundbites,
    hasLocalSource: Boolean(cut.audioBlob || cut.audioUrl || cut.sourceMissing),
  };
}

function buildMeaningfulFingerprintPayload(projectNameOverride?: string) {
  const persistence = usePersistenceStore.getState();
  const cut = useCutStore.getState();
  return {
    name: projectNameOverride ?? persistence.projectName,
    edit: {
      elements: useElementStore.getState().elements.map(serializeElementForStorage),
      duration: usePlaybackStore.getState().duration,
      tracks: useTimelineStore.getState().tracks,
    },
    media: useMediaStore.getState().assets.map((asset) => ({
      id: asset.id,
      name: asset.name,
      type: asset.type,
      mimeType: asset.mimeType,
      size: asset.size,
      duration: asset.duration,
      width: asset.width,
      height: asset.height,
      hasLocalSource: Boolean(asset.fileBlob || asset.blobKey || asset.sourceMissing),
    })),
    ui: {
      appMode: useUIStore.getState().appMode,
      canvasWidth: useUIStore.getState().canvasWidth,
      canvasHeight: useUIStore.getState().canvasHeight,
      canvasBgColor: useUIStore.getState().canvasBgColor,
    },
    cut: {
      fileName: cut.fileName,
      duration: cut.duration,
      transcript: cut.transcript,
      markers: cut.markers,
      soundbites: cut.soundbites,
      hasLocalSource: Boolean(cut.audioBlob || cut.audioUrl || cut.sourceMissing),
    },
  };
}

function buildFingerprint(projectNameOverride?: string): string {
  return hashString(JSON.stringify(buildMeaningfulFingerprintPayload(projectNameOverride)));
}

export function buildProjectSnapshot(projectNameOverride?: string): ProjectSnapshot {
  const now = new Date().toISOString();
  const persistence = usePersistenceStore.getState();
  const projectName = projectNameOverride ?? persistence.projectName;
  const fingerprint = buildFingerprint(projectName);

  return {
    version: PROJECT_SNAPSHOT_VERSION,
    meta: {
      projectId: persistence.projectId,
      name: projectName,
      createdAt: persistence.projectCreatedAt,
      updatedAt: now,
      fingerprint,
    },
    sync: {
      cloudProjectId: persistence.cloudProjectId,
      cloudProjectName: persistence.cloudProjectName,
      cloudProjectUpdatedAt: persistence.cloudProjectUpdatedAt,
      lastCloudSyncAt: persistence.lastCloudSyncAt,
      lastCloudFingerprint: persistence.lastCloudFingerprint,
    },
    edit: {
      elements: useElementStore.getState().elements.map(serializeElementForStorage),
      duration: usePlaybackStore.getState().duration,
      currentTime: usePlaybackStore.getState().currentTime,
      tracks: useTimelineStore.getState().tracks,
    },
    media: useMediaStore.getState().assets.map(serializeMediaAsset),
    ui: getPersistedUIState(),
    cut: getPersistedCutState(),
  };
}

function createDefaultSnapshotFromLegacy(input: LegacyProjectData): ProjectSnapshot {
  const projectName = input.name || 'Co-Cut Project';
  const fingerprint = hashString(JSON.stringify({
    name: projectName,
    edit: {
      elements: input.elements || [],
      duration: input.duration || 30,
      tracks: input.tracks || [],
    },
  }));

  return {
    version: PROJECT_SNAPSHOT_VERSION,
    meta: {
      projectId: uid(),
      name: projectName,
      createdAt: input.createdAt || new Date().toISOString(),
      updatedAt: input.updatedAt || new Date().toISOString(),
      fingerprint,
    },
    sync: {
      cloudProjectId: null,
      cloudProjectName: null,
      cloudProjectUpdatedAt: null,
      lastCloudSyncAt: null,
      lastCloudFingerprint: null,
    },
    edit: {
      elements: (input.elements || []).map(serializeElementForStorage),
      duration: input.duration || 30,
      currentTime: 0,
      tracks: input.tracks || [],
    },
    media: [],
    ui: {
      appMode: 'edit',
      activeTab: 'properties',
      showGrid: true,
      showMediaBin: true,
      showSubtitleEditor: false,
      showAutoCut: false,
      canvasWidth: 1920,
      canvasHeight: 1080,
      canvasBgColor: '#111827',
      zoom: 0.5,
      timelineTool: 'select',
    },
    cut: {
      fileName: null,
      duration: 0,
      currentTime: 0,
      transcript: null,
      markers: { in: null, out: null },
      soundbites: [],
      hasLocalSource: false,
    },
  };
}

function createBlankProjectSnapshot(): ProjectSnapshot {
  const timestamp = new Date().toISOString();
  const edit = {
    elements: [],
    duration: 30,
    currentTime: 0,
    tracks: [],
  } satisfies ProjectSnapshot['edit'];
  const fingerprint = hashString(JSON.stringify({
    name: 'Untitled Project',
    edit,
    media: [],
    ui: {
      appMode: 'cut',
      canvasWidth: 1920,
      canvasHeight: 1080,
      canvasBgColor: '#111827',
    },
    cut: {
      fileName: null,
      duration: 0,
      transcript: null,
      markers: { in: null, out: null },
      soundbites: [],
    },
  }));

  return {
    version: PROJECT_SNAPSHOT_VERSION,
    meta: {
      projectId: uid(),
      name: 'Untitled Project',
      createdAt: timestamp,
      updatedAt: timestamp,
      fingerprint,
    },
    sync: {
      cloudProjectId: null,
      cloudProjectName: null,
      cloudProjectUpdatedAt: null,
      lastCloudSyncAt: null,
      lastCloudFingerprint: null,
    },
    edit,
    media: [],
    ui: {
      appMode: 'cut',
      activeTab: 'properties',
      showGrid: true,
      showMediaBin: true,
      showSubtitleEditor: false,
      showAutoCut: false,
      canvasWidth: 1920,
      canvasHeight: 1080,
      canvasBgColor: '#111827',
      zoom: 0.5,
      timelineTool: 'select',
    },
    cut: {
      fileName: null,
      duration: 0,
      currentTime: 0,
      transcript: null,
      markers: { in: null, out: null },
      soundbites: [],
      hasLocalSource: false,
    },
  };
}

function normalizeProjectSnapshot(input: unknown): ProjectSnapshot {
  if (!input || typeof input !== 'object') {
    return createDefaultSnapshotFromLegacy({});
  }

  const candidate = input as Partial<ProjectSnapshot>;
  if (candidate.version === PROJECT_SNAPSHOT_VERSION && candidate.meta && candidate.edit && candidate.ui && candidate.cut) {
    return {
      version: PROJECT_SNAPSHOT_VERSION,
      meta: {
        projectId: candidate.meta.projectId || uid(),
        name: candidate.meta.name || 'Untitled Project',
        createdAt: candidate.meta.createdAt || new Date().toISOString(),
        updatedAt: candidate.meta.updatedAt || new Date().toISOString(),
        fingerprint: candidate.meta.fingerprint || hashString(JSON.stringify(candidate.edit)),
      },
      sync: {
        cloudProjectId: candidate.sync?.cloudProjectId || null,
        cloudProjectName: candidate.sync?.cloudProjectName || null,
        cloudProjectUpdatedAt: candidate.sync?.cloudProjectUpdatedAt || null,
        lastCloudSyncAt: candidate.sync?.lastCloudSyncAt || null,
        lastCloudFingerprint: candidate.sync?.lastCloudFingerprint || null,
      },
      edit: {
        elements: (candidate.edit.elements || []).map(serializeElementForStorage),
        duration: candidate.edit.duration || 30,
        currentTime: candidate.edit.currentTime || 0,
        tracks: candidate.edit.tracks || [],
      },
      media: candidate.media || [],
      ui: {
        appMode: candidate.ui.appMode || 'edit',
        activeTab: candidate.ui.activeTab || 'properties',
        showGrid: candidate.ui.showGrid ?? true,
        showMediaBin: candidate.ui.showMediaBin ?? true,
        showSubtitleEditor: candidate.ui.showSubtitleEditor ?? false,
        showAutoCut: candidate.ui.showAutoCut ?? false,
        canvasWidth: candidate.ui.canvasWidth || 1920,
        canvasHeight: candidate.ui.canvasHeight || 1080,
        canvasBgColor: candidate.ui.canvasBgColor || '#111827',
        zoom: candidate.ui.zoom || 0.5,
        timelineTool: candidate.ui.timelineTool || 'select',
      },
      cut: {
        fileName: candidate.cut.fileName || null,
        duration: candidate.cut.duration || 0,
        currentTime: candidate.cut.currentTime || 0,
        transcript: candidate.cut.transcript || null,
        markers: candidate.cut.markers || { in: null, out: null },
        soundbites: candidate.cut.soundbites || [],
        hasLocalSource: candidate.cut.hasLocalSource ?? false,
      },
    };
  }

  return createDefaultSnapshotFromLegacy(input as LegacyProjectData);
}

async function readMediaBlobs(ids: string[], dbName = DB_NAME): Promise<Map<string, Blob>> {
  if (ids.length === 0) return new Map();
  const db = await openPersistenceDB(dbName);
  const entries = await Promise.all(ids.map(async (id) => {
    const scopedBlob = await db.get(BLOB_STORE, getMediaBlobStorageKey(activeLocalProjectKey, id));
    const legacyBlob = scopedBlob ? null : await db.get(BLOB_STORE, id);
    return [id, scopedBlob || legacyBlob] as const;
  }));
  return new Map(entries.filter((entry): entry is readonly [string, Blob] => Boolean(entry[1])));
}

export async function readPersistedMediaBlobs(ids: string[], dbName = DB_NAME): Promise<Map<string, Blob>> {
  return readMediaBlobs(ids, dbName);
}

export async function readPersistedCutAudioBlob(projectId: string, dbName = DB_NAME): Promise<Blob | null> {
  const db = await openPersistenceDB(dbName);
  return (
    (await db.get(BLOB_STORE, getCutAudioBlobKey(projectId))) ||
    (await db.get(BLOB_STORE, LEGACY_CUT_AUDIO_BLOB_KEY)) ||
    null
  );
}

function hydrateMediaAssets(media: PersistedMediaAsset[], blobs: Map<string, Blob>): { assets: MediaAsset[]; missingCount: number } {
  let missingCount = 0;

  const assets = media.map((asset) => {
    const blob = blobs.get(asset.id) || null;
    const blobKey = blob ? URL.createObjectURL(blob) : '';

    if (blobKey) {
      hydratedObjectUrls.push(blobKey);
    } else if (asset.hasLocalSource) {
      missingCount += 1;
    }

    return {
      id: asset.id,
      name: asset.name,
      type: asset.type,
      mimeType: asset.mimeType,
      size: asset.size,
      duration: asset.duration,
      width: asset.width,
      height: asset.height,
      thumbnailUrl: asset.thumbnailUrl,
      blobKey,
      fileBlob: blob,
      sourceMissing: asset.hasLocalSource && !blob,
    } satisfies MediaAsset;
  });

  return { assets, missingCount };
}

function restoreElementSources(elements: Element[], mediaAssets: MediaAsset[]): Element[] {
  const assetMap = new Map(mediaAssets.map((asset) => [asset.id, asset]));

  return elements.map((element) => {
    if ((element.type === 'image' || element.type === 'video' || element.type === 'audio') && element.mediaAssetId) {
      const asset = assetMap.get(element.mediaAssetId);
      if (asset?.blobKey) {
        return { ...element, src: asset.blobKey };
      }
      if (element.src && !element.src.startsWith('blob:')) {
        return { ...element };
      }
      return { ...element, src: '' };
    }
    return { ...element };
  });
}

function applySnapshotToStores(snapshot: ProjectSnapshot, mediaAssets: MediaAsset[], cutAudioBlob: Blob | null) {
  const cutAudioUrl = cutAudioBlob ? URL.createObjectURL(cutAudioBlob) : null;
  if (cutAudioUrl) {
    hydratedObjectUrls.push(cutAudioUrl);
  }

  useElementStore.getState().setElements(restoreElementSources(snapshot.edit.elements, mediaAssets));
  useElementStore.getState().deselectAll();
  useElementStore.temporal.getState().clear();

  usePlaybackStore.setState({
    duration: snapshot.edit.duration || 30,
    currentTime: snapshot.edit.currentTime || 0,
    isPlaying: false,
    playbackRate: 1,
    loopEnabled: false,
    loopRange: null,
  });

  useTimelineStore.getState().setTracks(snapshot.edit.tracks || []);
  useMediaStore.setState({ assets: mediaAssets, loading: false });

  useUIStore.setState({
    appMode: snapshot.ui.appMode,
    activeTab: snapshot.ui.activeTab,
    showGrid: snapshot.ui.showGrid,
    showMediaBin: snapshot.ui.showMediaBin,
    showSubtitleEditor: snapshot.ui.showSubtitleEditor,
    showAutoCut: snapshot.ui.showAutoCut,
    showNewProjectDialog: false,
    showProjectManager: false,
    exportDialogOpen: false,
    canvasWidth: snapshot.ui.canvasWidth,
    canvasHeight: snapshot.ui.canvasHeight,
    canvasBgColor: snapshot.ui.canvasBgColor,
    zoom: snapshot.ui.zoom,
    timelineTool: snapshot.ui.timelineTool,
  });

  useCutStore.setState({
    audioUrl: cutAudioUrl,
    audioBlob: cutAudioBlob,
    fileName: snapshot.cut.fileName,
    sourceMissing: snapshot.cut.hasLocalSource && !cutAudioBlob,
    sourceError: null,
    duration: snapshot.cut.duration,
    currentTime: snapshot.cut.currentTime,
    isPlaying: false,
    transcript: snapshot.cut.transcript,
    transcribing: false,
    transcribeProgress: 0,
    transcribePhase: '',
    markers: snapshot.cut.markers,
    selectionSource: null,
    selectedSoundbiteId: null,
    soundbites: snapshot.cut.soundbites,
    showExportModal: false,
    showSaveModal: false,
  });
}

function applyHydratedMetadata(snapshot: ProjectSnapshot, options: HydrateProjectOptions, missingMediaCount: number) {
  const isLocalLoad = options.source === 'local';
  const restoredFromPersistence = options.restoredFromPersistence ?? isLocalLoad;
  const cloudProjectId = options.resetCloudBinding ? null : options.cloudProjectId ?? snapshot.sync.cloudProjectId ?? null;
  const cloudProjectName = options.resetCloudBinding ? null : options.cloudProjectName ?? snapshot.sync.cloudProjectName ?? null;
  const cloudProjectUpdatedAt = options.resetCloudBinding ? null : options.cloudProjectUpdatedAt ?? snapshot.sync.cloudProjectUpdatedAt ?? null;
  const lastCloudSyncAt = options.resetCloudBinding
    ? null
    : options.source === 'cloud'
      ? cloudProjectUpdatedAt
      : snapshot.sync.lastCloudSyncAt;
  const lastCloudFingerprint = options.resetCloudBinding
    ? null
    : options.source === 'cloud'
      ? snapshot.meta.fingerprint
      : snapshot.sync.lastCloudFingerprint;

  usePersistenceStore.getState().finishHydration({
    fingerprint: snapshot.meta.fingerprint,
    projectId: snapshot.meta.projectId,
    projectName: snapshot.meta.name,
    projectCreatedAt: snapshot.meta.createdAt,
    lastLocalSavedAt: restoredFromPersistence ? snapshot.meta.updatedAt : null,
    restoredFromPersistence,
    cloudProjectId,
    cloudProjectName,
    cloudProjectUpdatedAt,
    lastCloudSyncAt,
    lastCloudFingerprint,
    missingMediaCount,
    errorMessage: options.hydrationMessage ?? null,
  });
}

export async function hydrateProjectSnapshot(input: unknown, options: HydrateProjectOptions): Promise<HydrateProjectResult> {
  usePersistenceStore.getState().startHydration();
  revokeHydratedObjectUrls();

  const snapshot = normalizeProjectSnapshot(input);
  const storageDbName = options.storageDbName ?? DB_NAME;

  if (options.asNewLocalProject) {
    snapshot.meta.projectId = uid();
    snapshot.meta.createdAt = new Date().toISOString();
    snapshot.sync = {
      cloudProjectId: null,
      cloudProjectName: null,
      cloudProjectUpdatedAt: null,
      lastCloudSyncAt: null,
      lastCloudFingerprint: null,
    };
  }

  const mediaBlobs = await readMediaBlobs(snapshot.media.map((asset) => asset.id), storageDbName);
  const cutAudioBlob = snapshot.cut.hasLocalSource
    ? await readPersistedCutAudioBlob(snapshot.meta.projectId, storageDbName)
    : null;
  const { assets: mediaAssets, missingCount: missingMediaAssets } = hydrateMediaAssets(snapshot.media, mediaBlobs);
  const missingCutAudio = snapshot.cut.hasLocalSource && !cutAudioBlob ? 1 : 0;

  applySnapshotToStores(snapshot, mediaAssets, cutAudioBlob);

  const missingMediaCount = missingMediaAssets + missingCutAudio;
  applyHydratedMetadata(snapshot, options, missingMediaCount);

  return { snapshot, missingMediaCount };
}

function queueAutosave() {
  if (autosaveTimeout) clearTimeout(autosaveTimeout);
  autosaveTimeout = setTimeout(() => {
    saveProject(undefined, { reason: 'autosave' }).catch(() => {});
  }, AUTOSAVE_DEBOUNCE_MS);
}

function handlePossiblePersistenceChange() {
  const persistence = usePersistenceStore.getState();
  if (persistence.hydrating) return;

  const nextFingerprint = buildFingerprint();
  if (nextFingerprint === persistence.currentFingerprint) return;

  usePersistenceStore.getState().markDirty(nextFingerprint);
  queueAutosave();
}

function stopQueuedAutosave() {
  if (!autosaveTimeout) return;
  clearTimeout(autosaveTimeout);
  autosaveTimeout = null;
}

function clearLocalRetry() {
  if (!localRetryTimeout) return;
  clearTimeout(localRetryTimeout);
  localRetryTimeout = null;
}

function scheduleLocalRetry(message: string) {
  clearLocalRetry();
  usePersistenceStore.getState().setLocalRetrying(message);
  localRetryTimeout = setTimeout(() => {
    saveProject(undefined, { reason: 'autosave', force: true }).catch(() => {});
  }, 5000);
}

async function persistBlobs() {
  const db = await openPersistenceDB();
  const mediaAssets = useMediaStore.getState().assets;
  const cut = useCutStore.getState();
  const projectId = usePersistenceStore.getState().projectId;
  const currentProjectBlobPrefix = `${activeLocalProjectKey}:media:`;

  await Promise.all(
    mediaAssets.map(async (asset) => {
      if (asset.fileBlob) {
        await db.put(BLOB_STORE, asset.fileBlob, getMediaBlobStorageKey(activeLocalProjectKey, asset.id));
      }
    }),
  );

  const blobKeys = await db.getAllKeys(BLOB_STORE);
  const keep = new Set(
    mediaAssets
      .filter((asset) => asset.fileBlob)
      .map((asset) => getMediaBlobStorageKey(activeLocalProjectKey, asset.id)),
  );

  if (cut.audioBlob) {
    await db.put(BLOB_STORE, cut.audioBlob, getCutAudioBlobKey(projectId));
  } else {
    await db.delete(BLOB_STORE, getCutAudioBlobKey(projectId));
  }

  await Promise.all(
    blobKeys
      .filter((key): key is string => typeof key === 'string' && key.startsWith(currentProjectBlobPrefix) && !keep.has(key))
      .map((key) => db.delete(BLOB_STORE, key)),
  );
}

export async function saveProject(name?: string, options: SaveProjectOptions = {}): Promise<void> {
  const trimmedName = name?.trim();
  if (trimmedName) {
    usePersistenceStore.getState().setProjectName(trimmedName);
  }

  const reason = options.reason || 'manual';
  const force = options.force ?? reason !== 'autosave';
  const snapshot = buildProjectSnapshot(trimmedName);
  const currentFingerprint = snapshot.meta.fingerprint;
  const persistence = usePersistenceStore.getState();

  if (!force && persistence.lastLocalFingerprint === currentFingerprint) {
    return;
  }

  usePersistenceStore.getState().startLocalSave();

  try {
    clearLocalRetry();
    const db = await openPersistenceDB();
    await db.put(PROJECT_STORE, snapshot, activeLocalProjectKey);
    await persistBlobs();
    usePersistenceStore.getState().finishLocalSave({
      fingerprint: currentFingerprint,
      savedAt: snapshot.meta.updatedAt,
      projectName: snapshot.meta.name,
      manual: reason === 'manual',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save project locally.';
    usePersistenceStore.getState().failLocalSave(message);
    scheduleLocalRetry(message);
    throw error;
  }
}

async function readStoredSnapshot(dbName: string): Promise<ProjectSnapshot | LegacyProjectData | undefined> {
  const db = await openPersistenceDB(dbName);
  return db.get(PROJECT_STORE, activeLocalProjectKey);
}

async function readLegacyStoredSnapshot(dbName: string): Promise<ProjectSnapshot | LegacyProjectData | undefined> {
  const db = await openPersistenceDB(dbName);
  return db.get(PROJECT_STORE, LEGACY_LOCAL_PROJECT_KEY);
}

async function clearLegacyStoredSnapshot(dbName: string): Promise<void> {
  const db = await openPersistenceDB(dbName);
  await db.delete(PROJECT_STORE, LEGACY_LOCAL_PROJECT_KEY);
}

export async function loadProject(userId: string): Promise<boolean> {
  setActiveLocalProjectKey(userId);
  usePersistenceStore.getState().startHydration();

  try {
    const snapshot = await readStoredSnapshot(DB_NAME);

    if (snapshot) {
      await hydrateProjectSnapshot(snapshot, { source: 'local', storageDbName: DB_NAME });
      return true;
    }

    const currentDbLegacySnapshot = await readLegacyStoredSnapshot(DB_NAME);
    if (currentDbLegacySnapshot) {
      await hydrateProjectSnapshot(currentDbLegacySnapshot, {
        source: 'local',
        storageDbName: DB_NAME,
      });
      await saveProject(undefined, { reason: 'migration', force: true });
      await clearLegacyStoredSnapshot(DB_NAME).catch(() => {});
      return true;
    }

    const legacySnapshot = await readLegacyStoredSnapshot(LEGACY_DB_NAME);
    if (legacySnapshot) {
      await hydrateProjectSnapshot(legacySnapshot, {
        source: 'local',
        storageDbName: LEGACY_DB_NAME,
      });
      await saveProject(undefined, { reason: 'migration', force: true });
      await clearLegacyStoredSnapshot(LEGACY_DB_NAME).catch(() => {});
      return true;
    }

    await hydrateProjectSnapshot(createBlankProjectSnapshot(), {
      source: 'local',
      storageDbName: DB_NAME,
      resetCloudBinding: true,
      restoredFromPersistence: false,
    });
    return false;
  } catch {
    await hydrateProjectSnapshot(createBlankProjectSnapshot(), {
      source: 'local',
      storageDbName: DB_NAME,
      resetCloudBinding: true,
      restoredFromPersistence: false,
      hydrationMessage: 'Previous local draft could not be restored. Co-Cut started a blank local draft.',
    }).catch(() => {
      const fingerprint = buildFingerprint();
      usePersistenceStore.getState().finishHydration({ fingerprint });
    });
    return false;
  }
}

export async function initializeProjectPersistence(userId: string): Promise<boolean> {
  const loaded = await loadProject(userId);
  startAutosave();
  return loaded;
}

export function exportProjectJSON(): void {
  const snapshot = buildProjectSnapshot();
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cocut-project-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importProjectJSON(file: File): Promise<boolean> {
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    await hydrateProjectSnapshot(parsed, {
      source: 'import',
      asNewLocalProject: true,
      resetCloudBinding: true,
    });
    await saveProject(undefined, { reason: 'import', force: true });
    return true;
  } catch {
    return false;
  }
}

function flushOnPageHide() {
  saveProject(undefined, { reason: 'pagehide', force: true }).catch(() => {});
}

function handleVisibilityChange() {
  if (document.visibilityState === 'hidden') {
    flushOnPageHide();
  }
}

export function startAutosave(): void {
  if (autosaveStarted) return;
  autosaveStarted = true;

  const subscribe = (unsubscribe: () => void) => {
    storeUnsubscribers.push(unsubscribe);
  };

  subscribe(useElementStore.subscribe(handlePossiblePersistenceChange));
  subscribe(useTimelineStore.subscribe(handlePossiblePersistenceChange));
  subscribe(usePlaybackStore.subscribe(handlePossiblePersistenceChange));
  subscribe(useMediaStore.subscribe(handlePossiblePersistenceChange));
  subscribe(useUIStore.subscribe(handlePossiblePersistenceChange));
  subscribe(useCutStore.subscribe(handlePossiblePersistenceChange));

  window.addEventListener('pagehide', flushOnPageHide);
  document.addEventListener('visibilitychange', handleVisibilityChange);
}

export function stopAutosave(): void {
  if (!autosaveStarted) return;

  autosaveStarted = false;
  stopQueuedAutosave();
  clearLocalRetry();
  storeUnsubscribers.forEach((unsubscribe) => unsubscribe());
  storeUnsubscribers = [];
  window.removeEventListener('pagehide', flushOnPageHide);
  document.removeEventListener('visibilitychange', handleVisibilityChange);
}
