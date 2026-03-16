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

export function MediaBin() {
  const assets = useMediaStore((s) => s.assets);
  const addAsset = useMediaStore((s) => s.addAsset);
  const loading = useMediaStore((s) => s.loading);
  const setLoading = useMediaStore((s) => s.setLoading);
  const addElement = useElementStore((s) => s.addElement);
  const currentTime = usePlaybackStore((s) => s.currentTime);
  const duration = usePlaybackStore((s) => s.duration);
  const setDuration = usePlaybackStore((s) => s.setDuration);
  const addTrack = useTimelineStore((s) => s.addTrack);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleFiles = useCallback(
    async (files: FileList) => {
      const fileList = Array.from(files);
      if (fileList.length === 0) return;

      setErrorMessage(null);
      setStatusMessage(`Attaching ${fileList.length} local assembly asset${fileList.length === 1 ? '' : 's'} to this project…`);
      setLoading(true);
      let importedCount = 0;

      for (const [index, file] of fileList.entries()) {
        const kind = inferLocalMediaKind(file);
        if (!kind) {
          setErrorMessage(`"${file.name}" is not a supported image, video, or audio asset.`);
          continue;
        }

        setStatusMessage(`Ingesting ${index + 1} of ${fileList.length}: ${file.name}`);
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
        importedCount += 1;
      }
      setLoading(false);
      setStatusMessage(
        importedCount > 0
          ? `${importedCount} local assembly asset${importedCount === 1 ? '' : 's'} attached to this project draft.`
          : null,
      );
    },
    [addAsset, setLoading],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles],
  );

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'video/*,image/*,audio/*';
    input.onchange = () => {
      if (input.files) handleFiles(input.files);
    };
    input.click();
  };

  const addToTimeline = (asset: MediaAsset) => {
    if (asset.sourceMissing || !asset.blobKey) return;

    if (asset.type === 'video') {
      const trackId = addTrack('video');
      const mediaDuration = asset.duration || 10;
      const el = createVideoElement({
        name: asset.name,
        mediaAssetId: asset.id,
        src: asset.blobKey,
        startTime: currentTime,
        duration: mediaDuration,
        trimOut: mediaDuration,
        width: asset.width || 1920,
        height: asset.height || 1080,
        trackId,
      });
      addElement(el);
      if (currentTime + mediaDuration > duration) setDuration(currentTime + mediaDuration + 5);
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
      const mediaDuration = asset.duration || 10;
      const el = createAudioElement({
        name: asset.name,
        mediaAssetId: asset.id,
        src: asset.blobKey,
        startTime: currentTime,
        duration: mediaDuration,
        trimOut: mediaDuration,
        trackId,
      });
      addElement(el);
      if (currentTime + mediaDuration > duration) setDuration(currentTime + mediaDuration + 5);
    }
  };

  return (
    <aside
      style={{
        minHeight: 0,
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          padding: '16px 18px 14px',
          borderBottom: `1px solid ${C.border}`,
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 10, color: C.copper, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700, marginBottom: 5 }}>
            Assembly
          </div>
          <div style={{ fontSize: 16, color: C.text, fontWeight: 700, marginBottom: 4 }}>
            Media for Assembly
          </div>
          <div style={{ fontSize: 11, color: C.textDim, lineHeight: 1.5 }}>
            Bring in B-roll, stills, music, and other assembly assets here. Interview source ingest belongs in Cut.
          </div>
        </div>
        <Button small onClick={handleImport}>
          <Icon d={Icons.upload} size={12} /> Import Media
        </Button>
      </div>

      {(statusMessage || errorMessage) && (
        <div
          style={{
            padding: '10px 12px',
            borderBottom: `1px solid ${C.border}`,
            fontSize: 11,
            lineHeight: 1.5,
            color: errorMessage ? C.orange : C.textDim,
            background: errorMessage ? `${C.orange}10` : C.surface2,
          }}
        >
          {errorMessage || statusMessage}
        </div>
      )}

      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 10,
          padding: 12,
          overflowY: 'auto',
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        {assets.length === 0 && (
          <div
            style={{
              gridColumn: '1 / -1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: 8,
              color: C.textDim,
              fontSize: 11,
              border: `2px dashed ${C.border}`,
              borderRadius: 14,
              cursor: 'pointer',
              minHeight: 220,
              background: C.surface2,
              padding: '18px 16px',
              textAlign: 'center',
            }}
            onClick={handleImport}
          >
            <Icon d={Icons.upload} size={24} color={C.border2} />
            <div>{loading ? 'Loading assets…' : 'Drop files here or click to import'}</div>
            <div style={{ fontSize: 10, color: C.textMuted, maxWidth: 180, lineHeight: 1.6 }}>
              Use Cut for the primary interview source. Use this bin for assembly assets that stay local to this browser.
            </div>
          </div>
        )}

        {assets.map((asset) => (
          <button
            key={asset.id}
            onClick={() => addToTimeline(asset)}
            draggable={!asset.sourceMissing}
            onDragStart={(e) => {
              if (asset.sourceMissing) {
                e.preventDefault();
                return;
              }
              setAssetDragData(e.dataTransfer, asset.id);
              e.dataTransfer.effectAllowed = 'copy';
            }}
            style={{
              width: '100%',
              cursor: asset.sourceMissing ? 'not-allowed' : 'grab',
              borderRadius: 14,
              overflow: 'hidden',
              border: `1px solid ${C.border}`,
              background: C.surface2,
              transition: 'border-color 0.15s',
              opacity: asset.sourceMissing ? 0.65 : 1,
              textAlign: 'left',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = asset.sourceMissing ? C.orange : C.accent;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = C.border;
            }}
          >
            <div
              style={{
                width: '100%',
                height: 90,
                background: asset.thumbnailUrl
                  ? `url(${asset.thumbnailUrl}) center/cover`
                  : C.surface3,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {!asset.thumbnailUrl && (
                <Icon
                  d={asset.type === 'video' ? Icons.film : asset.type === 'audio' ? Icons.music : Icons.image}
                  size={20}
                  color={ELEMENT_COLORS[asset.type] || C.textDim}
                />
              )}
            </div>
            <div style={{ padding: '10px 10px 12px' }}>
              <div
                style={{
                  fontSize: 11,
                  color: C.text,
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  fontWeight: 600,
                  marginBottom: 4,
                }}
              >
                {asset.name}
              </div>
              {asset.sourceMissing && (
                <div style={{ fontSize: 9, color: C.orange, marginBottom: 3 }}>
                  source missing on this browser
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 9, color: ELEMENT_COLORS[asset.type] || C.textDim, textTransform: 'uppercase', letterSpacing: 0.7, fontWeight: 700 }}>
                  {asset.type}
                </span>
                {asset.duration && (
                  <>
                    <span style={{ fontSize: 9, color: C.textMuted }}>•</span>
                    <span style={{ fontSize: 9, color: C.textDim }}>
                      {formatTimeShort(asset.duration)}
                    </span>
                  </>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </aside>
  );
}
