# Co-Cut Captain Convergence Note

Date: 2026-03-09
Scope: integrated repo convergence for the standalone Co-Cut editor product

## Current Condition

Classification: `partial`

Co-Cut now reads as one standalone editing product at the shell and runtime level:

- one auth-gated Vite SPA boot path
- one editor shell
- one local-first per-user draft model
- one optional structured cloud sync path
- one API-backed timed-transcript core for transcript-driven editing

The app is materially more coherent than before, but it is not fully settled yet. The remaining instability is operational, not shell-level.

## Corrected Canonical Model

### Runtime

- `src/App.tsx` is the only top-level boot boundary.
- The active boot order is:
  1. missing-env setup screen
  2. auth session check
  3. sign-in screen
  4. local draft hydration
  5. editor shell
- `VITE_PREVIEW_BYPASS_AUTH` is no longer part of supported runtime behavior.

### Editor product

- `src/components/shell/EditorShell.tsx` is the active shell.
- Project creation exposes two canonical entries only: `Transcript Session` and `Blank Assembly`.
- `Cut` is the transcript-first review and clip-selection workspace.
- `Assemble` is the composition workspace.
- `Cut` owns primary source ingest. The assembly media bin is for downstream visual and audio assets, not the interview-source ingest path.
- Non-modal utilities belong to the shell-owned dock, not detached viewport overlays.

### Persistence

- Local IndexedDB draft state is the first durable layer.
- Persistence is user-scoped and local-first.
- Supabase sync is optional and stores structured project state only.
- Transcript state and saved clips sync with the project snapshot.
- Source media remains local to the current browser and still requires relink on a different browser or device.

### Transcript core

- Timed transcription now has one product entrypoint: the API-backed service in `src/services/whisperService.ts`.
- Cut ingest and subtitle generation both depend on that same timed-transcript contract.
- If `VITE_OPENAI_API_KEY` is not configured locally, transcript actions block with an explicit setup message instead of generating placeholder transcript output.

## What This Pass Corrected

1. Removed the preview auth bypass from the live app boot path so Co-Cut has one runtime truth.
2. Removed the placeholder transcript fallback from product use and converged subtitle generation onto the same timed-transcript service used by Cut.
3. Standardized the no-key transcript behavior so transcript features fail explicitly instead of fabricating coarse `[speech]` segments.
4. Removed generic template-launcher drift from the project entry flow and clarified that Cut owns source ingest while the media bin owns assembly assets.
5. Kept the existing local-first plus optional-sync persistence contract and aligned repo-facing notes back to that product story.

## Compatibility-Only Residue

These remain intentionally narrow and should not be treated as active product architecture:

- legacy `coedit` storage keys, IndexedDB names, and drag MIME types
- external GitHub remote naming that still uses `coedit`
- snapshot-based sync that restores structure, transcript state, and saved clips but not source media

## Remaining Blockers

1. Timed transcription still depends on `VITE_OPENAI_API_KEY` for local browser use until a supported proxy/server path is added.
2. Cloud sync is still snapshot-based and media relink remains a manual follow-up when opening on another browser.
3. Full authenticated browser QA still depends on having a valid local test session or credentials available during verification.

## Status Summary

Co-Cut should now be read as one active standalone product with explicit transitional residue at the compatibility and sync edges.

The shell is no longer the main risk. Remaining stabilization work belongs to:

- transcript infrastructure
- sync trust and media relink
- authenticated verification discipline
