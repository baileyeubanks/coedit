# Co-Cut Deploy Contract

## Canonical Source

- Repo: `/Users/baileyeubanks/Desktop/Projects/contentco-op/cocut`
- Current GitHub / Coolify repo identity: `baileyeubanks/coedit`
- Framework: Vite + React
- Default port: `4104`
- Health endpoint: `/health.json`

## Live Publishing Rule

- Live branch: `main`
- Live source control: GitHub
- Live deploy plane: Coolify webhook-driven rebuild from `baileyeubanks/coedit`
- Product name stays `Co-Cut`; `coedit` is the current repo identity only
- Standard publish path: clean repo -> `git push origin main` -> Coolify auto-deploy -> `/health.json` verify

## Required Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Yes | Browser Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Browser Supabase anon key |
| `VITE_AI_PROXY_URL` | Recommended | Server-side proxy for AI requests in deployed environments |
| `VITE_GOOGLE_API_KEY` | Optional, local-only | Direct Gemini browser usage |
| `VITE_ANTHROPIC_API_KEY` | Optional, local-only | Direct Anthropic browser usage |
| `VITE_OPENAI_API_KEY` | Optional, local-only | Timed transcription in browser-only fallback mode |

## Build and Runtime

```bash
npm ci
npm run build
```

Runtime uses nginx and serves `dist/` with SPA fallback and cross-origin
isolation headers required by FFmpeg.wasm.

Required deploy-time headers on the public edge:

- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp`

## Docker Contract

- Dockerfile: `/Users/baileyeubanks/Desktop/Projects/contentco-op/cocut/Dockerfile`
- nginx config: `/Users/baileyeubanks/Desktop/Projects/contentco-op/cocut/nginx.conf`
- Exposed ports: `80` for public ingress and `4104` for the existing Coolify healthcheck (`4104` remains the local dev port too)
- Health probe: `GET /health.json`

## Coolify Notes

- Set `COCUT_PUBLIC_BASE` in `/Users/baileyeubanks/Desktop/Projects/ccnas-stack/.env.template`
- Use the repo root as the build context
- Probe path: `/health.json`
- Prefer `VITE_AI_PROXY_URL` over shipping provider API keys in production
- Keep the standalone `nginx.conf` header contract aligned with FFmpeg.wasm requirements before every rebuild
- Rollback owner: Content Co-op / Co-Cut repo owner
