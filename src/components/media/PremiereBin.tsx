/**
 * PremiereBin — Hierarchical media browser that mirrors the project folder structure.
 * Replaces the old MediaBin grid with a proper tree view like Premiere's Project panel.
 */
import { useCallback, useState } from 'react';
import { C, ELEMENT_COLORS } from '../../theme/colors';
import { Icons } from '../../theme/icons';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/Button';
import { useMediaStore } from '../../store/mediaStore';
import { useElementStore } from '../../store/elementStore';
import { usePlaybackStore } from '../../store/playbackStore';
import { useTimelineStore } from '../../store/timelineStore';
import { uid } from '../../utils/uid';
import { setAssetDragData } from '../../config/product';
import { createVideoElement, createImageElement, createAudioElement } from '../../utils/elementFactory';
import { formatTimeShort } from '../../utils/formatTime';
import type { MediaAsset } from '../../types';
import { inferLocalMediaKind, readLocalMediaMetadata } from '../../utils/localMedia';
import { previewAssetInMonitor } from './SourceMonitor';
import { showToast } from '../ui/Toast';

/* ─── Folder definitions (mirrors Content Co-op folder structure) ─────────── */
interface BinFolder {
  id: string;
  label: string;
  path: string;         // matching rule — asset names with this substring land here
  icon?: string;
  color?: string;
  children?: BinFolder[];
  assetFilter?: (a: MediaAsset) => boolean;
}

const BIN_TREE: BinFolder[] = [
  {
    id: 'interview',
    label: 'INTERVIEW',
    path: 'interview',
    color: C.accent,
    assetFilter: (a) =>
      a.type === 'video' &&
      (a.name.toLowerCase().includes('interview') || (a as any).assetClass === 'interview'),
    children: [
      {
        id: 'soundbites',
        label: 'SOUND BITES',
        path: 'soundbite',
        color: C.copper,
        assetFilter: (a) =>
          a.name.toLowerCase().includes('soundbite') || (a as any).assetClass === 'soundbite',
      },
    ],
  },
  {
    id: 'broll',
    label: 'B-ROLL',
    path: 'broll',
    color: C.teal,
    assetFilter: (a) =>
      a.type === 'video' &&
      !a.name.toLowerCase().includes('interview') &&
      (a as any).assetClass !== 'soundbite',
    children: [
      {
        id: 'stable',
        label: 'STABLE',
        path: 'stable',
        color: C.success,
        assetFilter: (a) =>
          a.name.toLowerCase().includes('stable') || (a as any).stabilized === true,
      },
    ],
  },
  {
    id: 'audio',
    label: 'AUDIO',
    path: 'audio',
    color: C.blue,
    assetFilter: (a) => a.type === 'audio',
    children: [
      {
        id: 'music',
        label: 'MUSIC',
        path: 'music',
        color: C.pink,
        assetFilter: (a) => a.type === 'audio' && a.name.toLowerCase().includes('music'),
      },
      {
        id: 'sfx',
        label: 'SFX',
        path: 'sfx',
        color: C.pink,
        assetFilter: (a) => a.type === 'audio' && (a.name.toLowerCase().includes('sfx') || a.name.toLowerCase().includes('sound')),
      },
    ],
  },
  {
    id: 'graphics',
    label: 'GRAPHICS',
    path: 'graphics',
    color: C.copper,
    assetFilter: (a) => a.type === 'image',
  },
];

/* ─── Single asset row ───────────────────────────────────────────────────────── */
function AssetRow({
  asset,
  onAddToTimeline,
  selectedId,
  onSelect,
}: {
  asset: MediaAsset;
  onAddToTimeline: (asset: MediaAsset) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const isSelected = asset.id === selectedId;
  const isStabilized = asset.name.toLowerCase().includes('stable') || (asset as any).stabilized === true;
  const isSoundbite = asset.name.toLowerCase().includes('soundbite') || (asset as any).assetClass === 'soundbite';
  const stabilityScore = (asset as any).stabilityScore;

  return (
    <div
      role="button"
      tabIndex={0}
      draggable={!asset.sourceMissing}
      onClick={() => {
        onSelect(asset.id);
        previewAssetInMonitor(asset.id);
      }}
      onDoubleClick={() => onAddToTimeline(asset)}
      onKeyDown={(e) => { if (e.key === 'Enter') onAddToTimeline(asset); }}
      onDragStart={(e) => {
        if (asset.sourceMissing) { e.preventDefault(); return; }
        setAssetDragData(e.dataTransfer, asset.id);
        e.dataTransfer.effectAllowed = 'copy';
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '5px 8px 5px 12px',
        borderRadius: 6,
        background: isSelected ? `${C.accent}18` : 'transparent',
        border: `1px solid ${isSelected ? C.accent + '50' : 'transparent'}`,
        cursor: 'pointer',
        opacity: asset.sourceMissing ? 0.6 : 1,
        transition: 'background 0.1s ease, border-color 0.1s ease',
      }}
      onMouseEnter={(e) => {
        if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = C.surface3;
      }}
      onMouseLeave={(e) => {
        if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'transparent';
      }}
    >
      {/* Thumbnail */}
      <div
        style={{
          width: 36,
          height: 24,
          borderRadius: 4,
          overflow: 'hidden',
          flexShrink: 0,
          background: asset.thumbnailUrl
            ? `url(${asset.thumbnailUrl}) center/cover no-repeat`
            : C.surface3,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: `1px solid ${C.border}`,
        }}
      >
        {!asset.thumbnailUrl && (
          <Icon
            d={asset.type === 'video' ? Icons.film : asset.type === 'audio' ? Icons.music : Icons.image}
            size={12}
            color={ELEMENT_COLORS[asset.type] || C.textMuted}
          />
        )}
      </div>

      {/* Name and meta */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: C.text,
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
          }}
        >
          {asset.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
          {asset.duration && (
            <span style={{ fontSize: 9, color: C.textMuted }}>{formatTimeShort(asset.duration)}</span>
          )}
          {isStabilized && (
            <span
              style={{
                fontSize: 8,
                fontWeight: 700,
                color: C.success,
                background: `${C.success}15`,
                border: `1px solid ${C.success}30`,
                borderRadius: 3,
                padding: '1px 4px',
                letterSpacing: 0.4,
              }}
            >
              ✦ STABLE{stabilityScore ? ` ${stabilityScore}%` : ''}
            </span>
          )}
          {isSoundbite && !isStabilized && (
            <span
              style={{
                fontSize: 8,
                fontWeight: 700,
                color: C.copper,
                background: `${C.copper}15`,
                border: `1px solid ${C.copper}30`,
                borderRadius: 3,
                padding: '1px 4px',
                letterSpacing: 0.4,
              }}
            >
              BITE
            </span>
          )}
          {asset.sourceMissing && (
            <span style={{ fontSize: 8, color: C.error, fontWeight: 600 }}>MISSING</span>
          )}
        </div>
      </div>

      {/* Add to timeline button */}
      <button
        title="Add to timeline (double-click)"
        onClick={(e) => { e.stopPropagation(); onAddToTimeline(asset); }}
        style={{
          background: 'none',
          border: `1px solid ${C.border}`,
          borderRadius: 4,
          color: C.textDim,
          cursor: 'pointer',
          fontSize: 10,
          padding: '2px 6px',
          flexShrink: 0,
          opacity: 0,
          transition: 'opacity 0.1s',
        }}
        className="asset-add-btn"
      >
        +
      </button>
    </div>
  );
}

/* ─── Folder row ─────────────────────────────────────────────────────────────── */
function FolderRow({
  folder,
  assets,
  depth,
  allFolders,
  selectedId,
  onSelect,
  onAddToTimeline,
}: {
  folder: BinFolder;
  assets: MediaAsset[];
  depth: number;
  allFolders: BinFolder[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAddToTimeline: (asset: MediaAsset) => void;
}) {
  const [open, setOpen] = useState(true);

  // Get direct assets for this folder (not child folders)
  const folderAssets = folder.assetFilter
    ? assets.filter(folder.assetFilter)
    : [];

  // Exclude assets claimed by child folders
  const childFiltered = folder.children
    ? folderAssets.filter((a) => !folder.children!.some((c) => c.assetFilter?.(a)))
    : folderAssets;

  const totalCount = folderAssets.length +
    (folder.children?.reduce((acc, c) => acc + (assets.filter(c.assetFilter ?? (() => false)).length), 0) ?? 0);

  const color = folder.color || C.textDim;

  return (
    <div style={{ paddingLeft: depth * 10 }}>
      {/* Folder header */}
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          width: '100%',
          background: 'none',
          border: 'none',
          borderRadius: 6,
          cursor: 'pointer',
          padding: '5px 8px',
          textAlign: 'left',
          transition: 'background 0.1s ease',
          color: C.text,
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = C.surface3; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
      >
        <span style={{ fontSize: 9, color: C.textMuted, width: 10, flexShrink: 0 }}>
          {open ? '▾' : '▸'}
        </span>
        <Icon d={Icons.folder} size={12} color={color} />
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 0.6,
            color: color,
            textTransform: 'uppercase',
            flex: 1,
          }}
        >
          {folder.label}
        </span>
        {totalCount > 0 && (
          <span
            style={{
              fontSize: 9,
              color: C.textMuted,
              background: C.surface3,
              borderRadius: 8,
              padding: '1px 6px',
              fontWeight: 600,
            }}
          >
            {totalCount}
          </span>
        )}
      </button>

      {/* Contents */}
      {open && (
        <div>
          {/* Child folders first */}
          {folder.children?.map((child) => (
            <FolderRow
              key={child.id}
              folder={child}
              assets={assets}
              depth={depth + 1}
              allFolders={allFolders}
              selectedId={selectedId}
              onSelect={onSelect}
              onAddToTimeline={onAddToTimeline}
            />
          ))}

          {/* Assets in this folder (not claimed by children) */}
          {childFiltered.map((asset) => (
            <AssetRow
              key={asset.id}
              asset={asset}
              selectedId={selectedId}
              onSelect={onSelect}
              onAddToTimeline={onAddToTimeline}
            />
          ))}

          {/* Empty state */}
          {totalCount === 0 && (
            <div
              style={{
                padding: '4px 8px 6px 20px',
                fontSize: 10,
                color: C.textMuted,
                fontStyle: 'italic',
              }}
            >
              Empty
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Main PremiereBin ───────────────────────────────────────────────────────── */
export function PremiereBin() {
  const assets = useMediaStore((s) => s.assets);
  const addAsset = useMediaStore((s) => s.addAsset);
  const loading = useMediaStore((s) => s.loading);
  const setLoading = useMediaStore((s) => s.setLoading);
  const addElement = useElementStore((s) => s.addElement);
  const currentTime = usePlaybackStore((s) => s.currentTime);
  const duration = usePlaybackStore((s) => s.duration);
  const setDuration = usePlaybackStore((s) => s.setDuration);
  const addTrack = useTimelineStore((s) => s.addTrack);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'tree' | 'list'>('tree');

  const handleFiles = useCallback(
    async (files: FileList) => {
      const fileList = Array.from(files);
      if (fileList.length === 0) return;
      setLoading(true);
      let imported = 0;

      for (const [index, file] of fileList.entries()) {
        const kind = inferLocalMediaKind(file);
        if (!kind) {
          showToast(`"${file.name}" is not a supported media asset.`, 'warning');
          continue;
        }
        const meta = await readLocalMediaMetadata(file, kind);
        const blobUrl = URL.createObjectURL(file);
        const assetId = uid();
        const asset: MediaAsset = {
          id: assetId,
          name: file.name,
          type: meta.type,
          mimeType: file.type,
          size: file.size,
          duration: meta.duration,
          width: meta.width,
          height: meta.height,
          thumbnailUrl: meta.thumbnailUrl,
          blobKey: blobUrl,
          fileBlob: file,
          sourceMissing: false,
        };
        addAsset(asset);
        imported += 1;

        if (index === 0) {
          // Auto-preview first imported asset
          previewAssetInMonitor(assetId);
        }
      }

      setLoading(false);
      if (imported > 0) {
        showToast(
          `${imported} asset${imported === 1 ? '' : 's'} imported into bin.`,
          'success',
        );
      }
    },
    [addAsset, setLoading],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'video/*,image/*,audio/*';
    input.onchange = () => { if (input.files) void handleFiles(input.files); };
    input.click();
  };

  const addToTimeline = (asset: MediaAsset) => {
    if (asset.sourceMissing || !asset.blobKey) return;
    if (asset.type === 'video') {
      const trackId = addTrack('video');
      const dur = asset.duration || 10;
      const el = createVideoElement({
        name: asset.name,
        mediaAssetId: asset.id,
        src: asset.blobKey,
        startTime: currentTime,
        duration: dur,
        trimOut: dur,
        width: asset.width || 1920,
        height: asset.height || 1080,
        trackId,
      });
      addElement(el);
      if (currentTime + dur > duration) setDuration(currentTime + dur + 5);
    } else if (asset.type === 'image') {
      const trackId = addTrack('graphic');
      const el = createImageElement({
        name: asset.name,
        mediaAssetId: asset.id,
        src: asset.blobKey,
        startTime: currentTime,
        duration: 5,
        width: asset.width ? Math.min(asset.width, 800) : 400,
        height: asset.height ? Math.min(asset.height, 600) : 300,
        trackId,
      });
      addElement(el);
    } else if (asset.type === 'audio') {
      const trackId = addTrack('audio');
      const dur = asset.duration || 10;
      const el = createAudioElement({
        name: asset.name,
        mediaAssetId: asset.id,
        src: asset.blobKey,
        startTime: currentTime,
        duration: dur,
        trimOut: dur,
        trackId,
      });
      addElement(el);
      if (currentTime + dur > duration) setDuration(currentTime + dur + 5);
    }
    showToast(`"${asset.name}" added to timeline.`, 'info', 2500);
  };

  // Filter by search
  const filteredAssets = searchQuery
    ? assets.filter((a) => a.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : assets;

  // Compute uncategorized assets (not matching any top-level folder)
  const categorizedIds = new Set<string>();
  filteredAssets.forEach((a) => { categorizedIds.add(a.id); });

  return (
    <aside
      style={{
        width: '100%',
        height: '100%',
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 14px 10px',
          borderBottom: `1px solid ${C.border}`,
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 9, color: C.copper, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, marginBottom: 3 }}>
              Project
            </div>
            <div style={{ fontSize: 13, color: C.text, fontWeight: 700 }}>
              Media Bin
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              title={viewMode === 'tree' ? 'List view' : 'Tree view'}
              onClick={() => setViewMode((v) => v === 'tree' ? 'list' : 'tree')}
              style={{
                background: C.surface2,
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                color: C.textDim,
                cursor: 'pointer',
                fontSize: 10,
                padding: '3px 7px',
              }}
            >
              {viewMode === 'tree' ? '≡' : '⊞'}
            </button>
            <Button small onClick={handleImport}>
              <Icon d={Icons.upload} size={10} /> Import
            </Button>
          </div>
        </div>

        {/* Search */}
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search assets..."
          style={{
            width: '100%',
            boxSizing: 'border-box',
            background: C.surface2,
            border: `1px solid ${C.border}`,
            borderRadius: 6,
            color: C.text,
            fontSize: 11,
            padding: '5px 9px',
            outline: 'none',
            fontFamily: 'inherit',
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = C.border2; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = C.border; }}
        />
      </div>

      {/* Stats bar */}
      {assets.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '6px 14px',
            borderBottom: `1px solid ${C.border}`,
            background: C.surface2,
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 9, color: C.textMuted, fontWeight: 600 }}>
            {assets.length} asset{assets.length !== 1 ? 's' : ''}
          </span>
          {assets.filter((a) => a.type === 'video').length > 0 && (
            <span style={{ fontSize: 9, color: C.pink }}>
              {assets.filter((a) => a.type === 'video').length} video
            </span>
          )}
          {assets.filter((a) => a.type === 'audio').length > 0 && (
            <span style={{ fontSize: 9, color: C.blue }}>
              {assets.filter((a) => a.type === 'audio').length} audio
            </span>
          )}
          {assets.filter((a) => (a as any).stabilized).length > 0 && (
            <span style={{ fontSize: 9, color: C.success }}>
              ✦ {assets.filter((a) => (a as any).stabilized).length} stable
            </span>
          )}
          {loading && (
            <span style={{ fontSize: 9, color: C.copper, marginLeft: 'auto' }}>Ingesting…</span>
          )}
        </div>
      )}

      {/* Tree / List content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 4px' }}>
        {assets.length === 0 ? (
          <div
            onClick={handleImport}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              minHeight: 180,
              color: C.textMuted,
              fontSize: 11,
              border: `2px dashed ${C.border}`,
              borderRadius: 10,
              margin: 8,
              cursor: 'pointer',
              background: C.surface2,
              textAlign: 'center',
              padding: '1rem',
            }}
          >
            <Icon d={Icons.upload} size={22} color={C.border} />
            <span>{loading ? 'Ingesting assets…' : 'Drop media files or click to import'}</span>
            <span style={{ fontSize: 9, color: C.textMuted, maxWidth: 160, lineHeight: 1.6 }}>
              Supports video, audio, and image files
            </span>
          </div>
        ) : viewMode === 'tree' ? (
          // Tree view
          <div>
            <style>{`
              .asset-add-btn { opacity: 0 !important; }
              [role="button"]:hover .asset-add-btn { opacity: 1 !important; }
            `}</style>
            {BIN_TREE.map((folder) => (
              <FolderRow
                key={folder.id}
                folder={folder}
                assets={filteredAssets}
                depth={0}
                allFolders={BIN_TREE}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onAddToTimeline={addToTimeline}
              />
            ))}
          </div>
        ) : (
          // Flat list view
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 4px' }}>
            {filteredAssets.map((asset) => (
              <AssetRow
                key={asset.id}
                asset={asset}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onAddToTimeline={addToTimeline}
              />
            ))}
          </div>
        )}
      </div>

      {/* Drop hint when bin has items */}
      {assets.length > 0 && (
        <div
          style={{
            padding: '6px 14px',
            borderTop: `1px solid ${C.border}`,
            fontSize: 9,
            color: C.textMuted,
            flexShrink: 0,
            textAlign: 'center',
          }}
        >
          Double-click to add to timeline · Drag to position
        </div>
      )}
    </aside>
  );
}
