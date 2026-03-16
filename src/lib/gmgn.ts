import { pfetch } from "./fetch";

// --- GMGN API Client ---
// Requires Chrome UA + Referer to bypass Cloudflare

const GMGN_BASE = "https://gmgn.ai";

const GMGN_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Referer: "https://gmgn.ai/",
  Accept: "application/json",
};

// --- Types ---

export interface GmgnRankToken {
  address: string;
  chain: string;
  name: string;
  symbol: string;
  logo: string;
  price: number;
  price_change_percent: number;
  price_change_percent1m: number;
  price_change_percent5m: number;
  price_change_percent1h: number;
  market_cap: number;
  liquidity: number;
  volume: number;
  total_supply: number;
  initial_liquidity: number;
  swaps: number;
  buys: number;
  sells: number;
  holder_count: number;
  renounced_mint: number;
  renounced_freeze_account: number;
  burn_ratio: string;
  burn_status: string;
  is_show_alert: boolean;
  top_10_holder_rate: number;
  bluechip_owner_percentage: number;
  sniper_count: number;
  smart_degen_count: number;
  renowned_count: number;
  rat_trader_amount_rate: number;
  creator: string;
  creator_token_status: string;
  creator_close: boolean;
  launchpad: string;
  launchpad_status: number;
  open_timestamp: number;
  creation_timestamp: number;
  twitter_username: string;
  hot_level: number;
  is_honeypot?: boolean;
  rug_ratio?: number;
  pool_type?: string;
  pool_type_str?: string;
  cto_flag?: number;
  dev_token_burn_amount?: number;
  dev_token_burn_ratio?: number;
}

export interface GmgnTokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logo: string;
  biggest_pool_address: string;
  open_timestamp: number;
  creation_timestamp: number;
  holder_count: number;
  circulating_supply: number;
  total_supply: number;
  max_supply: number;
  liquidity: number;
  price?: number;
  price_1h?: number;
  price_24h?: number;
  swaps_5m?: number;
  swaps_1h?: number;
  swaps_6h?: number;
  swaps_24h?: number;
  volume_24h?: number;
  top_10_holder_rate?: number;
  renounced_mint?: number;
  renounced_freeze_account?: number;
  burn_ratio?: string;
  burn_status?: string;
}

export type GmgnTimeframe = "1m" | "5m" | "1h" | "6h" | "24h";
export type GmgnOrderBy =
  | "marketcap"
  | "volume"
  | "swaps"
  | "holder_count"
  | "smartmoney"
  | "liquidity"
  | "open_timestamp"
  | "price";

// --- API Functions ---

async function gmgnFetch(path: string): Promise<Response> {
  return pfetch(`${GMGN_BASE}${path}`, { headers: GMGN_HEADERS });
}

/**
 * Fetch ranked tokens from GMGN. Returns up to `limit` tokens sorted by the given criteria.
 * This is the richest endpoint - 57+ fields per token including safety flags.
 */
export async function getRankedTokens(opts: {
  timeframe?: GmgnTimeframe;
  orderby?: GmgnOrderBy;
  direction?: "asc" | "desc";
  limit?: number;
  filters?: string[];
}): Promise<GmgnRankToken[]> {
  const {
    timeframe = "24h",
    orderby = "marketcap",
    direction = "desc",
    limit = 100,
    filters = [],
  } = opts;

  const filterParams = filters.map((f) => `&filters[]=${f}`).join("");
  const res = await gmgnFetch(
    `/defi/quotation/v1/rank/sol/swaps/${timeframe}?orderby=${orderby}&direction=${direction}&limit=${limit}${filterParams}`
  );

  if (!res.ok) throw new Error(`GMGN rank failed: ${res.status}`);
  const data = await res.json();
  if (data.code !== 0) throw new Error(`GMGN rank error: ${data.msg}`);
  return data.data?.rank ?? [];
}

/**
 * Fetch info for a single token by address.
 * Returns price, volume, liquidity, safety flags.
 */
export async function getTokenData(address: string): Promise<GmgnTokenInfo | null> {
  try {
    const res = await gmgnFetch(
      `/defi/quotation/v1/tokens/sol?address=${address}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.code !== 0) return null;
    const tokens = data.data?.tokens ?? [];
    return tokens.length > 0 ? tokens[0] : null;
  } catch {
    return null;
  }
}

/**
 * Fetch basic token info (fewer fields but always works).
 */
export async function getTokenInfo(address: string): Promise<GmgnTokenInfo | null> {
  try {
    const res = await gmgnFetch(`/api/v1/token_info/sol/${address}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.code !== 0) return null;
    return data.data ?? null;
  } catch {
    return null;
  }
}

/**
 * Fetch new trading pairs.
 */
export async function getNewPairs(limit = 50): Promise<GmgnRankToken[]> {
  try {
    const res = await gmgnFetch(
      `/defi/quotation/v1/pairs/sol/new_pairs?limit=${limit}&orderby=open_timestamp&direction=desc`
    );
    if (!res.ok) return [];
    const data = await res.json();
    if (data.code !== 0) return [];
    return data.data?.pairs ?? [];
  } catch {
    return [];
  }
}

/**
 * Fetch multiple pages of ranked tokens for broad indexing.
 * GMGN doesn't have pagination, but we can use different timeframes
 * and sort orders to maximize unique token discovery.
 */
export async function fetchBulkTokens(opts?: {
  limit?: number;
  minMc?: number;
  maxAgeMs?: number;
}): Promise<GmgnRankToken[]> {
  const { limit = 500, minMc = 3500, maxAgeMs } = opts ?? {};
  const seen = new Map<string, GmgnRankToken>();

  const combos: { timeframe: GmgnTimeframe; orderby: GmgnOrderBy }[] = [
    { timeframe: "24h", orderby: "marketcap" },
    { timeframe: "24h", orderby: "volume" },
    { timeframe: "24h", orderby: "swaps" },
    { timeframe: "24h", orderby: "holder_count" },
    { timeframe: "24h", orderby: "liquidity" },
    { timeframe: "6h", orderby: "marketcap" },
    { timeframe: "6h", orderby: "volume" },
    { timeframe: "6h", orderby: "swaps" },
    { timeframe: "1h", orderby: "marketcap" },
    { timeframe: "1h", orderby: "volume" },
    { timeframe: "1h", orderby: "swaps" },
    { timeframe: "5m", orderby: "volume" },
    { timeframe: "5m", orderby: "swaps" },
    { timeframe: "1m", orderby: "volume" },
    { timeframe: "1m", orderby: "swaps" },
  ];

  const now = Date.now() / 1000; // GMGN timestamps are in seconds

  for (const { timeframe, orderby } of combos) {
    try {
      const tokens = await getRankedTokens({
        timeframe,
        orderby,
        direction: "desc",
        limit,
        filters: ["not_honeypot"],
      });

      for (const t of tokens) {
        if (seen.has(t.address)) continue;
        if ((t.market_cap ?? 0) < minMc) continue;
        if ((t.liquidity ?? 0) <= 0) continue;

        // Age filter
        if (maxAgeMs && t.creation_timestamp) {
          const ageMs = (now - t.creation_timestamp) * 1000;
          if (ageMs > maxAgeMs) continue;
        }

        seen.set(t.address, t);
      }

      // Small delay between requests
      await new Promise((r) => setTimeout(r, 300));
    } catch (err) {
      console.error(`[GMGN] Failed ${timeframe}/${orderby}:`, err);
    }
  }

  return Array.from(seen.values());
}
