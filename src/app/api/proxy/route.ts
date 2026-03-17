// Transparent proxy — browser calls this, server forwards with browser's UA.
// Using edge runtime gives a more browser-like TLS fingerprint than Node.js.
export const runtime = "edge";
export const dynamic = "force-dynamic";

const ALLOWED_HOSTS: Record<string, string> = {
  gmgn: "https://gmgn.ai",
  dexscreener: "https://api.dexscreener.com",
  pumpfun: "https://frontend-api-v3.pump.fun",
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const host = searchParams.get("host") ?? "gmgn";
  const path = searchParams.get("path") ?? "";

  const base = ALLOWED_HOSTS[host];
  if (!base || !path.startsWith("/")) {
    return new Response("invalid host or path", { status: 400 });
  }

  // Build full query string (strip our own params, forward the rest)
  const forwardParams = new URLSearchParams();
  for (const [k, v] of searchParams.entries()) {
    if (k !== "host" && k !== "path") forwardParams.set(k, v);
  }
  const qs = forwardParams.toString();
  const url = `${base}${path}${qs ? `?${qs}` : ""}`;

  // Forward browser headers so Cloudflare sees a real browser request
  const ua = request.headers.get("user-agent") ?? "";
  const acceptLang = request.headers.get("accept-language") ?? "en-US,en;q=0.9";

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": ua,
        Referer: `${base}/`,
        Accept: "application/json, text/plain, */*",
        "Accept-Language": acceptLang,
        "Cache-Control": "no-cache",
      },
    });

    const body = await res.arrayBuffer();
    return new Response(body, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("content-type") ?? "application/json",
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }
}
