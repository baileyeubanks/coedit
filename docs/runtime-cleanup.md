# Co-Cut Runtime Cleanup

Historical note: the active repo-wide runtime truth now lives in [COCUT_CAPTAIN_AUDIT_2026-03-09.md](/Users/baileyeubanks/Desktop/Projects/contentco-op/cocut/docs/COCUT_CAPTAIN_AUDIT_2026-03-09.md).

## Runtime Truth

- Co-Cut is a Vite SPA, not a Next.js app.
- The supported boot path is auth-gated and hydrates the local draft before mounting the editor shell.
- `npm run build` produces `dist/`.
- `npm start` previews the production build locally on `PORT` or `4173`.

## Cleanup Outcome

- Editor-only lifecycle is isolated behind the authenticated shell.
- Missing Supabase env falls into the setup screen instead of crashing the runtime.
- Cross-origin isolation headers stay aligned across dev, preview, and the deployed NAS surface.
- Hidden auth-bypass runtime behavior is no longer part of the supported product path.

## Transitional Compatibility

- Legacy Co-Edit persistence identifiers are still read for migration.
- The external Git remote name still uses `coedit`.
- Snapshot sync and local-media relink remain product constraints, not runtime-shell problems.
