/**
 * SourceMonitor — Premiere-style video preview player
 * Shows either: a video asset selected in the bin, OR a live canvas preview.
 * Features: play/pause, scrubber, timecode, in/out point marking
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { C } from '../../theme/colors';
import { Icons } from '../../theme/icons';
import { Icon } from '../ui/Icon';
import { useMediaStore } from '../../store/mediaStore';
import { formatTimeShort } from '../../utils/formatTime';

// Simple pub/sub for source monitor selection
type SourceMonitorListener = (assetId: string | null) => void;
const smListeners: SourceMonitorListener[] = [];
let currentSourceId: string | null = null;

export function previewAssetInMonitor(assetId: string | null) {
  currentSourceId = assetId;
  smListeners.forEach((l) => l(assetId));
}

function useSourceMonitor() {
  const [assetId, setAssetId] = useState<string | null>(currentSourceId);
  useEffect(() => {
    const listener: SourceMonitorListener = (id) => setAssetId(id);
    smListeners.push(listener);
    return () => {
      const idx = smListeners.indexOf(listener);
      if (idx >= 0) smListeners.splice(idx, 1);
    };
  }, []);
  return assetId;
}

function formatTimecode(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const f = Math.floor((sec % 1) * 30); // assume 30fps
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')};${String(f).padStart(2, '0')}`;
}

export function SourceMonitor() {
  const assetId = useSourceMonitor();
  const getAsset = useMediaStore((s) => s.getAsset);
  const asset = assetId ? getAsset(assetId) : null;

  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [inPoint, setInPoint] = useState<number | null>(null);
  const [outPoint, setOutPoint] = useState<number | null>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const scrubberRef = useRef<HTMLDivElement>(null);

  // Reset when asset changes
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setInPoint(null);
    setOutPoint(null);
  }, [assetId]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.pause();
    } else {
      if (inPoint !== null && (currentTime < inPoint || currentTime >= (outPoint ?? duration))) {
        video.currentTime = inPoint;
      }
      void video.play();
    }
  }, [isPlaying, inPoint, outPoint, currentTime, duration]);

  const handleScrubberClick = useCallback((e: React.MouseEvent) => {
    const bar = scrubberRef.current;
    const video = videoRef.current;
    if (!bar || !video || !duration) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const time = ratio * duration;
    video.currentTime = time;
    setCurrentTime(time);
  }, [duration]);

  const handleScrubberHover = useCallback((e: React.MouseEvent) => {
    const bar = scrubberRef.current;
    if (!bar || !duration) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverTime(ratio * duration);
  }, [duration]);

  // Keyboard shortcuts when source monitor is focused
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      // Only capture if no modifier
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.code === 'KeyI' && videoRef.current) {
        setInPoint(videoRef.current.currentTime);
        e.stopPropagation();
      }
      if (e.code === 'KeyO' && videoRef.current) {
        setOutPoint(videoRef.current.currentTime);
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const progress = duration > 0 ? currentTime / duration : 0;
  const inRatio = (inPoint !== null && duration > 0) ? inPoint / duration : null;
  const outRatio = (outPoint !== null && duration > 0) ? outPoint / duration : null;

  // Metadata badges
  const isStabilized = asset?.name?.toLowerCase().includes('stable') ||
                       (asset as any)?.stabilized === true;
  const isInterview = asset?.name?.toLowerCase().includes('interview') ||
                      (asset as any)?.assetClass === 'interview';
  const isSoundbite = asset?.name?.toLowerCase().includes('soundbite') ||
                      (asset as any)?.assetClass === 'soundbite';
  const stabilityScore = (asset as any)?.stabilityScore;

  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        background: C.darkBg,
        borderRadius: 14,
        border: `1px solid ${C.darkBorder}`,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 14px',
          borderBottom: `1px solid ${C.darkBorder}`,
          background: C.darkSurface,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: 9,
            color: C.copper,
            textTransform: 'uppercase',
            letterSpacing: 1,
            fontWeight: 700,
          }}
        >
          Source Monitor
        </span>
        {asset && (
          <>
            <span style={{ fontSize: 9, color: C.darkBorder }}>•</span>
            <span
              style={{
                fontSize: 10,
                color: C.darkText,
                fontWeight: 600,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1,
              }}
            >
              {asset.name}
            </span>
            {isStabilized && (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: C.success,
                  background: `${C.success}18`,
                  border: `1px solid ${C.success}40`,
                  borderRadius: 4,
                  padding: '2px 6px',
                  letterSpacing: 0.5,
                  flexShrink: 0,
                }}
              >
                ✦ STABILIZED{stabilityScore ? ` ${stabilityScore}%` : ''}
              </span>
            )}
            {isInterview && !isSoundbite && (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: C.accent,
                  background: `${C.accent}18`,
                  border: `1px solid ${C.accent}40`,
                  borderRadius: 4,
                  padding: '2px 6px',
                  letterSpacing: 0.5,
                  flexShrink: 0,
                }}
              >
                INTERVIEW
              </span>
            )}
            {isSoundbite && (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: C.copper,
                  background: `${C.copper}18`,
                  border: `1px solid ${C.copper}40`,
                  borderRadius: 4,
                  padding: '2px 6px',
                  letterSpacing: 0.5,
                  flexShrink: 0,
                }}
              >
                SOUND BITE
              </span>
            )}
          </>
        )}
        {!asset && (
          <span style={{ fontSize: 10, color: '#3a4a60', fontStyle: 'italic', flex: 1 }}>
            Click a clip in the bin to preview
          </span>
        )}
      </div>

      {/* Video area */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#000',
          position: 'relative',
        }}
      >
        {asset?.type === 'video' && asset.blobKey ? (
          <video
            ref={videoRef}
            src={asset.blobKey}
            style={{ maxWidth: '100%', maxHeight: '100%', display: 'block' }}
            onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime ?? 0)}
            onDurationChange={() => setDuration(videoRef.current?.duration ?? 0)}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => setIsPlaying(false)}
            playsInline
          />
        ) : asset?.type === 'image' && asset.blobKey ? (
          <img
            src={asset.blobKey}
            alt={asset.name}
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }}
          />
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 10,
              color: '#1e3a54',
            }}
          >
            <Icon d={Icons.film} size={32} color="#1e3a54" />
            <span style={{ fontSize: 11, color: '#2a4a6a' }}>No clip selected</span>
          </div>
        )}

        {/* Timecode overlay */}
        {(asset?.type === 'video') && (
          <div
            style={{
              position: 'absolute',
              bottom: 8,
              left: 8,
              fontSize: 11,
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 700,
              color: 'rgba(255,255,255,0.8)',
              background: 'rgba(0,0,0,0.5)',
              borderRadius: 4,
              padding: '2px 6px',
              letterSpacing: 1,
              userSelect: 'none',
            }}
          >
            {formatTimecode(currentTime)}
          </div>
        )}

        {/* In/Out labels */}
        {inPoint !== null && (
          <div
            style={{
              position: 'absolute',
              top: 8,
              left: 8,
              fontSize: 9,
              fontWeight: 700,
              color: C.copper,
              background: `${C.copper}22`,
              border: `1px solid ${C.copper}50`,
              borderRadius: 4,
              padding: '2px 6px',
              letterSpacing: 0.5,
            }}
          >
            IN: {formatTimeShort(inPoint)}
          </div>
        )}
        {outPoint !== null && (
          <div
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              fontSize: 9,
              fontWeight: 700,
              color: C.accent,
              background: `${C.accent}22`,
              border: `1px solid ${C.accent}50`,
              borderRadius: 4,
              padding: '2px 6px',
              letterSpacing: 0.5,
            }}
          >
            OUT: {formatTimeShort(outPoint)}
          </div>
        )}
      </div>

      {/* Controls */}
      {asset?.type === 'video' && (
        <div
          style={{
            flexShrink: 0,
            padding: '10px 14px',
            borderTop: `1px solid ${C.darkBorder}`,
            background: C.darkSurface,
          }}
        >
          {/* Scrubber */}
          <div
            ref={scrubberRef}
            onClick={handleScrubberClick}
            onMouseMove={handleScrubberHover}
            onMouseLeave={() => setHoverTime(null)}
            style={{
              width: '100%',
              height: 6,
              background: '#1e3550',
              borderRadius: 3,
              cursor: 'pointer',
              position: 'relative',
              marginBottom: 10,
              userSelect: 'none',
            }}
          >
            {/* In/Out range highlight */}
            {inRatio !== null && outRatio !== null && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: `${inRatio * 100}%`,
                  width: `${(outRatio - inRatio) * 100}%`,
                  height: '100%',
                  background: `${C.copper}50`,
                  borderRadius: 3,
                }}
              />
            )}
            {/* Progress */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: `${progress * 100}%`,
                height: '100%',
                background: C.accent,
                borderRadius: 3,
                transition: 'width 0.05s linear',
              }}
            />
            {/* Playhead */}
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: `${progress * 100}%`,
                transform: 'translate(-50%, -50%)',
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: '#fff',
                boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
                pointerEvents: 'none',
              }}
            />
            {/* Hover tooltip */}
            {hoverTime !== null && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: `${(hoverTime / duration) * 100}%`,
                  transform: 'translateX(-50%)',
                  marginBottom: 4,
                  background: 'rgba(0,0,0,0.8)',
                  color: '#fff',
                  fontSize: 9,
                  padding: '2px 5px',
                  borderRadius: 3,
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                }}
              >
                {formatTimeShort(hoverTime)}
              </div>
            )}
          </div>

          {/* Buttons row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* In/Out buttons */}
            <button
              onClick={() => setInPoint(currentTime)}
              title="Mark In (I)"
              style={{
                background: inPoint !== null ? `${C.copper}20` : 'rgba(255,255,255,0.04)',
                border: `1px solid ${inPoint !== null ? C.copper + '60' : '#1e3550'}`,
                borderRadius: 5,
                color: inPoint !== null ? C.copper : '#4a6a88',
                fontSize: 10,
                fontWeight: 700,
                padding: '3px 8px',
                cursor: 'pointer',
                letterSpacing: 0.5,
              }}
            >
              I
            </button>

            {/* Play/pause */}
            <button
              onClick={togglePlay}
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: C.accent,
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Icon
                d={isPlaying ? Icons.pause : Icons.play}
                size={14}
                color="#fff"
              />
            </button>

            <button
              onClick={() => setOutPoint(currentTime)}
              title="Mark Out (O)"
              style={{
                background: outPoint !== null ? `${C.accent}20` : 'rgba(255,255,255,0.04)',
                border: `1px solid ${outPoint !== null ? C.accent + '60' : '#1e3550'}`,
                borderRadius: 5,
                color: outPoint !== null ? C.accent : '#4a6a88',
                fontSize: 10,
                fontWeight: 700,
                padding: '3px 8px',
                cursor: 'pointer',
                letterSpacing: 0.5,
              }}
            >
              O
            </button>

            <div style={{ flex: 1 }} />

            {/* Duration */}
            <span
              style={{
                fontSize: 10,
                color: '#4a6a88',
                fontFamily: "'JetBrains Mono', monospace",
                letterSpacing: 0.5,
              }}
            >
              {formatTimeShort(currentTime)} / {formatTimeShort(duration)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
