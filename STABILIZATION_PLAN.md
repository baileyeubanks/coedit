# Co-Cut Stabilization Plan

Updated: March 10, 2026

## Verified Current State

- `npm run build` passes.
- Deploy contract exists at
  `/Users/baileyeubanks/Desktop/Projects/contentco-op/cocut/DEPLOY_CONTRACT.md`.
- Docker runtime contract exists at
  `/Users/baileyeubanks/Desktop/Projects/contentco-op/cocut/Dockerfile`.
- Static health probe exists at `/health.json`.
- Cross-origin isolation headers are preserved in both Vite config and nginx.

## Product Areas

| Area | Current state | Verification |
| --- | --- | --- |
| Shell / boot path | Stable | Captured in `docs/COCUT_CAPTAIN_AUDIT_2026-03-09.md` |
| Editor runtime | Stable enough to build | `npm run build` passed |
| Transcript workflow | Partial | Timed transcription still depends on browser-side key or proxy path |
| Persistence | Partial but coherent | Local-first + optional Supabase sync model documented |
| Export | Present in product model | Build passes; browser runtime still needs end-to-end QA |
| Deploy/runtime | Now contract-defined | Dockerfile + nginx + health probe added |

## Primary Remaining Gaps

1. Timed transcription still depends on `VITE_OPENAI_API_KEY` for direct browser fallback.
2. Cross-browser media relink remains manual because project sync does not carry heavy source files.
3. Authenticated browser QA still needs a real session and one real media project cycle.
4. Whisper/NAS proof is not yet represented as a first-class server-side contract inside this repo.

## Hardening Order

1. Replace browser-key transcript fallback with a server-side proxy or approved NAS transcription bridge.
2. Run one authenticated browser cycle: upload video -> transcript -> edit -> export.
3. Define durable media relink guidance for opening synced projects on another browser/device.
4. Add a lightweight smoke test for the health surface and editor boot.

## Explicit Non-Goals For This Pass

- No new editor architecture rewrite.
- No change to the local-first persistence model.
- No attempt to push provider API keys into public production runtime.
