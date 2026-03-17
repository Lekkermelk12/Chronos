import { pfetch } from "./fetch";

// --- Helius API Client ---
// Docs: https://docs.helius.dev

const HELIUS_API_KEY = process.env.HELIUS_API_KEY ?? "";
export const HELIUS_RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
export const HELIUS_WS_URL = `wss://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const HELIUS_API_BASE = `https://api.helius.xyz/v0`;

export function isHeliusConfigured(): boolean {
  return HELIUS_API_KEY.length > 0;
}

// ---------------------------------------------------------------------------
// DAS API — Digital Asset Standard (token metadata)
// ---------------------------------------------------------------------------

export interface DasTokenMetadata {
  address: string;
  name: string;
  symbol: string;
  imageUrl?: string;
  description?: string;
  decimals?: number;
  mintAuthorityDisabled: boolean;
  freezeAuthorityDisabled: boolean;
  pricePerToken?: number;
  socials: { type: string; url: string }[];
  website?: string;
  twitter?: string;
  github?: string;
}

async function dasRpc(method: string, params: Record<string, unknown>): Promise<unknown> {
  if (!HELIUS_API_KEY) return null;
  try {
    const res = await pfetch(HELIUS_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: "chronos", method, params }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.error) return null;
    return data.result;
  } catch {
    return null;
  }
}

function parseDasAsset(item: Record<string, unknown>): DasTokenMetadata | null {
  if (!item?.id) return null;

  const address = item.id as string;
  const content = (item.content ?? {}) as Record<string, unknown>;
  const metadata = (content.metadata ?? {}) as Record<string, unknown>;
  const links = (content.links ?? {}) as Record<string, string>;
  const files = Array.isArray(content.files)
    ? (content.files as Array<{ uri?: string; cdn_uri?: string; mime?: string }>)
    : [];
  const tokenInfo = (item.token_info ?? {}) as Record<string, unknown>;
  const priceInfo = (tokenInfo.price_info ?? {}) as Record<string, number>;
  const authorities = Array.isArray(item.authorities)
    ? (item.authorities as Array<{ address: string; scopes: string[] }>)
    : [];

  // Image URL
  let imageUrl: string | undefined;
  const imgFile = files.find((f) => f.mime?.startsWith("image/"));
  if (imgFile) imageUrl = imgFile.cdn_uri ?? imgFile.uri;
  if (!imageUrl && links.image) imageUrl = links.image;

  // Social links
  const socials: { type: string; url: string }[] = [];
  if (links.external_url) socials.push({ type: "website", url: links.external_url });
  if (links.twitter) socials.push({ type: "twitter", url: links.twitter });

  // GitHub link from description
  const description = (metadata.description as string) ?? "";
  let github: string | undefined;
  const ghMatch = description.match(/https?:\/\/github\.com\/[^\s)>\]]+/);
  if (ghMatch) {
    github = ghMatch[0];
    socials.push({ type: "github", url: github });
  }

  // Authority state — disabled = authority has been revoked (renounced)
  const hasMintAuthority = authorities.some((a) => a.scopes.includes("mint"));
  const hasFreezeAuthority = authorities.some((a) => a.scopes.includes("freeze"));

  return {
    address,
    name: (metadata.name as string) ?? "Unknown",
    symbol: (metadata.symbol as string) ?? "???",
    imageUrl,
    description: description || undefined,
    decimals: (tokenInfo.decimals as number) ?? 9,
    mintAuthorityDisabled: !hasMintAuthority,
    freezeAuthorityDisabled: !hasFreezeAuthority,
    pricePerToken: priceInfo.price_per_token,
    socials,
    website: links.external_url,
    twitter: links.twitter,
    github,
  };
}

/** Fetch token metadata from Helius DAS for a single mint address. */
export async function dasGetAsset(mintAddress: string): Promise<DasTokenMetadata | null> {
  if (!HELIUS_API_KEY) return null;
  try {
    const result = (await dasRpc("getAsset", { id: mintAddress })) as Record<
      string,
      unknown
    > | null;
    if (!result) return null;
    return parseDasAsset(result);
  } catch {
    return null;
  }
}

/** Batch fetch token metadata for up to 1000 addresses (uses getAssetBatch). */
export async function dasGetAssetBatch(
  mintAddresses: string[]
): Promise<Map<string, DasTokenMetadata>> {
  const out = new Map<string, DasTokenMetadata>();
  if (!HELIUS_API_KEY || mintAddresses.length === 0) return out;

  for (let i = 0; i < mintAddresses.length; i += 100) {
    const batch = mintAddresses.slice(i, i + 100);
    try {
      const result = (await dasRpc("getAssetBatch", { ids: batch })) as Array<
        Record<string, unknown>
      > | null;
      if (!Array.isArray(result)) continue;
      for (const item of result) {
        if (!item) continue;
        const parsed = parseDasAsset(item);
        if (parsed) out.set(parsed.address, parsed);
      }
    } catch {
      /* ignore batch errors */
    }
    if (i + 100 < mintAddresses.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Webhooks API
// ---------------------------------------------------------------------------

export async function createHeliusWebhook(opts: {
  webhookUrl: string;
  addresses: string[];
  transactionTypes: string[];
}): Promise<string | null> {
  if (!HELIUS_API_KEY) return null;
  try {
    const res = await pfetch(`${HELIUS_API_BASE}/webhooks?api-key=${HELIUS_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        webhookURL: opts.webhookUrl,
        webhookType: "enhanced",
        accountAddresses: opts.addresses,
        transactionTypes: opts.transactionTypes,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data.webhookID as string) ?? null;
  } catch {
    return null;
  }
}

export async function listHeliusWebhooks(): Promise<
  { webhookID: string; webhookURL: string; accountAddresses: string[] }[]
> {
  if (!HELIUS_API_KEY) return [];
  try {
    const res = await pfetch(`${HELIUS_API_BASE}/webhooks?api-key=${HELIUS_API_KEY}`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function deleteHeliusWebhook(webhookId: string): Promise<boolean> {
  if (!HELIUS_API_KEY) return false;
  try {
    const res = await pfetch(
      `${HELIUS_API_BASE}/webhooks/${webhookId}?api-key=${HELIUS_API_KEY}`,
      { method: "DELETE" }
    );
    return res.ok;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// WebSocket monitor — pump.fun AMM swap detection
// ---------------------------------------------------------------------------

const PUMP_AMM_PROGRAM = "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA";

export type SwapEvent = {
  signature: string;
  tokenAddress?: string;
  type: "buy" | "sell";
  slot: number;
};

type SwapCallback = (event: SwapEvent) => void;

let _wsInstance: { close: () => void } | null = null;
let _swapCallbacks: SwapCallback[] = [];
let _pingTimer: ReturnType<typeof setInterval> | null = null;
let _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let _reconnectDelay = 1000;

/** Register a callback for swap events. Returns an unsubscribe function. */
export function onSwapEvent(cb: SwapCallback): () => void {
  _swapCallbacks.push(cb);
  return () => {
    _swapCallbacks = _swapCallbacks.filter((c) => c !== cb);
  };
}

/** Start the Helius WebSocket monitor (idempotent). */
export function startHeliusWsMonitor(): void {
  if (_wsInstance) return;
  if (!HELIUS_API_KEY) {
    console.log("[Helius WS] No API key — skipping WebSocket monitor");
    return;
  }
  _connectWs();
}

/** Stop the Helius WebSocket monitor. */
export function stopHeliusWsMonitor(): void {
  if (_pingTimer) { clearInterval(_pingTimer); _pingTimer = null; }
  if (_reconnectTimer) { clearTimeout(_reconnectTimer); _reconnectTimer = null; }
  if (_wsInstance) { _wsInstance.close(); _wsInstance = null; }
  _reconnectDelay = 1000;
}

function _connectWs(): void {
  // Use undici WebSocket (already a project dependency, WHATWG-compatible)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { WebSocket: WS } = require("undici") as {
    WebSocket: new (url: string) => {
      readyState: number;
      send: (data: string) => void;
      close: () => void;
      onopen: (() => void) | null;
      onmessage: ((event: { data: string }) => void) | null;
      onclose: (() => void) | null;
      onerror: ((err: unknown) => void) | null;
    };
  };

  const ws = new WS(HELIUS_WS_URL);

  ws.onopen = () => {
    console.log("[Helius WS] Connected — subscribing to Pump AMM logs");
    _reconnectDelay = 1000;

    ws.send(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "logsSubscribe",
        params: [{ mentions: [PUMP_AMM_PROGRAM] }, { commitment: "confirmed" }],
      })
    );

    // WHATWG WebSocket has no .ping() — send a keepalive message instead
    _pingTimer = setInterval(() => {
      if (ws.readyState === 1 /* OPEN */) {
        ws.send(JSON.stringify({ jsonrpc: "2.0", id: 0, method: "ping" }));
      }
    }, 30_000);
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.result !== undefined) return; // subscription confirmation
      if (msg.method !== "logsNotification") return;

      const value = msg.params?.result?.value;
      if (!value || value.err) return;

      const signature: string = value.signature ?? "";
      const logs: string[] = value.logs ?? [];

      let tokenAddress: string | undefined;
      let swapType: "buy" | "sell" = "buy";

      for (const log of logs) {
        // Pump AMM logs typically contain the token mint address
        const mintMatch = log.match(/mint[:\s]+([A-Za-z0-9]{32,44})/i);
        if (mintMatch) tokenAddress = mintMatch[1];

        if (/\bsell\b/i.test(log)) swapType = "sell";
        if (/\bbuy\b/i.test(log)) swapType = "buy";
      }

      const evt: SwapEvent = {
        signature,
        tokenAddress,
        type: swapType,
        slot: msg.params?.result?.context?.slot ?? 0,
      };

      for (const cb of _swapCallbacks) {
        try { cb(evt); } catch { /* don't let a bad callback kill the loop */ }
      }
    } catch {
      /* ignore parse errors */
    }
  };

  ws.onclose = () => {
    console.log(`[Helius WS] Disconnected — reconnecting in ${_reconnectDelay}ms`);
    if (_pingTimer) { clearInterval(_pingTimer); _pingTimer = null; }
    _wsInstance = null;
    _reconnectTimer = setTimeout(() => {
      _reconnectDelay = Math.min(_reconnectDelay * 2, 30_000);
      _connectWs();
    }, _reconnectDelay);
  };

  ws.onerror = (err) => {
    console.error("[Helius WS] Error:", err);
  };

  _wsInstance = { close: () => ws.close() };
}
