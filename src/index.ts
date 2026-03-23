const code = process.env.ACCESS_CODE;
const port = parseInt(process.env.PORT || "3000") || 3000;
const upstream =
  process.env.UPSTREAM_URL || "https://chatgpt.com/backend-api/codex/responses";
const gate = "x-access-code";
const hop = new Set([
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

if (!code) throw new Error("Missing ACCESS_CODE");

function deny(status: number, error: string) {
  return Response.json({ error }, { status });
}

function target(url: URL) {
  if (url.pathname === "/v1/responses") return new URL(upstream);
  if (url.pathname === "/chat/completions") return new URL(upstream);

  const base = new URL(upstream);
  base.pathname = `${base.pathname.replace(/\/+$/, "")}/${url.pathname.replace(
    /^\/+/,
    ""
  )}`;
  base.search = url.search;
  return base;
}

function headers(input: Headers) {
  const out = new Headers();
  for (const [k, v] of input) {
    const key = k.toLowerCase();
    if (key === gate) continue;
    if (hop.has(key)) continue;
    out.set(k, v);
  }
  return out;
}

async function proxy(req: Request) {
  const url = new URL(req.url);

  if (url.pathname === "/health") {
    return Response.json({
      ok: true,
      upstream,
    });
  }

  if (req.headers.get(gate) !== code) {
    return deny(401, "Invalid access code");
  }

  const init: RequestInit & { duplex?: "half" } = {
    method: req.method,
    headers: headers(req.headers),
    redirect: "manual",
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = req.body;
    init.duplex = "half";
  }

  const res = await fetch(target(url), init);
  const out = new Headers(res.headers);
  out.delete("content-length");

  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: out,
  });
}

Bun.serve({
  port,
  async fetch(req) {
    try {
      return await proxy(req);
    } catch (err) {
      return deny(502, err instanceof Error ? err.message : "Proxy failed");
    }
  },
});

console.log(`Codex proxy listening on http://localhost:${port}`);
