import { useEffect, useRef, useState, useCallback } from 'react';
import { C } from '../../theme/colors';
import { FONT_FAMILY, FONT_FAMILY_MONO } from '../../theme/tokens';
import { Icons } from '../../theme/icons';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/Button';
import { useCutStore, registerSeekCallback, registerPlayCallback } from '../../store/cutStore';
import { analyzeWaveform, type WaveformData } from '../../services/vadAnalyzer';
import { formatTime } from '../../utils/formatTime';

export function InterviewWaveform() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const [waveform, setWaveform] = useState<WaveformData | null>(null);
  const [loadingWaveform, setLoadingWaveform] = useState(false);

  const audioUrl = useCutStore((s) => s.audioUrl);
  const fileName = useCutStore((s) => s.fileName);
  const currentTime = useCutStore((s) => s.currentTime);
  const isPlaying = useCutStore((s) => s.isPlaying);
  const duration = useCutStore((s) => s.duration);
  const markers = useCutStore((s) => s.markers);
  const selectionSource = useCutStore((s) => s.selectionSource);
  const selectedSoundbiteId = useCutStore((s) => s.selectedSoundbiteId);
  const soundbites = useCutStore((s) => s.soundbites);

  const setCurrentTime = useCutStore((s) => s.setCurrentTime);
  const setIsPlaying = useCutStore((s) => s.setIsPlaying);
  const togglePlayback = useCutStore((s) => s.togglePlayback);
  const setDuration = useCutStore((s) => s.setDuration);
  const setMarkerIn = useCutStore((s) => s.setMarkerIn);
  const setMarkerOut = useCutStore((s) => s.setMarkerOut);
  const clearSelection = useCutStore((s) => s.clearSelection);
  const playSelection = useCutStore((s) => s.playSelection);
  const seekToTime = useCutStore((s) => s.seekToTime);
  const setShowSaveModal = useCutStore((s) => s.setShowSaveModal);
  const markers_in = markers.in;
  const markers_out = markers.out;
  const hasSelection = markers_in !== null && markers_out !== null;
  const activeClip = soundbites.find((clip) => clip.id === selectedSoundbiteId) ?? null;

  // Register seek and play callbacks so cutStore can drive the audio element
  useEffect(() => {
    registerSeekCallback((t) => {
      if (audioRef.current) {
        audioRef.current.currentTime = t;
      }
    });
    registerPlayCallback((v) => {
      if (!audioRef.current) return;
      if (v) {
        audioRef.current.play().catch(() => {});
      } else {
        audioRef.current.pause();
      }
    });
  }, []);

  // Load waveform data when audio URL changes
  useEffect(() => {
    if (!audioUrl) return;

    let cancelled = false;

    void (async () => {
      setWaveform(null);
      setLoadingWaveform(true);
      try {
        const wf = await analyzeWaveform(audioUrl);
        if (!cancelled) setWaveform(wf);
      } catch (error) {
        if (!cancelled) console.warn('Waveform analysis failed:', error);
      } finally {
        if (!cancelled) setLoadingWaveform(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [audioUrl]);

  // Sync audio element play state
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.play().catch(() => setIsPlaying(false));
    } else {
      audio.pause();
    }
  }, [isPlaying, setIsPlaying]);

  // requestAnimationFrame sync for currentTime
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const tick = () => {
      if (!audio.paused) {
        if (hasSelection && markers_out !== null && audio.currentTime >= markers_out) {
          audio.currentTime = markers_out;
          setCurrentTime(markers_out);
          setIsPlaying(false);
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
        setCurrentTime(audio.currentTime);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [hasSelection, markers_out, setCurrentTime, setIsPlaying]);

  // Draw waveform canvas
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const W = rect.width;
    const H = rect.height;
    const midY = H / 2;

    ctx.clearRect(0, 0, W, H);

    // In/out range highlight
    if (markers_in !== null && markers_out !== null && duration > 0) {
      const x1 = (markers_in / duration) * W;
      const x2 = (markers_out / duration) * W;
      ctx.fillStyle = `${C.accent}28`;
      ctx.fillRect(x1, 0, x2 - x1, H);
    }

    // Waveform bars
    if (waveform && waveform.rms.length > 0) {
      const rms = waveform.rms;
      const playheadX = duration > 0 ? (currentTime / duration) * W : 0;

      for (let px = 0; px < W; px++) {
        const dataIdx = Math.floor((px / W) * rms.length);
        const val = Math.min(rms[dataIdx] * 8, 1);
        const barH = Math.max(1, val * midY * 0.85);

        // Color: played = bright, upcoming = dim
        const isPast = px < playheadX;
        ctx.fillStyle = isPast ? C.accent2 : C.border2;
        ctx.fillRect(px, midY - barH, 1, barH * 2);
      }
    } else if (!waveform) {
      // No waveform — draw flat placeholder line
      ctx.fillStyle = C.border2;
      ctx.fillRect(0, midY - 1, W, 2);
    }

    // In marker
    if (markers_in !== null && duration > 0) {
      const x = (markers_in / duration) * W;
      ctx.fillStyle = C.green;
      ctx.fillRect(x - 1, 0, 2, H);
      // Label
      ctx.fillStyle = C.green;
      ctx.font = '9px monospace';
      ctx.fillText('I', x + 3, 12);
    }

    // Out marker
    if (markers_out !== null && duration > 0) {
      const x = (markers_out / duration) * W;
      ctx.fillStyle = C.orange;
      ctx.fillRect(x - 1, 0, 2, H);
      ctx.fillStyle = C.orange;
      ctx.font = '9px monospace';
      ctx.fillText('O', x + 3, 12);
    }

    // Playhead
    if (duration > 0) {
      const px = (currentTime / duration) * W;
      ctx.fillStyle = C.text;
      ctx.fillRect(px - 1, 0, 2, H);
    }
  }, [waveform, currentTime, duration, markers_in, markers_out]);

  // Redraw on every relevant state change
  useEffect(() => {
    drawWaveform();
  }, [drawWaveform]);

  // Re-draw on resize
  useEffect(() => {
    const obs = new ResizeObserver(() => drawWaveform());
    if (canvasRef.current) obs.observe(canvasRef.current);
    return () => obs.disconnect();
  }, [drawWaveform]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const seekTime = ratio * duration;
    if (e.shiftKey) {
      setMarkerIn(seekTime, 'waveform');
      return;
    }
    if (e.altKey) {
      setMarkerOut(seekTime, 'waveform');
      return;
    }
    seekToTime(seekTime);
  };

  const handleMarkIn = () => setMarkerIn(currentTime, 'waveform');
  const handleMarkOut = () => setMarkerOut(currentTime, 'waveform');

  return (
    <section
      style={{
        borderRadius: 22,
        border: `1px solid ${C.border}`,
        background:
          'linear-gradient(180deg, rgba(16, 26, 40, 0.98) 0%, rgba(11, 17, 28, 0.98) 100%)',
        overflow: 'hidden',
        boxShadow: '0 24px 60px rgba(0,0,0,0.18)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          padding: '16px 18px 14px',
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 6,
            }}
          >
            <Icon d={Icons.music} size={13} color={C.accent2} />
            <span
              style={{
                fontSize: 10,
                color: C.accent2,
                fontWeight: 700,
                letterSpacing: 0.8,
                textTransform: 'uppercase',
              }}
            >
              Source Waveform
            </span>
          </div>
          <div
            style={{
              fontSize: 18,
              color: C.text,
              fontWeight: 700,
              marginBottom: 4,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {fileName ?? 'Untitled source'}
          </div>
          <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.6 }}>
            Play, scrub, and mark against the transcript to isolate the cleanest quote.
          </div>
          {(activeClip || hasSelection) && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                flexWrap: 'wrap',
                marginTop: 10,
              }}
            >
              <span
                style={{
                  padding: '6px 10px',
                  borderRadius: 999,
                  border: `1px solid ${C.border}`,
                  background: C.surface2,
                  fontSize: 10,
                  color: C.textDim,
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                  fontWeight: 700,
                }}
              >
                {selectionSource === 'clip'
                  ? 'Clip preview'
                  : selectionSource === 'transcript'
                    ? 'Transcript range'
                    : 'Waveform range'}
              </span>
              {activeClip && (
                <span style={{ fontSize: 11, color: C.text }}>
                  {activeClip.label}
                </span>
              )}
              {hasSelection && (
                <span style={{ fontSize: 11, color: C.textDim }}>
                  Playback stops at Out automatically.
                </span>
              )}
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gap: 8, flexShrink: 0 }}>
          <div
            style={{
              padding: '8px 10px',
              borderRadius: 999,
              border: `1px solid ${C.border}`,
              background: C.surface2,
              fontSize: 11,
              color: C.text,
              fontFamily: FONT_FAMILY_MONO,
            }}
          >
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
          {loadingWaveform && (
            <div style={{ fontSize: 10, color: C.textDim, textAlign: 'right', fontFamily: FONT_FAMILY }}>
              analyzing waveform…
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: '14px 18px 12px' }}>
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          style={{
            width: '100%',
            height: 118,
            display: 'block',
            cursor: 'pointer',
            borderRadius: 16,
            background:
              'linear-gradient(180deg, rgba(7, 12, 20, 0.92) 0%, rgba(10, 17, 30, 0.98) 100%)',
            border: `1px solid ${C.border}`,
          }}
        />
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 18px 16px',
          borderTop: `1px solid ${C.border}`,
          flexWrap: 'wrap',
        }}
      >
        <Button small accent onClick={togglePlayback}>
          <Icon d={isPlaying ? Icons.pause : Icons.play} size={12} />
          {isPlaying ? 'Pause' : hasSelection ? 'Play Source' : 'Play'}
        </Button>

        {hasSelection && (
          <Button small onClick={playSelection}>
            <Icon d={Icons.skipBack} size={12} />
            Play Select
          </Button>
        )}

        <Button small onClick={handleMarkIn} title="Mark In point (I)" style={{ color: C.green }}>
          <Icon d={Icons.scissors} size={12} color={C.green} />
          Mark In
        </Button>
        <Button small onClick={handleMarkOut} title="Mark Out point (O)" style={{ color: C.orange }}>
          <Icon d={Icons.blade} size={12} color={C.orange} />
          Mark Out
        </Button>

        {(markers_in !== null || markers_out !== null) && (
          <span
            style={{
              fontSize: 11,
              color: C.text,
              fontFamily: FONT_FAMILY_MONO,
              background: C.surface2,
              border: `1px solid ${C.border}`,
              borderRadius: 999,
              padding: '6px 10px',
            }}
          >
            {markers_in !== null ? formatTime(markers_in) : '–'}
            {' → '}
            {markers_out !== null ? formatTime(markers_out) : '–'}
          </span>
        )}

        {markers_in !== null && markers_out !== null && (
          <Button small accent onClick={() => setShowSaveModal(true)} title="Save clip (Enter)">
            <Icon d={Icons.plus} size={12} />
            Save Clip
          </Button>
        )}

        {(markers_in !== null || markers_out !== null) && (
          <Button small onClick={clearSelection} title="Clear markers">
            ✕ Clear
          </Button>
        )}

        <div style={{ flex: 1 }} />

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
            fontSize: 10,
            color: C.textMuted,
            fontFamily: FONT_FAMILY,
          }}
        >
          <span><span style={{ color: C.textDim }}>Space</span> play</span>
          <span><span style={{ color: C.green }}>I</span> mark in</span>
          <span><span style={{ color: C.orange }}>O</span> mark out</span>
          <span><span style={{ color: C.accent2 }}>Shift/⌥ click</span> set markers</span>
          <span><span style={{ color: C.accent2 }}>Shift + ←/→</span> jump 10s</span>
        </div>
      </div>

      <audio
        ref={audioRef}
        src={audioUrl ?? undefined}
        onLoadedMetadata={() => {
          if (audioRef.current) setDuration(audioRef.current.duration);
        }}
        onEnded={() => setIsPlaying(false)}
        style={{ display: 'none' }}
      />
    </section>
  );
}
