/**
 * NASBackupDialog — Appears on first export to 04_FINALS.
 * Simulates the NAS backup workflow from the AI pipeline spec.
 */
import { useState, useCallback } from 'react';
import { C } from '../../theme/colors';
import { showToast } from '../ui/Toast';

interface NASBackupDialogProps {
  open: boolean;
  onClose: () => void;
  projectName?: string;
}

type BackupStep = 'idle' | 'connecting' | 'verifying' | 'transferring' | 'done' | 'error';

function ProgressBar({ percent, color }: { percent: number; color: string }) {
  return (
    <div
      style={{
        width: '100%',
        height: 6,
        background: C.surface3,
        borderRadius: 3,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${percent}%`,
          height: '100%',
          background: color,
          borderRadius: 3,
          transition: 'width 0.4s ease',
        }}
      />
    </div>
  );
}

const STEP_LABELS: Record<BackupStep, string> = {
  idle: 'Ready to back up',
  connecting: 'Connecting to NAS…',
  verifying: 'Verifying available space…',
  transferring: 'Transferring to NAS…',
  done: 'Backup complete ✓',
  error: 'NAS unreachable',
};

const STEP_COLORS: Record<BackupStep, string> = {
  idle: C.accent,
  connecting: C.copper,
  verifying: C.copper,
  transferring: C.accent,
  done: C.success,
  error: C.error,
};

const STEP_PERCENTS: Record<BackupStep, number> = {
  idle: 0,
  connecting: 20,
  verifying: 40,
  transferring: 75,
  done: 100,
  error: 0,
};

export function NASBackupDialog({ open, onClose, projectName }: NASBackupDialogProps) {
  const [step, setStep] = useState<BackupStep>('idle');
  const [nasMountPath, setNasMountPath] = useState('/Volumes/ContentCoopNAS');
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const runBackup = useCallback(async () => {
    setStep('connecting');
    await new Promise((r) => setTimeout(r, 900));
    setStep('verifying');
    await new Promise((r) => setTimeout(r, 700));
    setStep('transferring');
    await new Promise((r) => setTimeout(r, 1800));
    setStep('done');
    showToast(`04_FINALS exported and backed up to NAS.`, 'success');
  }, []);

  const handleClose = () => {
    if (dontShowAgain) {
      localStorage.setItem('cocut_nas_skip', 'true');
    }
    setStep('idle');
    onClose();
  };

  if (!open) return null;

  const isRunning = step === 'connecting' || step === 'verifying' || step === 'transferring';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 5000,
        background: 'rgba(11,25,40,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(4px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget && !isRunning) handleClose(); }}
    >
      <div
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 16,
          boxShadow: '0 24px 60px rgba(0,0,0,0.18)',
          width: '100%',
          maxWidth: 440,
          margin: '0 16px',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 20px 14px',
            borderBottom: `1px solid ${C.border}`,
            background: C.bg,
          }}
        >
          <div style={{ fontSize: 9, color: C.copper, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, marginBottom: 5 }}>
            Phase 5 — NAS Backup
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, color: C.text }}>
            Back up to NAS Storage
          </div>
          <p style={{ fontSize: 12, color: C.textDim, margin: '6px 0 0', lineHeight: 1.6 }}>
            You're exporting to <strong style={{ color: C.text }}>04_FINALS</strong> for the first time this session.
            Would you like to automatically back up to your NAS?
          </p>
        </div>

        {/* Body */}
        <div style={{ padding: '18px 20px' }}>
          {step === 'idle' && (
            <>
              <div style={{ marginBottom: 16 }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: 0.8,
                    textTransform: 'uppercase',
                    color: C.textDim,
                    marginBottom: 6,
                  }}
                >
                  NAS Mount Path
                </label>
                <input
                  value={nasMountPath}
                  onChange={(e) => setNasMountPath(e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    background: C.surface2,
                    border: `1px solid ${C.border}`,
                    borderRadius: 8,
                    color: C.text,
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 11,
                    padding: '8px 12px',
                    outline: 'none',
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = C.border2; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = C.border; }}
                />
                <div style={{ fontSize: 10, color: C.textMuted, marginTop: 5, lineHeight: 1.5 }}>
                  Make sure your NAS is mounted at this path before starting. Check in Finder → Go → Connect to Server.
                </div>
              </div>

              {/* Info boxes */}
              <div
                style={{
                  background: `${C.accent}08`,
                  border: `1px solid ${C.accent}25`,
                  borderRadius: 10,
                  padding: '10px 12px',
                  marginBottom: 16,
                  fontSize: 11,
                  color: C.textDim,
                  lineHeight: 1.6,
                }}
              >
                <strong style={{ color: C.text }}>Backup target:</strong><br />
                <code style={{ fontSize: 10, color: C.accent }}>
                  {nasMountPath}/{projectName ?? 'PROJECT'}/04_FINALS/
                </code>
              </div>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 11,
                  color: C.textDim,
                  cursor: 'pointer',
                  marginBottom: 4,
                }}
              >
                <input
                  type="checkbox"
                  checked={dontShowAgain}
                  onChange={(e) => setDontShowAgain(e.target.checked)}
                />
                Don't show this dialog again this session
              </label>
            </>
          )}

          {/* Progress state */}
          {step !== 'idle' && step !== 'done' && step !== 'error' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 12, color: C.textDim }}>{STEP_LABELS[step]}</div>
              <ProgressBar percent={STEP_PERCENTS[step]} color={STEP_COLORS[step]} />
              <div style={{ fontSize: 10, color: C.textMuted }}>
                {projectName ?? 'Project'} → {nasMountPath}/04_FINALS/
              </div>
            </div>
          )}

          {step === 'done' && (
            <div
              style={{
                background: `${C.success}10`,
                border: `1px solid ${C.success}30`,
                borderRadius: 10,
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 700, color: C.success }}>✓ Backup complete</div>
              <div style={{ fontSize: 11, color: C.textDim, lineHeight: 1.6 }}>
                Finals backed up to:{' '}
                <code style={{ fontSize: 10 }}>{nasMountPath}/04_FINALS/</code>
              </div>
            </div>
          )}

          {step === 'error' && (
            <div
              style={{
                background: `${C.error}10`,
                border: `1px solid ${C.error}30`,
                borderRadius: 10,
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: C.error }}>✕ NAS unreachable</div>
              <div style={{ fontSize: 11, color: C.textDim, lineHeight: 1.5 }}>
                Could not reach <code>{nasMountPath}</code>. Verify the NAS is mounted in Finder and try again.
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: `1px solid ${C.border}`,
            display: 'flex',
            gap: 8,
            justifyContent: 'flex-end',
          }}
        >
          {(step === 'idle' || step === 'error') && (
            <button
              onClick={handleClose}
              style={{
                background: 'none',
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                color: C.textDim,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
                padding: '8px 16px',
              }}
            >
              Skip
            </button>
          )}

          {step === 'idle' && (
            <button
              onClick={() => void runBackup()}
              style={{
                background: C.accent,
                border: 'none',
                borderRadius: 8,
                color: '#fff',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 700,
                padding: '8px 20px',
                letterSpacing: 0.5,
              }}
            >
              Start Backup →
            </button>
          )}

          {isRunning && (
            <button
              disabled
              style={{
                background: C.accent,
                border: 'none',
                borderRadius: 8,
                color: '#fff',
                cursor: 'wait',
                fontSize: 12,
                fontWeight: 700,
                padding: '8px 20px',
                opacity: 0.7,
              }}
            >
              Backing up…
            </button>
          )}

          {(step === 'done' || step === 'error') && (
            <button
              onClick={handleClose}
              style={{
                background: step === 'done' ? C.success : C.surface2,
                border: `1px solid ${step === 'done' ? C.success : C.border}`,
                borderRadius: 8,
                color: step === 'done' ? '#fff' : C.text,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 700,
                padding: '8px 20px',
              }}
            >
              {step === 'done' ? '✓ Done' : 'Close'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
