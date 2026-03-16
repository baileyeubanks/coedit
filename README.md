# CO-CUT by Content Co-op

Browser-based video editor powered by React and FFmpeg.wasm. Edit, trim, overlay, and export — all in the browser with no server-side processing.

## Features

- **Video Upload** — Import video, image, and audio files directly into the browser
- **Timeline Editing** — Multi-track timeline with drag, trim, split, and snap
- **Trim & Cut Controls** — Precision trim handles, blade tool, ripple/roll/slide/slip editing
- **Text Overlay** — Add styled text elements with animation support (13 animation types)
- **Export to MP4** — Render final video in-browser via FFmpeg.wasm (MP4 or WebM)
- **Cloud Storage** — Save and load projects from Supabase
- **Subtitle Editor** — Import/export SRT and VTT, auto-generate from speech
- **AI Assistant** — Layout suggestions and subtitle refinement
- **Keyboard Shortcuts** — Premiere Pro-inspired shortcuts (J/K/L, V/B, etc.)
- **Auth** — Supabase authentication (email/password + Google OAuth)

See [docs/co-cut-auth-data-note.md](/Users/baileyeubanks/Desktop/Projects/contentco-op/cocut/docs/co-cut-auth-data-note.md) for the integrated Co-Cut auth/data/persistence note, and [docs/auth-data-model.md](/Users/baileyeubanks/Desktop/Projects/contentco-op/cocut/docs/auth-data-model.md) for the deeper canonical contract.

## Tech Stack

- React 19 + TypeScript
- Vite 7
- FFmpeg.wasm (in-browser video encoding)
- Zustand + Zundo (state management with undo/redo)
- Supabase (auth + cloud project storage)
- Tailwind CSS
- IndexedDB (local auto-save)

## Getting Started

```bash
git clone https://github.com/baileyeubanks/coedit.git cocut
cd cocut
npm install
cp .env.example .env.local
# Fill in your Supabase credentials in .env.local
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

Use Node `20.19.0+` (or `22.12.0+`) for local builds and deploys.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `VITE_AI_PROXY_URL` | No | Recommended for deployed environments so AI requests go through your proxy instead of exposing provider keys in the client |
| `VITE_GOOGLE_API_KEY` | No | Optional local-only Google Gemini API key for direct browser calls |
| `VITE_ANTHROPIC_API_KEY` | No | Optional local-only Anthropic API key for direct browser calls |
| `VITE_OPENAI_API_KEY` | No | Optional local-only OpenAI API key for timed transcript generation and direct browser calls |

## Auth And Data Model

- Co-Cut is a standalone product. Editor access is gated by a Supabase Auth session.
- Local project state is the first durable layer. Each signed-in user gets a browser-local draft in IndexedDB, including media metadata, transcript state, soundbites, and UI state.
- Cloud sync stores the structured project snapshot in Supabase. Heavy source media does not upload with project sync.
- Loading a cloud project on a different browser can restore transcript and clip state while still requiring local media to be re-imported.

## Supabase Setup

Create a `projects` table for cloud storage:

```sql
create table projects (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null default 'Untitled Project',
  data jsonb not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table projects enable row level security;

create policy "Users manage own projects" on projects
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Space` | Play / Pause |
| `K` | Pause |
| `J` / `L` | Shuttle reverse / forward |
| `Left` / `Right` | Step 1 frame |
| `Shift + Left/Right` | Step 5 frames |
| `Home` / `End` | Go to start / end |
| `V` | Select tool |
| `B` | Blade tool |
| `Q` / `W` | Trim left / right to playhead |
| `Cmd+Z` / `Cmd+Shift+Z` | Undo / Redo |
| `Cmd+S` | Save project |
| `Cmd+A` | Select all |
| `Delete` | Delete selected |
| `Cmd+D` | Duplicate selected |
| `G` | Toggle grid |
| `I` / `O` | Set loop in / out point |
| `+` / `-` | Timeline zoom in / out |

## Deployment

Deploy through the home-hosted Coolify/NAS stack:

```bash
npm run build
# Output in dist/
npm start
# Serves the production build locally on PORT or 4173
```

Use Node `20.19.0+`, keep the same cross-origin isolation headers used in local preview, and inject at least `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` through the deployed app environment.

For deployed environments, prefer `VITE_AI_PROXY_URL` instead of shipping provider API keys in client-side env vars. Local preview and deploy previews should follow the same auth-gated Co-Cut boot path as production.

Note: the external GitHub repo name is still `coedit` today, but the local workspace and product runtime are canonicalized as `cocut` / `Co-Cut`.

**Note:** FFmpeg.wasm requires cross-origin isolation. These headers must stay aligned across Vite dev, Vite preview, and the deployed NAS surface.

See [docs/COCUT_CAPTAIN_AUDIT_2026-03-09.md](/Users/baileyeubanks/Desktop/Projects/contentco-op/cocut/docs/COCUT_CAPTAIN_AUDIT_2026-03-09.md) for the integrated captain convergence note, and [docs/runtime-cleanup.md](/Users/baileyeubanks/Desktop/Projects/contentco-op/cocut/docs/runtime-cleanup.md) for the narrower runtime cleanup history.

## License

MIT
