import { useState, useEffect, type FormEvent } from 'react';
import {
  getSupabaseClient,
  isSupabaseConfigured,
  missingSupabaseEnvVars,
  supabaseConfigError,
} from '../../lib/supabase';

// Inject Fraunces from Google Fonts once
function useFrauncesFont() {
  useEffect(() => {
    if (document.getElementById('fraunces-font')) return;
    const link = document.createElement('link');
    link.id = 'fraunces-font';
    link.rel = 'stylesheet';
    link.href =
      'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..900;1,9..144,300..900&display=swap';
    document.head.appendChild(link);
  }, []);
}

// ─── Brand tokens ────────────────────────────────────────────────────────────
const B = {
  cream:      '#f0ebe0',
  parchment:  '#faf6ef',
  sand:       '#d8cfc0',
  navy:       '#0b1928',
  navyMid:    '#0f2035',
  sapphire:   '#1e4d8c',
  sapphireDim:'#173d70',
  slate:      '#485670',
  periwinkle: '#b3c8f0',
  copper:     '#c4722a',
  text:       '#edf3ff',
  textMuted:  '#7a9bc4',
  border:     '#2b4263',
  borderFocus:'#1e4d8c',
  error:      '#de7676',
};

const SERIF = "'Fraunces', Georgia, serif";
const SANS  = "'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

// ─── Input styling ───────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  border: `1px solid ${B.border}`,
  borderRadius: 8,
  background: 'rgba(255,255,255,0.04)',
  color: B.text,
  padding: '.6rem .75rem',
  fontSize: '.875rem',
  fontFamily: SANS,
  outline: 'none',
  transition: 'border-color 140ms ease, background 140ms ease',
  width: '100%',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  fontSize: '.68rem',
  letterSpacing: '.1em',
  textTransform: 'uppercase',
  color: B.periwinkle,
  fontWeight: 700,
  fontFamily: SANS,
};

// ─── Env-not-configured error screen ─────────────────────────────────────────
function MissingEnvScreen() {
  return (
    <main style={{ minHeight: '100vh', background: B.navy, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', fontFamily: SANS }}>
      <div style={{ maxWidth: 440, width: '100%' }}>
        <div style={{ fontSize: '.72rem', letterSpacing: '.18em', textTransform: 'uppercase', color: B.periwinkle, fontWeight: 700, marginBottom: '1rem' }}>Co-Cut</div>
        <h1 style={{ fontFamily: SERIF, fontSize: '1.6rem', color: B.text, fontWeight: 700, margin: '0 0 .5rem' }}>Environment setup required</h1>
        <p style={{ color: B.textMuted, fontSize: '.84rem', lineHeight: 1.6, margin: '0 0 1.2rem' }}>{supabaseConfigError}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.4rem' }}>
          {missingSupabaseEnvVars.map((name) => (
            <code key={name} style={{ color: B.periwinkle, background: 'rgba(179,200,240,0.08)', border: `1px solid ${B.border}`, borderRadius: 6, padding: '.25rem .55rem', fontSize: '.72rem' }}>
              {name}
            </code>
          ))}
        </div>
      </div>
    </main>
  );
}

// ─── Main login page ──────────────────────────────────────────────────────────
export function LoginPage() {
  useFrauncesFont();

  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  if (!isSupabaseConfigured) return <MissingEnvScreen />;

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const email    = fd.get('email') as string;
    const password = fd.get('password') as string;
    const supabase = getSupabaseClient();
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  const onFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = B.borderFocus;
    e.currentTarget.style.background  = 'rgba(255,255,255,0.07)';
  };
  const onBlur  = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = B.border;
    e.currentTarget.style.background  = 'rgba(255,255,255,0.04)';
  };

  return (
    <>
      {/* Responsive breakpoint styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..900;1,9..144,300..900&display=swap');

        .cocut-login-root {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 1fr 420px;
          font-family: ${SANS};
        }

        .cocut-login-brand {
          background: ${B.cream};
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 2.5rem 3rem;
          position: relative;
          overflow: hidden;
        }

        .cocut-login-form-side {
          background: ${B.navy};
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 2.5rem 2.5rem;
          position: relative;
        }

        .cocut-login-headline {
          font-family: ${SERIF};
          font-size: clamp(2rem, 3.5vw, 3rem);
          font-weight: 700;
          color: ${B.navy};
          line-height: 1.12;
          letter-spacing: -.02em;
          margin: 0 0 1rem;
        }

        .cocut-login-headline em {
          font-style: italic;
          color: ${B.sapphire};
        }

        @media (max-width: 860px) {
          .cocut-login-root {
            grid-template-columns: 1fr;
            grid-template-rows: auto 1fr;
          }
          .cocut-login-brand {
            padding: 2rem 1.75rem 1.5rem;
            min-height: auto;
          }
          .cocut-login-brand-footer {
            display: none !important;
          }
          .cocut-login-form-side {
            padding: 2rem 1.75rem 2.5rem;
            justify-content: flex-start;
          }
          .cocut-login-headline {
            font-size: 1.75rem;
            margin-bottom: .6rem;
          }
        }

        @media (max-width: 480px) {
          .cocut-login-brand {
            padding: 1.5rem 1.25rem 1rem;
          }
          .cocut-login-form-side {
            padding: 1.75rem 1.25rem 2rem;
          }
        }
      `}</style>

      <main className="cocut-login-root">

        {/* ── Left: Brand panel ── */}
        <div className="cocut-login-brand">

          {/* Top nav */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
              {/* Wordmark */}
              <span style={{ fontFamily: SANS, fontSize: '.78rem', fontWeight: 700, color: B.navy, letterSpacing: '.04em' }}>
                Content Co-op
              </span>
              <span style={{ width: 1, height: 14, background: B.sand, display: 'inline-block', margin: '0 .35rem' }} />
              <span style={{ fontFamily: SANS, fontSize: '.72rem', fontWeight: 600, color: B.slate, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                Co-Cut
              </span>
            </div>
            <a
              href="https://contentco-op.com"
              style={{ fontSize: '.72rem', color: B.slate, textDecoration: 'none', letterSpacing: '.04em', fontFamily: SANS }}
            >
              contentco-op.com ↗
            </a>
          </div>

          {/* Central message */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '2rem 0' }}>
            {/* Eyebrow */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '.45rem',
              marginBottom: '1.25rem',
            }}>
              <div style={{ width: 20, height: 2, background: B.copper, borderRadius: 2 }} />
              <span style={{ fontFamily: SANS, fontSize: '.68rem', fontWeight: 700, color: B.copper, letterSpacing: '.16em', textTransform: 'uppercase' }}>
                Editor
              </span>
            </div>

            <h1 className="cocut-login-headline">
              Shape the story<br />
              from transcript<br />
              to <em>select.</em>
            </h1>

            <p style={{ fontFamily: SANS, fontSize: '.9rem', color: B.slate, lineHeight: 1.65, maxWidth: 380, margin: '0 0 2rem' }}>
              Drop an interview. Review the timed transcript. Save the strongest quotes before you cut a single frame.
            </p>

            {/* Trust chips */}
            <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
              {['Local-first · no upload required', 'Cloud sync on demand', 'FFmpeg in-browser export'].map((chip) => (
                <span key={chip} style={{
                  fontFamily: SANS,
                  fontSize: '.7rem',
                  fontWeight: 600,
                  color: B.slate,
                  background: 'transparent',
                  border: `1px solid ${B.sand}`,
                  borderRadius: 999,
                  padding: '.3rem .75rem',
                  letterSpacing: '.02em',
                }}>
                  {chip}
                </span>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="cocut-login-brand-footer" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ height: 1, background: B.sand, flex: 1 }} />
            <span style={{ fontFamily: SANS, fontSize: '.7rem', color: B.sand, whiteSpace: 'nowrap' }}>
              © Content Co-op LLC
            </span>
          </div>
        </div>

        {/* ── Right: Form panel ── */}
        <div className="cocut-login-form-side">
          <div style={{ maxWidth: 340, width: '100%', margin: '0 auto' }}>

            {/* Form header */}
            <div style={{ marginBottom: '1.75rem' }}>
              <div style={{ fontFamily: SANS, fontSize: '.68rem', letterSpacing: '.18em', textTransform: 'uppercase', color: B.periwinkle, fontWeight: 700, marginBottom: '.5rem' }}>
                Sign in
              </div>
              <h2 style={{ fontFamily: SERIF, fontSize: '1.5rem', fontWeight: 700, color: B.text, margin: 0, letterSpacing: '-.02em' }}>
                Open your editor.
              </h2>
            </div>

            {/* Error */}
            {error && (
              <div style={{
                color: B.error, fontSize: '.82rem', marginBottom: '.9rem',
                padding: '.5rem .75rem', borderRadius: 8,
                background: 'rgba(222, 118, 118, 0.08)',
                border: '1px solid rgba(222, 118, 118, 0.2)',
                fontFamily: SANS,
              }}>
                {error}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleLogin} style={{ display: 'grid', gap: '.65rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '.28rem' }}>
                <label style={labelStyle}>Email</label>
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  style={inputStyle}
                  onFocus={onFocus}
                  onBlur={onBlur}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '.28rem' }}>
                <label style={labelStyle}>Password</label>
                <input
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  style={inputStyle}
                  onFocus={onFocus}
                  onBlur={onBlur}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  marginTop: '.5rem',
                  background: loading ? B.sapphireDim : B.sapphire,
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '.7rem 1.6rem',
                  fontSize: '.82rem',
                  fontWeight: 700,
                  fontFamily: SANS,
                  letterSpacing: '.08em',
                  textTransform: 'uppercase',
                  cursor: loading ? 'wait' : 'pointer',
                  transition: 'background 160ms ease, transform 120ms ease, opacity 140ms ease',
                  opacity: loading ? 0.7 : 1,
                  width: '100%',
                }}
                onMouseEnter={(e) => { if (!loading) { e.currentTarget.style.background = '#255fac'; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
                onMouseLeave={(e) => { e.currentTarget.style.background = loading ? B.sapphireDim : B.sapphire; e.currentTarget.style.transform = 'none'; }}
              >
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            {/* Microcopy */}
            <p style={{ marginTop: '1.25rem', fontFamily: SANS, fontSize: '.72rem', color: B.textMuted, lineHeight: 1.6, textAlign: 'center' }}>
              Local drafts stay in this browser. Cloud sync optional.
            </p>

          </div>
        </div>

      </main>
    </>
  );
}
