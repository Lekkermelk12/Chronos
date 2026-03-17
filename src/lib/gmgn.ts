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
  try {
    const res = await gmgnFetch(
      `/defi/quotation/v1/rank/sol/swaps/${timeframe}?orderby=${orderby}&direction=${direction}&limit=${limit}${filterParams}`
    );
    if (res.ok) {
      const data = await res.json();
      if (data.code === 0) return data.data?.rank ?? [];
    }
  } catch { /* fall through */ }

  // Fallback: DexScreener trending + boosts when GMGN is unreachable
  try {
    const [boostRes, profileRes] = await Promise.allSettled([
      pfetch("https://api.dexscreener.com/token-boosts/top/v1"),
      pfetch("https://api.dexscreener.com/token-profiles/latest/v1"),
    ]);
    const addrs = new Set<string>();
    for (const r of [boostRes, profileRes]) {
      if (r.status === "fulfilled" && r.value.ok) {
        const items = await r.value.json();
        if (Array.isArray(items)) {
          for (const item of items) {
            if ((item.chainId ?? item.chain) === "solana" && item.tokenAddress) {
              addrs.add(item.tokenAddress);
            }
          }
        }
      }
    }
    if (addrs.size > 0) {
      const batch = [...addrs].slice(0, 30).join(",");
      const pairRes = await pfetch(`https://api.dexscreener.com/tokens/v1/solana/${batch}`);
      if (pairRes.ok) {
        const pairs: Record<string,unknown>[] = await pairRes.json();
        const seen = new Map<string, GmgnRankToken>();
        for (const pair of (Array.isArray(pairs) ? pairs : [])) {
          if ((pair.chainId as string) !== "solana") continue;
          const addr = (pair.baseToken as Record<string,string>)?.address;
          if (!addr || seen.has(addr)) continue;
          const liq = (pair.liquidity as Record<string,number>)?.usd ?? 0;
          const mc = (pair.marketCap as number) ?? 0;
          if (mc < 3500 || liq <= 0) continue;
          seen.set(addr, {
            address: addr,
            symbol: (pair.baseToken as Record<string,string>).symbol ?? "???",
            name: (pair.baseToken as Record<string,string>).name ?? "Unknown",
            logo: (pair.info as Record<string,string>)?.imageUrl ?? "",
            price: parseFloat(pair.priceUsd as string) || 0,
            market_cap: mc,
            liquidity: liq,
            volume: (pair.volume as Record<string,number>)?.h24 ?? 0,
            swaps: ((pair.txns as Record<string,Record<string,number>>)?.h24?.buys ?? 0) + ((pair.txns as Record<string,Record<string,number>>)?.h24?.sells ?? 0),
            buys: (pair.txns as Record<string,Record<string,number>>)?.h24?.buys ?? 0,
            sells: (pair.txns as Record<string,Record<string,number>>)?.h24?.sells ?? 0,
            open_timestamp: pair.pairCreatedAt ? Math.floor((pair.pairCreatedAt as number) / 1000) : 0,
            pool_type_str: pair.dexId as string ?? "",
            launchpad: "",
          } as GmgnRankToken);
        }
        return [...seen.values()];
      }
    }
  } catch { /* ignore */ }

  return [];
}

/**
 * Fetch info for a single token by address.
 * Tries GMGN first; falls back to DexScreener if GMGN is unreachable (e.g. Windows without proxy).
 */
export async function getTokenData(address: string): Promise<GmgnTokenInfo | null> {
  // Try GMGN first
  try {
    const res = await gmgnFetch(
      `/defi/quotation/v1/tokens/sol?address=${address}`
    );
    if (res.ok) {
      const data = await res.json();
      if (data.code === 0) {
        const tokens = data.data?.tokens ?? [];
        if (tokens.length > 0) return tokens[0];
      }
    }
  } catch { /* fall through to DexScreener */ }

  // Fallback: DexScreener (always accessible, no TLS restrictions)
  try {
    const res = await pfetch(`https://api.dexscreener.com/tokens/v1/solana/${address}`);
    if (!res.ok) return null;
    const pairs: Record<string, unknown>[] = await res.json();
    if (!Array.isArray(pairs) || pairs.length === 0) return null;
    // Pick best pair by liquidity
    const best = pairs
      .filter((p) => (p.chainId as string) === "solana")
      .sort((a, b) => ((b.liquidity as Record<string,number>)?.usd ?? 0) - ((a.liquidity as Record<string,number>)?.usd ?? 0))[0];
    if (!best) return null;
    const base = best.baseToken as Record<string, string>;
    const liq = (best.liquidity as Record<string,number>)?.usd ?? 0;
    const mc = (best.marketCap as number) ?? (best.fdv as number) ?? 0;
    return {
      address,
      symbol: base.symbol ?? "???",
      name: base.name ?? "Unknown",
      decimals: 9,
      logo: (best.info as Record<string,string>)?.imageUrl ?? "",
      biggest_pool_address: (best.pairAddress as string) ?? "",
      open_timestamp: best.pairCreatedAt ? Math.floor((best.pairCreatedAt as number) / 1000) : 0,
      creation_timestamp: 0,
      holder_count: 0,
      circulating_supply: 0,
      total_supply: 0,
      max_supply: 0,
      liquidity: liq,
      price: parseFloat(best.priceUsd as string) || 0,
      volume_24h: (best.volume as Record<string,number>)?.h24 ?? 0,
      swaps_24h: ((best.txns as Record<string,Record<string,number>>)?.h24?.buys ?? 0) + ((best.txns as Record<string,Record<string,number>>)?.h24?.sells ?? 0),
    } as GmgnTokenInfo;
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

  const combos: { timeframe: GmgnTimeframe; orderby: GmgnOrderBy; direction: "asc" | "desc" }[] = [
    // Desc sorts — highest first
    { timeframe: "24h", orderby: "marketcap", direction: "desc" },
    { timeframe: "24h", orderby: "volume", direction: "desc" },
    { timeframe: "24h", orderby: "swaps", direction: "desc" },
    { timeframe: "24h", orderby: "holder_count", direction: "desc" },
    { timeframe: "24h", orderby: "liquidity", direction: "desc" },
    { timeframe: "24h", orderby: "open_timestamp", direction: "desc" },
    { timeframe: "6h", orderby: "marketcap", direction: "desc" },
    { timeframe: "6h", orderby: "volume", direction: "desc" },
    { timeframe: "6h", orderby: "swaps", direction: "desc" },
    { timeframe: "6h", orderby: "open_timestamp", direction: "desc" },
    { timeframe: "1h", orderby: "marketcap", direction: "desc" },
    { timeframe: "1h", orderby: "volume", direction: "desc" },
    { timeframe: "1h", orderby: "swaps", direction: "desc" },
    { timeframe: "1h", orderby: "holder_count", direction: "desc" },
    { timeframe: "5m", orderby: "volume", direction: "desc" },
    { timeframe: "5m", orderby: "swaps", direction: "desc" },
    { timeframe: "1m", orderby: "volume", direction: "desc" },
    { timeframe: "1m", orderby: "swaps", direction: "desc" },
    // Asc sorts — catches lower-ranked tokens not in top-200 of desc queries
    { timeframe: "24h", orderby: "marketcap", direction: "asc" },
    { timeframe: "24h", orderby: "volume", direction: "asc" },
    { timeframe: "24h", orderby: "open_timestamp", direction: "asc" },
    { timeframe: "6h", orderby: "marketcap", direction: "asc" },
    { timeframe: "6h", orderby: "volume", direction: "asc" },
    { timeframe: "1h", orderby: "marketcap", direction: "asc" },
    { timeframe: "1h", orderby: "volume", direction: "asc" },
  ];

  const now = Date.now() / 1000; // GMGN timestamps are in seconds

  for (const { timeframe, orderby, direction } of combos) {
    try {
      const tokens = await getRankedTokens({
        timeframe,
        orderby,
        direction,
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
