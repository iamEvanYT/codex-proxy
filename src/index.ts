const code = process.env.ACCESS_CODE;
const port = parseInt(process.env.PORT || "3000") || 3000;
const upstream =
  process.env.UPSTREAM_URL || "https://chatgpt.com/backend-api/codex/responses";
const issuer = process.env.AUTH_UPSTREAM_URL || "https://auth.openai.com";
const debug = !!process.env.CODEX_DEBUG;
const LOG_CODEX_BODY = false;
const gate = "x-access-code";
const hop = new Set([
  "cdn-loop",
  "cf-connecting-ip",
  "cf-ipcountry",
  "cf-ray",
  "cf-visitor",
  "cf-warp-tag-id",
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
  "via",
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-real-ip",
]);

if (!code) throw new Error("Missing ACCESS_CODE");

function deny(status: number, error: string) {
  return Response.json({ error }, { status });
}

function log(msg: string, data?: Record<string, unknown>) {
  if (!debug) return;
  console.log(
    JSON.stringify({
      msg,
      ...(data || {}),
    })
  );
}

function info(req: Request, url: URL) {
  return {
    method: req.method,
    path: url.pathname,
    search: url.search,
    has_auth: !!req.headers.get("authorization"),
    has_account: !!req.headers.get("ChatGPT-Account-Id"),
  };
}

function path(base: URL, next: string) {
  base.pathname = `${base.pathname.replace(/\/+$/, "")}/${next.replace(
    /^\/+/,
    ""
  )}`;
  return base;
}

function auth(url: URL) {
  return (
    url.pathname === "/oauth/token" ||
    url.pathname === "/api/accounts/deviceauth/usercode" ||
    url.pathname === "/api/accounts/deviceauth/token"
  );
}

function target(url: URL) {
  if (auth(url)) {
    const base = path(new URL(issuer), url.pathname);
    base.search = url.search;
    return base;
  }

  if (url.pathname === "/v1/responses") return new URL(upstream);
  if (url.pathname === "/chat/completions") return new URL(upstream);

  const base = path(new URL(upstream), url.pathname);
  base.search = url.search;
  return base;
}

function forwarded(input: Headers) {
  const out = new Headers();
  for (const [k, v] of input) {
    const key = k.toLowerCase();
    if (key === gate) continue;
    if (hop.has(key)) continue;
    out.set(k, v);
  }
  return out;
}

async function body(req: Request, url: URL, res: Response) {
  if (!debug) return;
  if (!LOG_CODEX_BODY && res.ok) return;
  if (!res.body) return;

  log("response_body", {
    method: req.method,
    path: url.pathname,
    status: res.status,
    body: await res
      .clone()
      .text()
      .catch(() => ""),
  });
}

function output(res: Response) {
  const headers = new Headers(res.headers);
  headers.delete("content-length");
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

async function proxy(req: Request) {
  const url = new URL(req.url);
  const meta = info(req, url);

  if (url.pathname === "/health") {
    log("health", { path: url.pathname });
    return Response.json({
      ok: true,
      upstream,
      issuer,
    });
  }

  if (req.headers.get(gate) !== code) {
    log("deny", meta);
    return deny(401, "Invalid access code");
  }

  const headers = forwarded(req.headers);
  const dst = target(url);
  log("request", {
    ...meta,
    target: dst.toString(),
  });

  const init: RequestInit & { duplex?: "half" } = {
    method: req.method,
    headers,
    redirect: "manual",
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = req.body;
    init.duplex = "half";
  }

  const res = await fetch(dst, init);
  await body(req, url, res);
  log("response", {
    ...meta,
    status: res.status,
    content_type: res.headers.get("content-type"),
  });

  return output(res);
}

Bun.serve({
  port,
  idleTimeout: 0,
  async fetch(req) {
    try {
      return await proxy(req);
    } catch (err) {
      log("error", {
        error: err instanceof Error ? err.message : "Proxy failed",
      });
      return deny(502, err instanceof Error ? err.message : "Proxy failed");
    }
  },
});

console.log(`Codex proxy listening on http://localhost:${port}`);
