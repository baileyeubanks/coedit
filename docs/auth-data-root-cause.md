# Co-Cut Auth/Data Root Cause Note

## Root Cause

Co-Cut had already moved some structured state into a standalone product model, but the runtime still carried several Co-Edit-era assumptions:

- local draft persistence behaved like a browser-global workspace instead of a user-scoped working copy
- editor boot and auth boot were not cleanly separated
- legacy Co-Edit storage keys and drag types were still part of live runtime behavior
- local media blob storage and missing-source tracking were still too implicit to be trustworthy across saves
- UI copy suggested a cleaner local/cloud contract than the runtime actually enforced
- project hydration did not fully reset editor history across user or project boundaries

That left cloud ownership user-scoped while the local working copy still behaved like shared legacy state.

## What Was Corrected

- Auth remains the product gate through Supabase Auth.
- The active local draft is now selected per signed-in user instead of one global autosave key.
- Legacy Co-Edit draft keys are migration-only compatibility paths.
- Local media blobs are now keyed to the active local draft instead of raw shared asset ids.
- Editor boot now waits for auth-backed persistence initialization before rendering the shell.
- Empty-load boot hydrates a clean blank project instead of leaving stale in-memory state alive.
- Project hydration and new-project creation clear undo history so one project cannot inherit another project’s edit history.
- Missing-local-source state now persists through later saves instead of being dropped once a blob is unavailable.
- Product copy now states the real contract: project structure, transcript state, and saved clips can sync; source media stays local.

## Corrected Areas

- [src/App.tsx](/Users/baileyeubanks/Desktop/Projects/contentco-op/cocut/src/App.tsx)
- [src/services/projectService.ts](/Users/baileyeubanks/Desktop/Projects/contentco-op/cocut/src/services/projectService.ts)
- [src/store/persistenceStore.ts](/Users/baileyeubanks/Desktop/Projects/contentco-op/cocut/src/store/persistenceStore.ts)
- [src/services/supabaseProjectService.ts](/Users/baileyeubanks/Desktop/Projects/contentco-op/cocut/src/services/supabaseProjectService.ts)
- [src/components/auth/LoginPage.tsx](/Users/baileyeubanks/Desktop/Projects/contentco-op/cocut/src/components/auth/LoginPage.tsx)
- [src/components/projects/ProjectManager.tsx](/Users/baileyeubanks/Desktop/Projects/contentco-op/cocut/src/components/projects/ProjectManager.tsx)
- [src/components/ui/NewProjectDialog.tsx](/Users/baileyeubanks/Desktop/Projects/contentco-op/cocut/src/components/ui/NewProjectDialog.tsx)
- [src/config/product.ts](/Users/baileyeubanks/Desktop/Projects/contentco-op/cocut/src/config/product.ts)

## Still Transitional

- Legacy Co-Edit keys are still read for safe migration, but new writes use Co-Cut names.
- Cloud sync is snapshot-based and does not yet include a relink flow for missing local source media.
- Transcript and clip state now persist coherently, but deeper review/versioning workflows still need follow-up.
