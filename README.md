# Codex Proxy

Small Bun proxy for Codex requests. It expects OpenCode to send the normal upstream auth headers like `Authorization` and `ChatGPT-Account-Id`, and it forwards those headers to Codex unchanged.

The proxy also requires a separate access code on each incoming request via `x-access-code`. That access code is checked locally and is never forwarded upstream.

Environment:

```bash
export ACCESS_CODE=your-local-gate
export PORT=3000
export UPSTREAM_URL=https://chatgpt.com/backend-api/codex/responses
export CODEX_DEBUG=1
```

Install dependencies:

```bash
bun install
```

Run:

```bash
bun run .
```

Docker:

```bash
docker build -t codex-proxy .
docker run --rm -p 3000:3000 \
  -e ACCESS_CODE=your-local-gate \
  -e PORT=3000 \
  -e UPSTREAM_URL=https://chatgpt.com/backend-api/codex/responses \
  codex-proxy
```

Docker Compose:

```bash
docker compose up
```

Edit [`docker-compose.yml`](/Users/evan/Developer/try/2026-03-23-codex-proxy/docker-compose.yml) and replace `ACCESS_CODE: change-me` before using it.

GitHub Actions:

- The workflow at `.github/workflows/docker.yml` builds and publishes a multi-arch image to `ghcr.io/iamEvanYT/codex-proxy`.
- Published platforms are `linux/amd64` and `linux/arm64`.
- Pushes to `main`, version tags like `v1.0.0`, and manual runs publish images.

Example request:

```bash
curl http://localhost:3000/v1/responses \
  -H "x-access-code: $ACCESS_CODE" \
  -H "authorization: Bearer <oauth-access-token>" \
  -H "ChatGPT-Account-Id: <account-id>" \
  -H "content-type: application/json" \
  --data '{"model":"gpt-5.3-codex","input":"hello"}'
```

Supported path behavior:

- `/v1/responses` -> proxied to `UPSTREAM_URL`
- `/chat/completions` -> proxied to `UPSTREAM_URL`
- any other path -> proxied relative to `UPSTREAM_URL`

When `CODEX_DEBUG` is set, the proxy logs request routing, auth-header presence, upstream status codes, and proxy errors.
