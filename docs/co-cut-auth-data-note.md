# Co-Cut Integrated Auth/Data Note

## Product Truth

Co-Cut is a standalone editor.

- Supabase is the auth provider and durable structured backend.
- The browser is the first durable runtime for active editing work.
- ROOT, BLAZE, and sibling apps are not Co-Cut runtime authorities.

## Auth Gate

A valid Supabase session is required before the editor shell opens.

- If there is no signed-in user, Co-Cut stays on the login screen.
- After sign-in, Co-Cut initializes the signed-in user’s local draft before rendering the editor.
- Cloud project actions are unavailable without that signed-in user.

## Ownership Model

There are two ownership layers, and they do different jobs.

### User-owned

- Supabase identity
- Cloud project list
- Cloud project rows in `projects.user_id`
- The active browser-local draft slot for that signed-in user

### Project-owned

- Project id, name, timestamps, and sync metadata
- Edit/timeline/canvas state
- Transcript state
- Markers and saved clips
- Media metadata

### Browser-local-only

- Source media blobs
- Cut audio blob
- Blob URLs
- The current autosaved working draft

## Local Vs Remote

### Local first

IndexedDB is the first durable write.

- Co-Cut keeps one active local draft per signed-in user on a given browser.
- Autosave tracks meaningful changes across edit state, media metadata, transcript state, clip state, and persistence status.
- Heavy media stays local. It is not part of cloud sync.

### Cloud backed

Supabase stores the structured project snapshot.

- Cloud sync writes project structure, transcript state, clip state, UI state, and cloud binding metadata.
- Cloud sync does not upload source video/audio/image blobs.
- Loading from cloud on another browser can restore the project structure while still requiring local media relink.

## Transcript And Clip Contract

Transcript and clip state are part of the project contract, not transient UI.

- Transcript payload persists with the project snapshot.
- In/out markers persist.
- Saved clips persist with label, time range, and excerpt text.
- Missing local source media does not erase transcript or clip state.
- Missing-source state itself persists, so Co-Cut can keep telling the truth about what still needs reconnecting.

## Save/Load Behavior

### Local save

- Local save writes the current structured snapshot plus any browser-local blobs.
- Media blobs are scoped to the active local draft instead of raw browser-global asset ids.
- If a blob is missing during hydration, the asset stays in project state and is marked missing.

### Cloud save

- Cloud save is allowed only for the signed-in owner.
- Existing cloud projects are checked against the last known remote timestamp before overwrite.
- A remote-newer project produces an explicit conflict instead of a silent overwrite.

### Cloud load

- Loading a cloud project can replace the current local draft.
- If the local draft contains meaningful unsynced work, Co-Cut warns before replacement.
- After load, Co-Cut reports how many local media sources are missing on this browser.

## Transitional Compatibility

Co-Cut still reads a small set of Co-Edit-era keys for migration safety.

- Legacy local draft DB names
- Legacy onboarding key
- Legacy drag MIME type
- Legacy blob keys where needed for forward migration

These are compatibility reads only. New writes use Co-Cut names and contracts.

## Root Cause

The old contradiction was simple:

- cloud ownership had become user-scoped
- local draft behavior still carried browser-global Co-Edit assumptions
- missing-source tracking was not fully part of the persistence contract

That made auth, save behavior, and source ownership feel inconsistent even when individual pieces worked.

## Current Gaps

- There is still no full media relink workflow beyond missing-source indicators.
- Cloud sync is snapshot-based and still has no diff/merge UI.
- Transcript versioning and clip provenance still need a later pass.

## Related Docs

- [docs/auth-data-model.md](/Users/baileyeubanks/Desktop/Projects/contentco-op/cocut/docs/auth-data-model.md)
- [docs/auth-data-root-cause.md](/Users/baileyeubanks/Desktop/Projects/contentco-op/cocut/docs/auth-data-root-cause.md)
