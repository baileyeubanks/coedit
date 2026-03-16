import { useRef, useState } from 'react';
import { C } from '../../theme/colors';
import { FONT_FAMILY_BRAND } from '../../theme/tokens';
import { Icons } from '../../theme/icons';
import { Icon } from '../ui/Icon';
import { useCutStore } from '../../store/cutStore';
import { usePersistenceStore } from '../../store/persistenceStore';
import { runtimeConfig } from '../../config/runtime';
import { useCutSourceWorkflow } from '../../hooks/useCutSourceWorkflow';
import { CUT_SOURCE_ACCEPT_ATTRIBUTE } from '../../utils/localMedia';

export function UploadZone() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const projectName = usePersistenceStore((s) => s.projectName);
  const sourceError = useCutStore((s) => s.sourceError);
  const transcribing = useCutStore((s) => s.transcribing);
  const transcribeProgress = useCutStore((s) => s.transcribeProgress);
  const transcribePhase = useCutStore((s) => s.transcribePhase);
  const { ingestSourceFile } = useCutSourceWorkflow();

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void ingestSourceFile(file, { mode: 'new' });
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const onDragLeave = () => setDragging(false);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void ingestSourceFile(file, { mode: 'new' });
    }
    e.target.value = '';
  };

  const steps = [
    {
      title: 'Ingest the interview',
      body: 'Drop a local audio or video source into Co-Cut so the session has a primary timeline anchor.',
    },
    {
      title: 'Review timed transcript',
      body: 'Co-Cut turns speech into clickable words so you can hunt for the strongest line instead of scrubbing blind.',
    },
    {
      title: 'Save clean selects',
      body: 'Mark the exact quote, save it to the clip bin, and move the best moments downstream into assembly.',
    },
  ];

  return (
    <section
      className="cocut-upload-shell"
      style={{
        flex: 1,
        minHeight: 0,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: 14,
      }}
    >
      <div
        style={{
          borderRadius: 14,
          border: `1px solid ${C.border}`,
          background: C.surface,
          padding: '28px 28px 24px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}
      >
        <div>
          <div
            style={{
              fontSize: 10,
              color: C.copper,
              fontWeight: 700,
              letterSpacing: 0.9,
              textTransform: 'uppercase',
              marginBottom: 12,
            }}
          >
            Co-Cut Editor
          </div>
          <div
            style={{
              fontFamily: FONT_FAMILY_BRAND,
              fontSize: 48,
              lineHeight: 0.95,
              color: C.text,
              marginBottom: 16,
              maxWidth: 520,
            }}
          >
            Shape the story from transcript to select.
          </div>
          <div style={{ fontSize: 15, color: C.textDim, lineHeight: 1.8, maxWidth: 560 }}>
            {projectName} is ready for source media. Attach one local interview file to this project, turn speech into a structured transcript, then save the strongest quotes before you move into assembly.
          </div>
        </div>

        <div style={{ display: 'grid', gap: 10, marginTop: 28 }}>
          {steps.map((step, index) => (
            <div
              key={step.title}
              style={{
                display: 'grid',
                gridTemplateColumns: '40px minmax(0, 1fr)',
                gap: 12,
                padding: '14px 16px',
                borderRadius: 14,
                border: `1px solid ${C.border}`,
                background: C.bg,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 14,
                  background: `${C.accent}14`,
                  border: `1px solid ${C.accent}22`,
                  color: C.accent,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                  fontWeight: 700,
                }}
              >
                {index + 1}
              </div>
              <div>
                <div style={{ fontSize: 14, color: C.text, fontWeight: 700, marginBottom: 4 }}>
                  {step.title}
                </div>
                <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.7 }}>
                  {step.body}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => !transcribing && fileInputRef.current?.click()}
        style={{
          position: 'relative',
          borderRadius: 14,
          border: `1px solid ${dragging ? `${C.accent}66` : C.border}`,
          background: dragging ? `${C.accent}08` : C.surface,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 18,
          padding: '28px 30px',
          cursor: transcribing ? 'default' : 'pointer',
          transition: 'all 0.15s ease',
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}
      >
        {transcribing && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(250, 246, 239, 0.92)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 14,
              zIndex: 1,
              padding: 24,
            }}
          >
            <div
              style={{
                fontFamily: FONT_FAMILY_BRAND,
                fontSize: 22,
                color: C.text,
              }}
            >
              Building your transcript
            </div>
            <div style={{ fontSize: 12, color: C.textDim }}>
              {transcribePhase || 'Processing source'}
            </div>
            <div
              style={{
                width: 260,
                height: 4,
                background: C.surface3,
                borderRadius: 999,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${transcribeProgress}%`,
                  background: `linear-gradient(90deg, ${C.accent}, ${C.accent2})`,
                  borderRadius: 999,
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>
        )}

        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 14,
            background: `${C.accent}10`,
            border: `1px solid ${C.accent}18`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon d={Icons.upload} size={30} color={C.accent} />
        </div>

        <div style={{ textAlign: 'center', maxWidth: 420 }}>
          <div
            style={{
              fontFamily: FONT_FAMILY_BRAND,
              fontSize: 30,
              lineHeight: 1,
              color: C.text,
              marginBottom: 10,
            }}
          >
            Drop source media here
          </div>
          <div style={{ fontSize: 13, color: C.textDim, lineHeight: 1.8 }}>
            Audio or video. MP3, MP4, M4A, WAV, WEBM, OGG, or MOV. Co-Cut binds this local file to the current draft and keeps the heavy source on this browser.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          {['audio or video', 'local-only source', 'transcript-ready'].map((tag) => (
            <span
              key={tag}
              style={{
                padding: '6px 10px',
                borderRadius: 999,
                border: `1px solid ${C.border}`,
                background: C.surface2,
                fontSize: 10,
                color: C.textDim,
                textTransform: 'uppercase',
                letterSpacing: 0.7,
                fontWeight: 700,
              }}
            >
              {tag}
            </span>
          ))}
        </div>

        <div style={{ fontSize: 11, color: C.accent, fontWeight: 600, letterSpacing: 0.3 }}>
          Click to browse or drag a file into the session
        </div>

        {sourceError && (
          <div
            style={{
              marginTop: 6,
              padding: '10px 14px',
              background: `${C.error}16`,
              border: `1px solid ${C.error}33`,
              borderRadius: 12,
              fontSize: 11,
              color: C.error,
              maxWidth: 420,
              textAlign: 'center',
            }}
          >
            {sourceError}
          </div>
        )}

        {!runtimeConfig.aiApiKeys.openai && (
          <div
            style={{
              marginTop: 6,
              fontSize: 11,
              color: C.textMuted,
              textAlign: 'center',
              lineHeight: 1.7,
              maxWidth: 420,
            }}
          >
            Add <code style={{ color: C.accent2 }}>VITE_OPENAI_API_KEY</code> to <code style={{ color: C.textDim }}>.env.local</code> to enable timed transcription in this browser.
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept={CUT_SOURCE_ACCEPT_ATTRIBUTE}
          style={{ display: 'none' }}
          onChange={onFileChange}
        />
      </div>
    </section>
  );
}
