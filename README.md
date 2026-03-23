# Codex

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
