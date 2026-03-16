# Co-Cut Auth And Data Model

## Product Boundary

Co-Cut is a standalone editing product. Its editor runtime and persistence authority live inside this app.

- Supabase is the durable structured backend for identity and cloud project records.
- The browser is the durable local runtime for drafts, source-media blobs, transcript sessions, and assembly state.
- ROOT, BLAZE, and other sibling systems are not product auth or data authorities for the editor runtime.

## Identity Model

Co-Cut uses Supabase Auth as its product identity layer.

- A signed-in Supabase user gates access to the editor UI.
- Email/password and Google OAuth both resolve to the same Co-Cut user identity.
- Session persistence is handled by the Supabase browser client with persisted sessions and PKCE OAuth flow.
- Co-Cut may share an auth provider with sibling products, but it does not depend on their runtime state.

## Canonical Persistence Model

### Local-first draft

Every signed-in user gets their own active local draft on a given browser.

- Local save is the first durable write.
- Autosave tracks meaningful changes across edit, media, UI, and cut-session state.
- The local snapshot is the authoritative working copy during editing.
- Local draft selection is scoped by authenticated user id, not shared globally across everyone who signs into the same browser.
- Manual JSON export/import is a portable backup path, not the primary working store.

### Cloud-backed project

Cloud sync stores the structured project snapshot in Supabase.

- Cloud projects belong to the signed-in user via `projects.user_id`.
- Cloud sync stores project structure, UI state, transcript state, clip/soundbite state, and sync metadata.
- Cloud sync does not upload heavy source media blobs.
- Because source media stays local, a cloud-loaded project may restore transcript and selects while still requiring media relink on a new browser.

## Scope Rules

### User scope

Belongs to the signed-in user:

- Supabase auth identity
- Cloud project ownership
- Access to that user’s cloud project list

### Project scope

Belongs to the project snapshot:

- Project id, name, created/updated timestamps
- Assembly elements, tracks, duration, current playhead
- Canvas and UI workflow state
- Media metadata for imported assets
- Cut-session file name, transcript, markers, and saved clips
- Cloud sync metadata for the currently bound cloud project

### Browser-local-only scope

Stays on the current browser unless explicitly exported:

- Source media blobs
- Cut-session audio blob
- Blob URLs derived from local media
- The active autosaved local draft cache
- Blob storage is scoped to the active local draft instead of shared browser-global asset ids

## Transcript And Clip Persistence

Transcript work is part of the project contract, not throwaway UI state.

- The transcript result persists in the cut-session snapshot.
- In/out markers persist.
- Saved clips/soundbites persist with label, time range, and excerpt text.
- Cloud sync includes transcript and clip state.
- Missing media does not erase transcript or saved clip state.

## Media Contract

Media is split between metadata and heavy content.

- Metadata persists with the project: file name, type, mime, dimensions, duration, thumbnail, and whether a local source existed.
- Heavy content persists only in local IndexedDB blobs.
- When a snapshot restores without its local blob, the asset is marked missing instead of silently disappearing.
- Missing-source state survives later saves until the local source is restored or replaced.

## Before Sign-in Vs After Sign-in

Before sign-in:

- The editor UI is gated.
- Existing local draft data may still exist in the browser cache.
- No cloud project operations are available.

After sign-in:

- The editor opens on the current local draft.
- The user can save, sync, load, and delete cloud projects they own.
- Loading a cloud project can replace the local draft, with an explicit warning when that would discard unsynced local work.

## Legacy Compatibility

Co-Cut still carries compatibility reads for a few Co-Edit-era names during the rename transition.

- Legacy local draft DB names can be read and migrated forward.
- Legacy onboarding keys can still be recognized.
- Legacy drag MIME types can still be read during the transition.

New writes should use Co-Cut names and contracts.

## Follow-up Issues

### Save + sync

- Cloud sync is snapshot-based, but there is still no media relink workflow beyond missing-source indicators.
- Conflict handling exists for cloud overwrite/load, but there is no diff or merge UI.

### Media ingest

- Imported media is browser-local only.
- There is no checksum-based relink, dedupe, or source provenance tracking yet.

### Transcript + clips

- Automatic transcription still depends on a browser-side OpenAI API key unless a proxy path is added.
- Transcript versioning and clip provenance are not yet separated from the main project snapshot.

### Deploy/runtime

- Supabase env vars are required for product auth.
- AI proxying is recommended for deployed environments.
- Local drafts are hydrated only after a valid Co-Cut user session is available.
