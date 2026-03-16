import { useState, useCallback, useRef, type DragEvent, type ChangeEvent } from 'react';
import { useUIStore } from '../../store/uiStore';
import { useCutStore } from '../../store/cutStore';
import { showToast } from '../ui/Toast';

// ─── Brand tokens (matches LoginPage) ────────────────────────────────────────
const B = {
  navy:       '#0b1928',
  navyMid:    '#0d1f33',
  navySurface:'#0f2338',
  sapphire:   '#1e4d8c',
  sapphireDim:'#173d70',
  sapphireHov:'#255fac',
  slate:      '#485670',
  periwinkle: '#b3c8f0',
  cream:      '#f0ebe0',
  sand:       '#d8cfc0',
  copper:     '#c4722a',
  text:       '#edf3ff',
  textMuted:  '#7a9bc4',
  border:     '#1e3550',
  error:      '#de7676',
  success:    '#4caf82',
};

const SERIF = "'Fraunces', Georgia, serif";
const SANS  = "'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif";

// ─── Folder tree definition ───────────────────────────────────────────────────
// Using arrays of paths relative to the project root.
const FOLDER_TREE = [
  '01_PROJECT_FILES/PrPro',
  '01_PROJECT_FILES/AE',
  '01_PROJECT_FILES/Other',
  '02_ASSETS/02.1_FOOTAGE/RAW',
  '02_ASSETS/02.1_FOOTAGE/INTERVIEW',
  '02_ASSETS/02.1_FOOTAGE/BROLL',
  '02_ASSETS/02.2_AUDIO/MUSIC',
  '02_ASSETS/02.2_AUDIO/SFX',
  '02_ASSETS/02.2_AUDIO/INTERVIEW_AUDIO',
  '02_ASSETS/02.3_GRAPHICS/LOGOS',
  '02_ASSETS/02.3_GRAPHICS/LT_LOWER_THIRDS',
  '02_ASSETS/02.3_GRAPHICS/OTHER',
  '02_ASSETS/02.4_DOCUMENTS/SCRIPT',
  '02_ASSETS/02.4_DOCUMENTS/STORYBOARD',
  '02_ASSETS/02.5_PHOTOS',
  '03_EXPORTS/ROUGH_CUTS',
  '03_EXPORTS/FINE_CUTS',
  '04_FINALS',
  '05_REFERENCE',
];

// Map file extensions to subfolder paths (relative to project root)
function getDestinationPath(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const videoRaw    = ['mov', 'mp4', 'mxf', 'r3d', 'braw', 'ari', 'mts', 'm2t', 'mkv', 'avi', 'webm'];
  const audioFiles  = ['mp3', 'wav', 'aif', 'aiff', 'm4a', 'flac', 'ogg', 'opus'];
  const graphicFiles= ['ai', 'svg', 'eps', 'psd'];
  const photoFiles  = ['jpg', 'jpeg', 'png', 'tif', 'tiff', 'heic', 'webp'];
  const docFiles    = ['pdf', 'docx', 'doc', 'txt', 'rtf', 'pages'];

  if (videoRaw.includes(ext))   return '02_ASSETS/02.1_FOOTAGE/RAW';
  if (audioFiles.includes(ext)) return '02_ASSETS/02.2_AUDIO/MUSIC';
  if (graphicFiles.includes(ext)) return '02_ASSETS/02.3_GRAPHICS/OTHER';
  if (photoFiles.includes(ext)) return '02_ASSETS/02.5_PHOTOS';
  if (docFiles.includes(ext))   return '02_ASSETS/02.4_DOCUMENTS/SCRIPT';
  return '05_REFERENCE';
}

// Traverse into a nested directory handle by path segments
async function getNestedDir(
  root: FileSystemDirectoryHandle,
  segments: string[],
): Promise<FileSystemDirectoryHandle> {
  let current = root;
  for (const seg of segments) {
    current = await current.getDirectoryHandle(seg, { create: true });
  }
  return current;
}

// Write a File object into the correct destination folder
async function writeFileToDir(
  projectRoot: FileSystemDirectoryHandle,
  file: File,
): Promise<void> {
  const destPath = getDestinationPath(file.name);
  const segments = destPath.split('/');
  const dir = await getNestedDir(projectRoot, segments);
  const fileHandle = await dir.getFileHandle(file.name, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(file);
  await writable.close();
}

// Scaffold the entire folder tree
async function scaffoldFolders(projectRoot: FileSystemDirectoryHandle): Promise<void> {
  for (const path of FOLDER_TREE) {
    const segments = path.split('/');
    await getNestedDir(projectRoot, segments);
  }
}

// Build final project folder name: YYYY.MM.DD_PROJECT_NAME
function buildFolderName(name: string): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const safeName = name.trim().toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_.()-]/g, '');
  return `${y}.${m}.${d}_${safeName}`;
}

// ─── Sub-screens ──────────────────────────────────────────────────────────────
type Screen = 'choose' | 'new';
type Status = 'idle' | 'creating' | 'done' | 'error';

export function NewProjectScreen() {
  const [screen, setScreen] = useState<Screen>('choose');
  const [projectName, setProjectName] = useState('');
  const [droppedFiles, setDroppedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [folderName, setFolderName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);



  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) setDroppedFiles((prev) => [...prev, ...files]);
  }, []);

  const handleFileInput = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length) setDroppedFiles((prev) => [...prev, ...files]);
  }, []);

  const removeFile = (idx: number) => {
    setDroppedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  async function handleNext() {
    if (!projectName.trim()) return;
    setStatus('creating');
    setErrorMsg('');

    try {
      // Ask user to pick a parent directory (their Desktop or wherever)
      const parentDir = await window.showDirectoryPicker({ mode: 'readwrite' });

      // Create the project root folder
      const name = buildFolderName(projectName);
      setFolderName(name);
      const projectRoot = await parentDir.getDirectoryHandle(name, { create: true });

      // Scaffold the entire folder tree
      await scaffoldFolders(projectRoot);

      // Copy any dropped files to appropriate destinations
      for (const file of droppedFiles) {
        await writeFileToDir(projectRoot, file);
      }

      // Persist project name into cut store
      useCutStore.setState({ fileName: projectName.trim() });

      setStatus('done');
      // Auto-launch editor after a brief success display
      setTimeout(() => {
        useUIStore.getState().setAppMode('edit');
        showToast(`Project "${buildFolderName(projectName)}" created — editor ready.`, 'success');
      }, 1200);
    } catch (err: unknown) {
      // User cancelled the picker or a write failed
      if (err instanceof Error && err.name === 'AbortError') {
        setStatus('idle');
      } else {
        setErrorMsg(err instanceof Error ? err.message : 'Folder creation failed.');
        setStatus('error');
      }
    }
  }

  function enterEditor() {
    useUIStore.getState().setAppMode('edit');
  }

  return (
    <div style={{
      width: '100%', height: '100vh', background: B.navy,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: SANS, overflow: 'auto', padding: '2rem',
    }}>
      <style>{`
        .np-card-btn {
          background: ${B.navySurface};
          border: 1px solid ${B.border};
          border-radius: 14px;
          color: ${B.text};
          cursor: pointer;
          padding: 2rem 1.75rem;
          text-align: left;
          transition: border-color 150ms ease, background 150ms ease, transform 120ms ease;
          flex: 1;
          font-family: ${SANS};
        }
        .np-card-btn:hover {
          border-color: ${B.sapphire};
          background: #0f2540;
          transform: translateY(-2px);
        }
        .np-input {
          background: rgba(255,255,255,0.04);
          border: 1px solid ${B.border};
          border-radius: 8px;
          color: ${B.text};
          font-family: ${SANS};
          font-size: 1.05rem;
          font-weight: 500;
          outline: none;
          padding: .75rem 1rem;
          transition: border-color 150ms ease, background 150ms ease;
          width: 100%;
          box-sizing: border-box;
        }
        .np-input:focus {
          border-color: ${B.sapphire};
          background: rgba(255,255,255,0.07);
        }
        .np-submit-btn {
          background: ${B.sapphire};
          border: none;
          border-radius: 8px;
          color: #fff;
          cursor: pointer;
          font-family: ${SANS};
          font-size: .82rem;
          font-weight: 700;
          letter-spacing: .08em;
          padding: .75rem 1.5rem;
          text-transform: uppercase;
          transition: background 150ms ease, transform 120ms ease, opacity 150ms ease;
          width: 100%;
        }
        .np-submit-btn:hover:not(:disabled) {
          background: ${B.sapphireHov};
          transform: translateY(-1px);
        }
        .np-submit-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
        .np-file-chip {
          display: flex;
          align-items: center;
          gap: .4rem;
          background: rgba(179,200,240,0.08);
          border: 1px solid ${B.border};
          border-radius: 6px;
          padding: .3rem .6rem;
          font-size: .72rem;
          color: ${B.periwinkle};
        }
        .np-file-chip button {
          background: none;
          border: none;
          color: ${B.textMuted};
          cursor: pointer;
          font-size: .9rem;
          line-height: 1;
          padding: 0;
        }
        .np-file-chip button:hover { color: ${B.error}; }
      `}</style>

      {screen === 'choose' && (
        <div style={{ width: '100%', maxWidth: 560 }}>
          {/* Wordmark */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '2.5rem' }}>
            <span style={{ fontSize: '.72rem', fontWeight: 700, color: B.periwinkle, letterSpacing: '.18em', textTransform: 'uppercase' }}>Co-Cut</span>
            <span style={{ width: 1, height: 12, background: B.border, display: 'inline-block', margin: '0 .25rem' }} />
            <span style={{ fontSize: '.7rem', color: B.textMuted, letterSpacing: '.06em' }}>Content Co-op</span>
          </div>

          <h1 style={{ fontFamily: SERIF, fontSize: '2rem', fontWeight: 700, color: B.text, margin: '0 0 .5rem', letterSpacing: '-.02em' }}>
            What are we making?
          </h1>
          <p style={{ fontSize: '.85rem', color: B.textMuted, margin: '0 0 2rem', lineHeight: 1.6 }}>
            Start a new project or pick up where you left off.
          </p>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button className="np-card-btn" onClick={() => setScreen('new')}>
              <div style={{ fontSize: '1.25rem', marginBottom: '.6rem' }}>＋</div>
              <div style={{ fontFamily: SERIF, fontSize: '1.1rem', fontWeight: 700, color: B.text, marginBottom: '.3rem' }}>New Project</div>
              <div style={{ fontSize: '.78rem', color: B.textMuted, lineHeight: 1.5 }}>Name it, drop your files,<br />scaffold the folder structure.</div>
            </button>

            <button
              className="np-card-btn"
              onClick={() => {
                useUIStore.getState().setAppMode('cut');
                useUIStore.getState().setShowNewProjectDialog(false);
              }}
            >
              <div style={{ fontSize: '1.25rem', marginBottom: '.6rem' }}>↗</div>
              <div style={{ fontFamily: SERIF, fontSize: '1.1rem', fontWeight: 700, color: B.text, marginBottom: '.3rem' }}>Open Editor</div>
              <div style={{ fontSize: '.78rem', color: B.textMuted, lineHeight: 1.5 }}>Jump straight in or continue<br />an existing session.</div>
            </button>
          </div>
        </div>
      )}

      {screen === 'new' && status !== 'done' && (
        <div style={{ width: '100%', maxWidth: 500 }}>
          {/* Back */}
          <button
            onClick={() => { setScreen('choose'); setStatus('idle'); setErrorMsg(''); }}
            style={{ background: 'none', border: 'none', color: B.textMuted, cursor: 'pointer', fontFamily: SANS, fontSize: '.8rem', padding: '0 0 1.75rem', display: 'flex', alignItems: 'center', gap: '.35rem' }}
          >
            ← Back
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '1.75rem' }}>
            <span style={{ fontSize: '.72rem', fontWeight: 700, color: B.periwinkle, letterSpacing: '.18em', textTransform: 'uppercase' }}>Co-Cut</span>
          </div>

          <h1 style={{ fontFamily: SERIF, fontSize: '1.75rem', fontWeight: 700, color: B.text, margin: '0 0 .4rem', letterSpacing: '-.02em' }}>
            New Project
          </h1>
          <p style={{ fontSize: '.82rem', color: B.textMuted, margin: '0 0 1.75rem', lineHeight: 1.6 }}>
            Name your project. Drop source files if you have them — we'll sort them into the right folders automatically.
          </p>

          {/* Project name */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '.68rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: B.periwinkle, marginBottom: '.35rem' }}>
              Project Name *
            </label>
            <input
              className="np-input"
              type="text"
              autoFocus
              placeholder="e.g. Chevron Field Shoot"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && projectName.trim()) void handleNext(); }}
            />
            {projectName.trim() && (
              <div style={{ fontSize: '.7rem', color: B.textMuted, marginTop: '.35rem', fontFamily: SANS }}>
                Folder: <span style={{ color: B.periwinkle }}>{buildFolderName(projectName)}</span>
              </div>
            )}
          </div>

          {/* File drop zone */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '.68rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: B.periwinkle, marginBottom: '.35rem' }}>
              Source Files <span style={{ color: B.slate, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>— optional</span>
            </label>
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `1.5px dashed ${isDragging ? B.sapphire : B.border}`,
                borderRadius: 10,
                background: isDragging ? 'rgba(30,77,140,0.1)' : 'rgba(255,255,255,0.02)',
                padding: '1.5rem 1rem',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'border-color 150ms ease, background 150ms ease',
              }}
            >
              <div style={{ fontSize: '1.4rem', marginBottom: '.4rem', color: B.textMuted }}>⬆</div>
              <div style={{ fontSize: '.8rem', color: B.textMuted, lineHeight: 1.6 }}>
                Drop footage, audio, docs here<br />
                <span style={{ color: B.periwinkle, fontWeight: 600 }}>or click to browse</span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                style={{ display: 'none' }}
                onChange={handleFileInput}
              />
            </div>

            {droppedFiles.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.4rem', marginTop: '.65rem' }}>
                {droppedFiles.map((f, i) => (
                  <div key={i} className="np-file-chip">
                    <span>{f.name}</span>
                    <button onClick={() => removeFile(i)}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Error */}
          {status === 'error' && (
            <div style={{
              color: B.error, fontSize: '.8rem', marginBottom: '1rem',
              padding: '.5rem .75rem', borderRadius: 8,
              background: 'rgba(222,118,118,0.08)', border: '1px solid rgba(222,118,118,0.2)',
            }}>
              {errorMsg}
            </div>
          )}

          {/* CTA */}
          <button
            className="np-submit-btn"
            disabled={!projectName.trim() || status === 'creating'}
            onClick={() => void handleNext()}
          >
            {status === 'creating' ? 'Creating folders…' : 'Next — Choose Destination →'}
          </button>

          <p style={{ marginTop: '.85rem', fontSize: '.7rem', color: B.slate, textAlign: 'center', lineHeight: 1.6 }}>
            You'll be asked to pick a folder — point it at your Desktop to create the project there.
          </p>
        </div>
      )}

      {screen === 'new' && status === 'done' && (
        <div style={{ width: '100%', maxWidth: 460, textAlign: 'center' }}>
          {/* Success checkmark */}
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: `rgba(76,175,130,0.1)`,
            border: `1.5px solid ${B.success}44`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1.5rem',
            fontSize: '1.6rem', color: B.success,
          }}>✓</div>

          <h1 style={{ fontFamily: SERIF, fontSize: '1.6rem', fontWeight: 700, color: B.text, margin: '0 0 .5rem', letterSpacing: '-.02em' }}>
            Project ready.
          </h1>
          <p style={{ fontSize: '.84rem', color: B.textMuted, margin: '0 0 .5rem', lineHeight: 1.6 }}>
            <span style={{ color: B.periwinkle, fontWeight: 600 }}>{folderName}</span>
          </p>
          <p style={{ fontSize: '.82rem', color: B.textMuted, margin: '0 0 2rem', lineHeight: 1.6 }}>
            Folder structure created.
            {droppedFiles.length > 0 && ` ${droppedFiles.length} file${droppedFiles.length !== 1 ? 's' : ''} sorted into place.`}
          </p>

          {/* Folder tree preview */}
          <div style={{
            background: B.navySurface, border: `1px solid ${B.border}`,
            borderRadius: 10, padding: '1rem 1.25rem', marginBottom: '1.75rem',
            textAlign: 'left', fontFamily: "'JetBrains Mono', monospace", fontSize: '.68rem',
            color: B.textMuted, lineHeight: 1.8, maxHeight: 180, overflowY: 'auto',
          }}>
            <div style={{ color: B.periwinkle, marginBottom: '.2rem' }}>{folderName}/</div>
            {['01_PROJECT_FILES/', '02_ASSETS/', '03_EXPORTS/', '04_FINALS/', '05_REFERENCE/'].map(f => (
              <div key={f} style={{ paddingLeft: '1rem' }}>└─ {f}</div>
            ))}
          </div>

          <button className="np-submit-btn" onClick={enterEditor}>
            Open Editor →
          </button>
        </div>
      )}
    </div>
  );
}
