// Browser-safe GMGN client — routes all requests through /api/proxy
// so Cloudflare sees a real browser making the request.

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

// Build a proxy URL that forwards through /api/proxy
function proxyUrl(host: string, path: string): string {
  return `/api/proxy?host=${encodeURIComponent(host)}&path=${encodeURIComponent(path)}`;
}

async function gmgnFetch(path: string): Promise<Response> {
  return fetch(proxyUrl("gmgn", path));
}

async function dexFetch(path: string): Promise<Response> {
  return fetch(proxyUrl("dexscreener", path));
}

async function pumpFetch(path: string): Promise<Response> {
  return fetch(proxyUrl("pumpfun", path));
}

// DexScreener fallback — always accessible
async function dexScreenerFallback(limit = 50): Promise<GmgnRankToken[]> {
  try {
    const [boostRes, profileRes] = await Promise.allSettled([
      dexFetch("/token-boosts/top/v1"),
      dexFetch("/token-profiles/latest/v1"),
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
    if (addrs.size === 0) return [];
    const batch = [...addrs].slice(0, Math.min(limit, 30)).join(",");
    const pairRes = await dexFetch(`/tokens/v1/solana/${batch}`);
    if (!pairRes.ok) return [];
    const pairs: Record<string, unknown>[] = await pairRes.json();
    const seen = new Map<string, GmgnRankToken>();
    for (const pair of Array.isArray(pairs) ? pairs : []) {
      if ((pair.chainId as string) !== "solana") continue;
      const addr = (pair.baseToken as Record<string, string>)?.address;
      if (!addr || seen.has(addr)) continue;
      const liq = (pair.liquidity as Record<string, number>)?.usd ?? 0;
      const mc = (pair.marketCap as number) ?? 0;
      if (mc < 3500 || liq <= 0) continue;
      seen.set(addr, {
        address: addr,
        chain: "sol",
        symbol: (pair.baseToken as Record<string, string>).symbol ?? "???",
        name: (pair.baseToken as Record<string, string>).name ?? "Unknown",
        logo: (pair.info as Record<string, string>)?.imageUrl ?? "",
        price: parseFloat(pair.priceUsd as string) || 0,
        price_change_percent: (pair.priceChange as Record<string, number>)?.h24 ?? 0,
        price_change_percent1m: 0,
        price_change_percent5m: (pair.priceChange as Record<string, number>)?.m5 ?? 0,
        price_change_percent1h: (pair.priceChange as Record<string, number>)?.h1 ?? 0,
        market_cap: mc,
        liquidity: liq,
        volume: (pair.volume as Record<string, number>)?.h24 ?? 0,
        total_supply: 0,
        initial_liquidity: 0,
        swaps:
          ((pair.txns as Record<string, Record<string, number>>)?.h24?.buys ?? 0) +
          ((pair.txns as Record<string, Record<string, number>>)?.h24?.sells ?? 0),
        buys: (pair.txns as Record<string, Record<string, number>>)?.h24?.buys ?? 0,
        sells: (pair.txns as Record<string, Record<string, number>>)?.h24?.sells ?? 0,
        holder_count: 0,
        renounced_mint: 0,
        renounced_freeze_account: 0,
        burn_ratio: "",
        burn_status: "",
        is_show_alert: false,
        top_10_holder_rate: 0,
        bluechip_owner_percentage: 0,
        sniper_count: 0,
        smart_degen_count: 0,
        renowned_count: 0,
        rat_trader_amount_rate: 0,
        creator: "",
        creator_token_status: "",
        creator_close: false,
        launchpad: "",
        launchpad_status: 0,
        open_timestamp: pair.pairCreatedAt
          ? Math.floor((pair.pairCreatedAt as number) / 1000)
          : 0,
        creation_timestamp: 0,
        twitter_username: "",
        hot_level: 0,
        pool_type_str: pair.dexId as string ?? "",
      } as GmgnRankToken);
    }
    return [...seen.values()];
  } catch {
    return [];
  }
}

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
  } catch {
    // fall through to DexScreener
  }

  return dexScreenerFallback(limit);
}

export async function getTokenInfo(address: string): Promise<GmgnTokenInfo | null> {
  // Try GMGN
  try {
    const res = await gmgnFetch(`/defi/quotation/v1/tokens/sol?address=${address}`);
    if (res.ok) {
      const data = await res.json();
      if (data.code === 0) {
        const tokens = data.data?.tokens ?? [];
        if (tokens.length > 0) return tokens[0] as GmgnTokenInfo;
      }
    }
  } catch {
    // fall through
  }

  // DexScreener fallback
  try {
    const res = await dexFetch(`/tokens/v1/solana/${address}`);
    if (!res.ok) return null;
    const pairs: Record<string, unknown>[] = await res.json();
    if (!Array.isArray(pairs) || pairs.length === 0) return null;
    const best = pairs
      .filter((p) => (p.chainId as string) === "solana")
      .sort(
        (a, b) =>
          ((b.liquidity as Record<string, number>)?.usd ?? 0) -
          ((a.liquidity as Record<string, number>)?.usd ?? 0)
      )[0];
    if (!best) return null;
    const base = best.baseToken as Record<string, string>;
    const liq = (best.liquidity as Record<string, number>)?.usd ?? 0;
    const mc = (best.marketCap as number) ?? 0;
    const info = best.info as Record<string, unknown> | undefined;
    return {
      address: base.address,
      symbol: base.symbol ?? "???",
      name: base.name ?? "Unknown",
      decimals: 9,
      logo: (info?.imageUrl as string) ?? "",
      biggest_pool_address: (best.pairAddress as string) ?? "",
      open_timestamp: best.pairCreatedAt
        ? Math.floor((best.pairCreatedAt as number) / 1000)
        : 0,
      creation_timestamp: 0,
      holder_count: 0,
      circulating_supply: 0,
      total_supply: 0,
      max_supply: 0,
      liquidity: liq,
      price: parseFloat(best.priceUsd as string) || 0,
      volume_24h: (best.volume as Record<string, number>)?.h24 ?? 0,
      swaps_24h:
        ((best.txns as Record<string, Record<string, number>>)?.h24?.buys ?? 0) +
        ((best.txns as Record<string, Record<string, number>>)?.h24?.sells ?? 0),
    } as GmgnTokenInfo;
  } catch {
    return null;
  }
}

export interface PumpFunCoin {
  mint: string;
  name: string;
  symbol: string;
  description?: string;
  image_uri?: string;
  website?: string;
  twitter?: string;
  telegram?: string;
  creator: string;
  created_timestamp: number;
  complete: boolean;
  usd_market_cap?: number;
  market_cap?: number;
}

export async function fetchPumpFunCoin(mint: string): Promise<PumpFunCoin | null> {
  try {
    const res = await pumpFetch(`/coins/${mint}`);
    if (!res.ok) return null;
    return (await res.json()) as PumpFunCoin;
  } catch {
    return null;
  }
}

export function pumpFunCoinHasGithub(coin: PumpFunCoin): { found: boolean; url?: string } {
  const website = coin.website ?? "";
  const description = coin.description ?? "";
  if (website.includes("github.com")) return { found: true, url: website };
  const ghMatch = description.match(/https?:\/\/github\.com\/[^\s)]+/);
  if (ghMatch) return { found: true, url: ghMatch[0] };
  return { found: false };
}
