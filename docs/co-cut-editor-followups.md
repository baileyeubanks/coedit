# Co-Cut Editor Follow-Ups

These items were identified while refining the editor shell and workflow hierarchy. They are intentionally out of scope for this UI thread.

## 1. Media ingest

- Add a persistent ingest queue with progress, cancellation, and retry states.
- Support relinking missing local source media after project restore.
- Separate transcript source ingest from assembly asset ingest so users do not confuse the two workflows.

## 2. Transcript + clips

- Add sentence- and paragraph-level transcript structure from the transcription payload instead of client-side chunking.
- Support clip comments, tags, and status so saved selects can move into review or assembly with more context.
- Add richer source comparison between active transcript range, waveform range, and saved clip cards.

## 3. Save + sync

- Clarify conflict resolution and remote/local state ownership in the project library.
- Add clearer cloud version history and last editor attribution for synced projects.
- Preserve clip-bin and transcript session state more explicitly in save summaries.

## 4. Auth + data

- Keep local preview aligned with the auth-gated runtime; use documented dev sessions instead of hidden bypass flags.
- Confirm the long-term standalone auth contract for Co-Cut without pulling ROOT or Home shell behavior into this repo.
- Review Supabase project access patterns for project library performance and failure messaging.

## 5. Deploy / runtime

- Validate environment handling for local preview, staging, and production so editor shells are inspectable without ad hoc flags.
- Review bundle splitting for the editor runtime; the current build still emits a chunk-size warning.
- Add browser QA coverage for real media import, transcript generation, and clip export flows.
