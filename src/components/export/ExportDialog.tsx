import { useState, useRef } from 'react';
import { C } from '../../theme/colors';
import { FONT_FAMILY, FONT_FAMILY_BRAND, FONT_FAMILY_MONO } from '../../theme/tokens';
import { Icons } from '../../theme/icons';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/Button';
// NumberInput available for custom resolution
import { Select } from '../ui/Select';
import { useUIStore } from '../../store/uiStore';
import { usePlaybackStore } from '../../store/playbackStore';
import {
  exportProject,
  downloadBlob,
  DEFAULT_EXPORT_SETTINGS,
  type ExportSettings,
  type ExportProgress,
} from '../../services/exportPipeline';
import { formatTime } from '../../utils/formatTime';

export function ExportDialog() {
  const exportDialogOpen = useUIStore((s) => s.exportDialogOpen);
  const setExportDialogOpen = useUIStore((s) => s.setExportDialogOpen);
  const duration = usePlaybackStore((s) => s.duration);

  const [settings, setSettings] = useState<ExportSettings>({ ...DEFAULT_EXPORT_SETTINGS });
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  if (!exportDialogOpen) return null;

  const isExporting = progress !== null && progress.phase !== 'done' && progress.phase !== 'error';

  const handleExport = async () => {
    setError(null);
    abortRef.current = new AbortController();

    try {
      const blob = await exportProject(settings, setProgress, abortRef.current.signal);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      downloadBlob(blob, `coedit-export-${timestamp}.${settings.format}`);
    } catch (err: any) {
      if (err.message === 'Export cancelled') {
        setProgress(null);
      } else {
        setError(err.message);
        setProgress({ phase: 'error', percent: 0, currentFrame: 0, totalFrames: 0, message: err.message });
      }
    }
  };

  const handleCancel = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setProgress(null);
  };

  const handleClose = () => {
    if (!isExporting) {
      setExportDialogOpen(false);
      setProgress(null);
      setError(null);
    }
  };

  const totalFrames = Math.ceil(duration * settings.fps);
  const estFileSize = ((settings.width * settings.height * totalFrames * 0.1) / (1024 * 1024)).toFixed(0);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 5000,
        fontFamily: FONT_FAMILY,
      }}
      onClick={handleClose}
    >
      <div
        style={{
          width: 420,
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '14px 18px',
            borderBottom: `1px solid ${C.border}`,
            gap: 8,
          }}
        >
          <Icon d={Icons.download} size={16} color={C.accent} />
          <span style={{ fontFamily: FONT_FAMILY_BRAND, fontSize: 14, fontWeight: 600, flex: 1 }}>
            Export Video
          </span>
          <span
            style={{ fontSize: 16, color: C.textDim, cursor: 'pointer', lineHeight: 1 }}
            onClick={handleClose}
          >
            ✕
          </span>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 18px' }}>
          {!isExporting && progress?.phase !== 'done' && (
            <>
              {/* Resolution */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 10, color: C.textDim, display: 'block', marginBottom: 4 }}>
                  Resolution
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Select
                    value={`${settings.width}x${settings.height}`}
                    onChange={(v) => {
                      const [w, h] = v.split('x').map(Number);
                      setSettings((s) => ({ ...s, width: w, height: h }));
                    }}
                    options={[
                      { label: '1920 × 1080 (Full HD)', value: '1920x1080' },
                      { label: '1280 × 720 (HD)', value: '1280x720' },
                      { label: '3840 × 2160 (4K)', value: '3840x2160' },
                      { label: '1080 × 1920 (Vertical)', value: '1080x1920' },
                      { label: '1080 × 1080 (Square)', value: '1080x1080' },
                    ]}
                    style={{ flex: 1 }}
                  />
                </div>
              </div>

              {/* FPS + Bitrate */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 10, color: C.textDim, display: 'block', marginBottom: 4 }}>
                    Frame Rate
                  </label>
                  <Select
                    value={String(settings.fps)}
                    onChange={(v) => setSettings((s) => ({ ...s, fps: Number(v) }))}
                    options={[
                      { label: '24 fps (Film)', value: '24' },
                      { label: '30 fps (Standard)', value: '30' },
                      { label: '60 fps (Smooth)', value: '60' },
                    ]}
                    style={{ width: '100%' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 10, color: C.textDim, display: 'block', marginBottom: 4 }}>
                    Quality
                  </label>
                  <Select
                    value={settings.videoBitrate}
                    onChange={(v) => setSettings((s) => ({ ...s, videoBitrate: v }))}
                    options={[
                      { label: 'Low (2 Mbps)', value: '2M' },
                      { label: 'Medium (5 Mbps)', value: '5M' },
                      { label: 'High (10 Mbps)', value: '10M' },
                      { label: 'Ultra (20 Mbps)', value: '20M' },
                    ]}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              {/* Format */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 10, color: C.textDim, display: 'block', marginBottom: 4 }}>
                  Format
                </label>
                <Select
                  value={settings.format}
                  onChange={(v) => setSettings((s) => ({ ...s, format: v as 'mp4' | 'webm' }))}
                  options={[
                    { label: 'MP4 (H.264)', value: 'mp4' },
                    { label: 'WebM (VP9)', value: 'webm' },
                  ]}
                  style={{ width: '100%' }}
                />
              </div>

              {/* Summary */}
              <div
                style={{
                  background: C.surface2,
                  borderRadius: 6,
                  padding: '10px 12px',
                  marginBottom: 16,
                  border: `1px solid ${C.border}`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: C.textDim }}>Duration</span>
                  <span style={{ fontSize: 10, color: C.text, fontFamily: FONT_FAMILY_MONO }}>
                    {formatTime(duration)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: C.textDim }}>Total Frames</span>
                  <span style={{ fontSize: 10, color: C.text, fontFamily: FONT_FAMILY_MONO }}>
                    {totalFrames.toLocaleString()}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 10, color: C.textDim }}>Est. File Size</span>
                  <span style={{ fontSize: 10, color: C.text, fontFamily: FONT_FAMILY_MONO }}>
                    ~{estFileSize} MB
                  </span>
                </div>
              </div>

              {error && (
                <div style={{ background: '#2d1111', border: `1px solid ${C.red}44`, borderRadius: 6, padding: '8px 12px', marginBottom: 12, fontSize: 10, color: C.red }}>
                  {error}
                </div>
              )}

              <Button
                onClick={handleExport}
                style={{
                  width: '100%',
                  padding: '10px 0',
                  background: C.accent,
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: 12,
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <Icon d={Icons.download} size={14} color="#fff" />
                Export {settings.format.toUpperCase()}
              </Button>
            </>
          )}

          {/* Progress */}
          {isExporting && progress && (
            <div>
              <div style={{ fontSize: 11, color: C.text, marginBottom: 8, fontWeight: 500 }}>
                {progress.message}
              </div>

              {/* Progress bar */}
              <div
                style={{
                  height: 6,
                  background: C.surface3,
                  borderRadius: 3,
                  overflow: 'hidden',
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${progress.percent}%`,
                    background: `linear-gradient(90deg, ${C.accent}, ${C.accent2})`,
                    borderRadius: 3,
                    transition: 'width 0.3s',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 10, color: C.textDim }}>
                  {progress.phase === 'loading' && 'Loading FFmpeg...'}
                  {progress.phase === 'rendering' && `Frame ${progress.currentFrame} / ${progress.totalFrames}`}
                  {progress.phase === 'encoding' && 'Encoding...'}
                  {progress.phase === 'muxing' && 'Muxing audio...'}
                </span>
                <span style={{ fontSize: 10, color: C.accent2, fontFamily: FONT_FAMILY_MONO }}>
                  {progress.percent}%
                </span>
              </div>

              <Button
                onClick={handleCancel}
                style={{
                  width: '100%',
                  padding: '8px 0',
                  background: 'transparent',
                  color: C.red,
                  border: `1px solid ${C.red}44`,
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 11,
                }}
              >
                Cancel Export
              </Button>
            </div>
          )}

          {/* Done */}
          {progress?.phase === 'done' && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>
                <Icon d={Icons.download} size={32} color={C.green} />
              </div>
              <div style={{ fontSize: 13, color: C.text, fontWeight: 600, marginBottom: 4 }}>
                Export Complete
              </div>
              <div style={{ fontSize: 10, color: C.textDim, marginBottom: 16 }}>
                Your video has been downloaded.
              </div>
              <Button
                onClick={handleClose}
                style={{
                  padding: '8px 24px',
                  background: C.accent,
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                Done
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
