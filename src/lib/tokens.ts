import { TokenData } from "@/types/token";
import { pfetch } from "./fetch";
import { upsertToken, addCategory, addSnapshot, getTokenAddressesByCategory } from "./db";
import { GmgnRankToken, GmgnTimeframe, GmgnOrderBy, getRankedTokens, getTokenData, fetchBulkTokens } from "./gmgn";

const MIN_MARKET_CAP = 3500;
const MAX_LIQUIDITY = 10_000_000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const SIX_MONTHS_MS = 6 * 30 * 24 * 60 * 60 * 1000;

function isPumpFunToken(address: string): boolean {
  return address.endsWith("pump");
}

/**
 * Convert a GMGN ranked token to our internal TokenData format.
 */
export function gmgnToTokenData(t: GmgnRankToken): TokenData {
  return {
    address: t.address,
    name: t.name ?? "Unknown",
    symbol: t.symbol ?? "???",
    imageUrl: t.logo || undefined,
    priceUsd: t.price ?? 0,
    priceChange5m: t.price_change_percent5m ?? 0,
    priceChange1h: t.price_change_percent1h ?? 0,
    priceChange6h: t.price_change_percent ?? 0, // GMGN uses this as the timeframe-relative change
    priceChange24h: t.price_change_percent ?? 0,
    volume5m: 0,
    volume1h: 0,
    volume6h: 0,
    volume24h: t.volume ?? 0,
    liquidity: t.liquidity ?? 0,
    marketCap: t.market_cap ?? 0,
    fdv: t.market_cap ?? 0,
    buys24h: t.buys ?? 0,
    sells24h: t.sells ?? 0,
    buys1h: 0,
    sells1h: 0,
    pairAddress: "",
    pairCreatedAt: t.open_timestamp ? t.open_timestamp * 1000 : 0,
    dexUrl: `https://gmgn.ai/sol/token/${t.address}`,
    dexId: t.pool_type_str || undefined,
    hasTiktok: false,
    socials: [],
    // Safety data from GMGN
    mintAuthorityDisabled: t.renounced_mint === 1,
    freezeAuthorityDisabled: t.renounced_freeze_account === 1,
  };
}

/**
 * Store a GMGN token as a migrated pair in the database.
 */
export function storeGmgnToken(t: GmgnRankToken): boolean {
  const addr = t.address;
  if (!addr) return false;

  upsertToken({
    address: addr,
    name: t.name ?? "Unknown",
    symbol: t.symbol ?? "???",
    imageUrl: t.logo || undefined,
    dexUrl: `https://gmgn.ai/sol/token/${addr}`,
    dexId: t.pool_type_str || undefined,
    pairCreatedAt: t.open_timestamp ? t.open_timestamp * 1000 : undefined,
    source: addr.endsWith("pump") ? "pump.fun" : (t.launchpad ?? "unknown"),
  });

  if (addr.endsWith("pump")) {
    addCategory(addr, "migrated", 1.0, t.pool_type_str ?? "gmgn");
  }

  addSnapshot(addr, {
    priceUsd: t.price ?? 0,
    marketCap: t.market_cap ?? 0,
    volume24h: t.volume ?? 0,
    liquidity: t.liquidity ?? 0,
    buys24h: t.buys ?? 0,
    sells24h: t.sells ?? 0,
  });

  return true;
}


/**
 * Search tokens via GMGN ranking + local DB keyword matching.
 */
export async function searchTokens(query: string): Promise<TokenData[]> {
  const q = query.toLowerCase();

  // Fetch a broad set of tokens from GMGN ranking
  const tokens = await getRankedTokens({
    timeframe: "24h",
    orderby: "volume",
    direction: "desc",
    limit: 200,
  });

  // Filter by query match in name/symbol/address
  const matched = tokens.filter((t) => {
    const name = (t.name ?? "").toLowerCase();
    const symbol = (t.symbol ?? "").toLowerCase();
    return name.includes(q) || symbol.includes(q) || t.address === query;
  });

  // Store and convert
  for (const t of matched) {
    storeGmgnToken(t);
  }

  return matched.map(gmgnToTokenData);
}

/**
 * Get token pairs data for a specific address via GMGN.
 */
export async function getTokenPairs(tokenAddress: string): Promise<TokenData[]> {
  const info = await getTokenData(tokenAddress);
  if (!info) return [];

  // Build a synthetic GmgnRankToken from the token info
  const token: TokenData = {
    address: info.address,
    name: info.name ?? "Unknown",
    symbol: info.symbol ?? "???",
    imageUrl: info.logo || undefined,
    priceUsd: info.price ?? 0,
    priceChange5m: 0,
    priceChange1h: 0,
    priceChange6h: 0,
    priceChange24h: 0,
    volume5m: 0,
    volume1h: 0,
    volume6h: 0,
    volume24h: info.volume_24h ?? 0,
    liquidity: info.liquidity ?? 0,
    marketCap: info.price && info.total_supply ? info.price * info.total_supply : 0,
    fdv: info.price && info.total_supply ? info.price * info.total_supply : 0,
    buys24h: 0,
    sells24h: 0,
    buys1h: 0,
    sells1h: 0,
    pairAddress: info.biggest_pool_address ?? "",
    pairCreatedAt: info.open_timestamp ? info.open_timestamp * 1000 : 0,
    dexUrl: `https://gmgn.ai/sol/token/${info.address}`,
    socials: [],
    mintAuthorityDisabled: info.renounced_mint === 1,
    freezeAuthorityDisabled: info.renounced_freeze_account === 1,
  };

  return [token];
}

export async function getRawPairs(tokenAddress: string): Promise<TokenData[]> {
  return getTokenPairs(tokenAddress);
}

/**
 * Trending tokens from GMGN - sorted by swaps (activity).
 */
export async function getTrendingTokens(): Promise<TokenData[]> {
  const tokens = await getRankedTokens({
    timeframe: "1h",
    orderby: "swaps",
    direction: "desc",
    limit: 50,
    filters: ["not_honeypot"],
  });

  const results: TokenData[] = [];
  for (const t of tokens) {
    if (t.chain !== "sol" && t.chain) continue;
    if ((t.market_cap ?? 0) < MIN_MARKET_CAP) continue;
    if ((t.liquidity ?? 0) <= 0 || (t.liquidity ?? 0) > MAX_LIQUIDITY) continue;

    storeGmgnToken(t);
    results.push(gmgnToTokenData(t));
  }

  return results.sort((a, b) => b.volume24h - a.volume24h);
}

/**
 * Old coins - bonded tokens >1 day old from GMGN.
 */
export async function getOldCoins(): Promise<TokenData[]> {
  const tokens = await fetchBulkTokens({
    limit: 200,
    minMc: MIN_MARKET_CAP,
    maxAgeMs: SIX_MONTHS_MS,
  });

  const now = Date.now() / 1000;
  const results: TokenData[] = [];

  for (const t of tokens) {
    // Must be >1 day old
    if (t.open_timestamp && (now - t.open_timestamp) < ONE_DAY_MS / 1000) continue;
    // Must be PumpFun-originated
    if (!isPumpFunToken(t.address) && !(t.launchpad ?? "").toLowerCase().includes("pump")) continue;
    if ((t.liquidity ?? 0) <= 0 || (t.liquidity ?? 0) > MAX_LIQUIDITY) continue;
    if ((t.market_cap ?? 0) < MIN_MARKET_CAP) continue;

    storeGmgnToken(t);
    results.push(gmgnToTokenData(t));
  }

  return results.sort((a, b) => b.marketCap - a.marketCap);
}

const PUMPFUN_API = "https://frontend-api-v3.pump.fun";
const PUMPFUN_HEADERS = {
  "User-Agent": "Mozilla/5.0",
  Accept: "application/json",
  Origin: "https://pump.fun",
  Referer: "https://pump.fun/",
};

interface PumpFunCoin {
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

async function fetchPumpFunCoin(mint: string): Promise<PumpFunCoin | null> {
  try {
    const res = await pfetch(`${PUMPFUN_API}/coins/${mint}`, {
      headers: PUMPFUN_HEADERS,
    });
    if (!res.ok) return null;
    return (await res.json()) as PumpFunCoin;
  } catch {
    return null;
  }
}

function pumpFunCoinHasGithub(coin: PumpFunCoin): { found: boolean; url?: string } {
  const website = coin.website ?? "";
  const description = coin.description ?? "";
  if (website.includes("github.com")) return { found: true, url: website };
  const ghMatch = description.match(/https?:\/\/github\.com\/[^\s)]+/);
  if (ghMatch) return { found: true, url: ghMatch[0] };
  return { found: false };
}

const KNOWN_GITHUB_COINS: string[] = [
  "5L2MNMsMfNbR4txdGH35hEcU3ykfMgdNrBbCE24wpump",
  "H1YMgqMkjNnkNRJSuxP3Bbt16yMrRjJ9YBRzNJbpump",
  "72XegmCRFpFZSaHvvPS5gfiP5GCrUYmn7JYsTWpump",
  "DFs6jcPpMnf1RCsso39GK6EBcn7fYqHF1NGhbMRpump",
  "4FYRbKiRcHYzHTW9UrSSbkGH3iR51AddGvaFJTsDpump",
  "79iLB2MuLNfpu7KaX8FB55XWbLpFj4RH7gnGJhV8pump",
];

const KNOWN_GITHUB_CREATORS: string[] = [
  "F92Meoc5FBazvXvX9XX7C5J2MbNxFFDhwSEyWQMv1hgV",
];

/**
 * GitHub coins - PumpFun tokens with GitHub links.
 * Uses GMGN for market data + PumpFun API for GitHub detection.
 */
export async function getGithubCoins(): Promise<TokenData[]> {
  const candidateAddresses = new Set<string>(KNOWN_GITHUB_COINS);

  // Pull from DB migrated coins
  const { getTokenAddressesByCategory } = await import("./db");
  const migratedAddrs = getTokenAddressesByCategory("migrated");
  for (const addr of migratedAddrs.slice(0, 200)) {
    candidateAddresses.add(addr);
  }

  const uniqueAddrs = Array.from(candidateAddresses);
  const pumpFunGithubUrls = new Map<string, string>();
  const tokenDataMap = new Map<string, TokenData>();
  const BATCH_SIZE = 10;

  for (let i = 0; i < uniqueAddrs.length; i += BATCH_SIZE) {
    const batch = uniqueAddrs.slice(i, i + BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.flatMap((addr) => [
        // GMGN token data
        getTokenData(addr).then((info) => ({
          type: "gmgn" as const,
          addr,
          info,
        })),
        // PumpFun API for GitHub detection
        fetchPumpFunCoin(addr).then((coin) => ({
          type: "pumpfun" as const,
          addr,
          coin,
        })),
      ])
    );

    for (const result of results) {
      if (result.status !== "fulfilled") continue;
      const val = result.value;
      if (val.type === "gmgn" && val.info) {
        const info = val.info;
        tokenDataMap.set(val.addr, {
          address: info.address,
          name: info.name ?? "Unknown",
          symbol: info.symbol ?? "???",
          imageUrl: info.logo || undefined,
          priceUsd: info.price ?? 0,
          priceChange5m: 0,
          priceChange1h: 0,
          priceChange6h: 0,
          priceChange24h: 0,
          volume5m: 0,
          volume1h: 0,
          volume6h: 0,
          volume24h: info.volume_24h ?? 0,
          liquidity: info.liquidity ?? 0,
          marketCap: info.price && info.total_supply ? info.price * info.total_supply : 0,
          fdv: info.price && info.total_supply ? info.price * info.total_supply : 0,
          buys24h: 0,
          sells24h: 0,
          buys1h: 0,
          sells1h: 0,
          pairAddress: info.biggest_pool_address ?? "",
          pairCreatedAt: info.open_timestamp ? info.open_timestamp * 1000 : 0,
          dexUrl: `https://gmgn.ai/sol/token/${info.address}`,
          socials: [],
          mintAuthorityDisabled: info.renounced_mint === 1,
          freezeAuthorityDisabled: info.renounced_freeze_account === 1,
        });
      } else if (val.type === "pumpfun" && val.coin) {
        const gh = pumpFunCoinHasGithub(val.coin);
        if (gh.found && gh.url) {
          pumpFunGithubUrls.set(val.addr, gh.url);
        }
        if (KNOWN_GITHUB_CREATORS.includes(val.coin.creator)) {
          pumpFunGithubUrls.set(val.addr, gh.url ?? "");
        }
      }
    }

    await new Promise((r) => setTimeout(r, 300));
  }

  // Filter for tokens with GitHub links
  const knownSet = new Set(KNOWN_GITHUB_COINS);
  const results: TokenData[] = [];

  for (const [addr, token] of tokenDataMap) {
    if (!knownSet.has(addr) && !pumpFunGithubUrls.has(addr)) continue;
    if (token.liquidity <= 0 || token.liquidity > MAX_LIQUIDITY) continue;

    token.isGithub = true;
    token.githubUrl = pumpFunGithubUrls.get(addr);
    results.push(token);
  }

  return results.sort((a, b) => b.marketCap - a.marketCap);
}

/**
 * TikTok coins - served from DB + GMGN live data.
 */
export async function getTiktokCoins(): Promise<TokenData[]> {
  const { getTokenAddressesByCategory } = await import("./db");
  const tiktokAddrs = getTokenAddressesByCategory("tiktok-meme");

  const results: TokenData[] = [];
  const BATCH_SIZE = 5;

  for (let i = 0; i < tiktokAddrs.length; i += BATCH_SIZE) {
    const batch = tiktokAddrs.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(
      batch.map((addr) => getTokenPairs(addr))
    );

    for (const result of batchResults) {
      if (result.status === "fulfilled" && result.value.length > 0) {
        results.push(result.value[0]);
      }
    }

    await new Promise((r) => setTimeout(r, 300));
  }

  return results
    .filter((t) => t.liquidity > 0 && t.marketCap >= MIN_MARKET_CAP)
    .sort((a, b) => b.marketCap - a.marketCap);
}

/**
 * Reversal coins - tokens showing significant MC increase with volume.
 * Uses GMGN price change data for detection.
 */
export async function getReversalCoins(): Promise<TokenData[]> {
  // Fetch tokens sorted by different criteria to catch reversals
  const [byVolume, bySwaps] = await Promise.all([
    getRankedTokens({
      timeframe: "1h",
      orderby: "volume",
      direction: "desc",
      limit: 100,
      filters: ["not_honeypot"],
    }),
    getRankedTokens({
      timeframe: "6h",
      orderby: "swaps",
      direction: "desc",
      limit: 100,
      filters: ["not_honeypot"],
    }),
  ]);

  // Merge and deduplicate
  const seen = new Map<string, GmgnRankToken>();
  for (const t of [...byVolume, ...bySwaps]) {
    if (!seen.has(t.address)) seen.set(t.address, t);
  }

  const results: TokenData[] = [];
  for (const t of seen.values()) {
    if ((t.market_cap ?? 0) < MIN_MARKET_CAP) continue;
    if ((t.liquidity ?? 0) <= 0 || (t.liquidity ?? 0) > MAX_LIQUIDITY) continue;
    if (!isPumpFunToken(t.address) && !(t.launchpad ?? "").toLowerCase().includes("pump")) continue;

    const change1h = t.price_change_percent1h ?? 0;
    const change5m = t.price_change_percent5m ?? 0;
    const mc = t.market_cap ?? 0;
    const vol = t.volume ?? 0;

    // Reversal detection
    const hasStrongPump = change1h > 15 || change5m > 10;
    const hasVolume = vol > mc * 0.05;
    const hasPositiveMomentum = change5m > 0;

    if (hasStrongPump && hasVolume && hasPositiveMomentum) {
      const token = gmgnToTokenData(t);
      token.isReversal = true;

      const volRatio = vol / Math.max(mc, 1);
      token.reversalMultiple = Math.round(volRatio * 100) / 100;

      if (change1h > 50) {
        token.isAlert = true;
        token.alertReason = `Breakout! Price surged ${change1h.toFixed(0)}% in 1h`;
      } else if (change5m > 20) {
        token.isAlert = true;
        token.alertReason = `Pumping ${change5m.toFixed(0)}% in 5m with volume`;
      }

      storeGmgnToken(t);
      results.push(token);
    }
  }

  return results.sort((a, b) => {
    if (a.isAlert && !b.isAlert) return -1;
    if (!a.isAlert && b.isAlert) return 1;
    return b.volume1h - a.volume1h;
  });
}

/**
 * Bonk ecosystem coins from GMGN.
 */
export async function getBonkCoins(): Promise<TokenData[]> {
  // Fetch broad token set and filter for bonk
  const tokens = await getRankedTokens({
    timeframe: "24h",
    orderby: "volume",
    direction: "desc",
    limit: 200,
  });

  const results: TokenData[] = [];
  for (const t of tokens) {
    const name = (t.name ?? "").toLowerCase();
    const symbol = (t.symbol ?? "").toLowerCase();
    if (!name.includes("bonk") && !symbol.includes("bonk")) continue;
    if ((t.market_cap ?? 0) < MIN_MARKET_CAP) continue;
    if ((t.liquidity ?? 0) <= 0 || (t.liquidity ?? 0) > MAX_LIQUIDITY) continue;

    storeGmgnToken(t);
    results.push(gmgnToTokenData(t));
  }

  // Also pull bonk coins from DB that might not be in current ranking
  const { getTokenAddressesByCategory } = await import("./db");
  const bonkAddrs = getTokenAddressesByCategory("bonk");
  const seenAddrs = new Set(results.map((r) => r.address));

  for (const addr of bonkAddrs.filter((a) => !seenAddrs.has(a)).slice(0, 50)) {
    const pairs = await getTokenPairs(addr);
    if (pairs.length > 0 && pairs[0].liquidity > 0 && pairs[0].marketCap >= MIN_MARKET_CAP) {
      results.push(pairs[0]);
    }
  }

  return results.sort((a, b) => b.marketCap - a.marketCap);
}

/**
 * BagsApp coins — bags.fm direct API is dead; source via DexScreener search + DB.
 */
export async function getBagsCoins(): Promise<TokenData[]> {
  const seenAddrs = new Set<string>();
  const results: TokenData[] = [];

  // 1. GMGN - pull broad set and filter by bags launchpad
  const gmgnCombos: { timeframe: GmgnTimeframe; orderby: GmgnOrderBy }[] = [
    { timeframe: "24h", orderby: "volume" },
    { timeframe: "24h", orderby: "marketcap" },
    { timeframe: "6h", orderby: "volume" },
    { timeframe: "1h", orderby: "swaps" },
  ];
  const gmgnSeen = new Map<string, GmgnRankToken>();
  for (const { timeframe, orderby } of gmgnCombos) {
    try {
      const tokens = await getRankedTokens({ timeframe, orderby, direction: "desc", limit: 200 });
      for (const t of tokens) {
        if (!gmgnSeen.has(t.address)) gmgnSeen.set(t.address, t);
      }
    } catch { /* ignore */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  for (const t of gmgnSeen.values()) {
    const launchpad = (t.launchpad ?? "").toLowerCase();
    const pool = (t.pool_type_str ?? "").toLowerCase();
    if (!launchpad.includes("bag") && !pool.includes("bag")) continue;
    if ((t.market_cap ?? 0) < MIN_MARKET_CAP) continue;
    if ((t.liquidity ?? 0) <= 0 || (t.liquidity ?? 0) > MAX_LIQUIDITY) continue;
    storeGmgnToken(t);
    const token = gmgnToTokenData(t);
    token.isBags = true;
    results.push(token);
    seenAddrs.add(t.address);
  }

  // 2. DexScreener search for bags-related tokens
  const bagsQueries = ["bags", "bags.fm", "bagsapp"];
  for (const query of bagsQueries) {
    try {
      const res = await pfetch(
        `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`
      );
      if (!res.ok) continue;
      const data = await res.json();
      for (const pair of (data.pairs ?? [])) {
        if (pair.chainId !== "solana") continue;
        const addr = pair.baseToken.address;
        if (seenAddrs.has(addr)) continue;
        const mc = pair.marketCap ?? pair.fdv ?? 0;
        const liq = pair.liquidity?.usd ?? 0;
        if (mc < MIN_MARKET_CAP || liq <= 0 || liq > MAX_LIQUIDITY) continue;
        seenAddrs.add(addr);
        results.push({
          address: addr,
          name: pair.baseToken.name || "Unknown",
          symbol: pair.baseToken.symbol || "???",
          imageUrl: pair.info?.imageUrl,
          priceUsd: parseFloat(pair.priceUsd) || 0,
          priceChange5m: 0, priceChange1h: 0, priceChange6h: 0, priceChange24h: 0,
          volume5m: 0, volume1h: 0, volume6h: 0,
          volume24h: pair.volume?.h24 ?? 0,
          liquidity: liq, marketCap: mc, fdv: mc,
          buys24h: pair.txns?.h24?.buys ?? 0, sells24h: pair.txns?.h24?.sells ?? 0,
          buys1h: 0, sells1h: 0,
          pairAddress: pair.pairAddress ?? "",
          pairCreatedAt: pair.pairCreatedAt ?? 0,
          dexUrl: `https://gmgn.ai/sol/token/${addr}`,
          socials: [],
          isBags: true,
        });
      }
      await new Promise((r) => setTimeout(r, 300));
    } catch { /* skip */ }
  }

  // 3. Pull from DB bags category
  const { getTokenAddressesByCategory } = await import("./db");
  const bagsDbAddrs = getTokenAddressesByCategory("bags");
  for (const addr of bagsDbAddrs.filter((a) => !seenAddrs.has(a)).slice(0, 100)) {
    const pairs = await getTokenPairs(addr);
    if (pairs.length > 0 && pairs[0].liquidity > 0 && pairs[0].marketCap >= MIN_MARKET_CAP) {
      pairs[0].isBags = true;
      results.push(pairs[0]);
      seenAddrs.add(addr);
    }
  }

  return results.sort((a, b) => b.marketCap - a.marketCap);
}

/**
 * Fetch safety data from RugCheck API for a token.
 */
async function fetchRugCheck(address: string): Promise<{
  score: number;
  mintAuthorityDisabled: boolean;
  freezeAuthorityDisabled: boolean;
} | null> {
  try {
    const res = await pfetch(`https://api.rugcheck.xyz/v1/tokens/${address}/report`);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      score: data.score ?? 0,
      mintAuthorityDisabled: data.mintAuthority === null || data.mintAuthority === "None",
      freezeAuthorityDisabled: data.freezeAuthority === null || data.freezeAuthority === "None",
    };
  } catch {
    return null;
  }
}

/**
 * Enrich an array of tokens with RugCheck safety data.
 */
export async function enrichWithSafety(tokens: TokenData[]): Promise<TokenData[]> {
  const BATCH = 5;
  for (let i = 0; i < tokens.length; i += BATCH) {
    const batch = tokens.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.map((t) => fetchRugCheck(t.address))
    );
    for (let j = 0; j < results.length; j++) {
      const r = results[j];
      if (r.status === "fulfilled" && r.value) {
        tokens[i + j].rugScore = r.value.score;
        tokens[i + j].mintAuthorityDisabled = r.value.mintAuthorityDisabled;
        tokens[i + j].freezeAuthorityDisabled = r.value.freezeAuthorityDisabled;
      }
    }
  }
  return tokens;
}

// AI-related keywords for category detection
const AI_KEYWORDS = ["ai", "gpt", "llm", "neural", "robot", "agent", "artificial", "intelligence", "deepseek", "openai", "midjourney", "chatbot", "claude", "copilot", "diffusion"];

/**
 * Discover tokens with advanced filters: launchpad, pool type, category, MC range, age, sort.
 */
export async function getDiscoverTokens(opts: {
  launchpads?: string[];
  poolTypes?: string[];
  categories?: string[];
  minMc?: number;
  maxMc?: number;
  maxAgeHours?: number;
  minAgeHours?: number;
  sortBy?: GmgnOrderBy;
  sortDir?: "asc" | "desc";
  limit?: number;
}): Promise<TokenData[]> {
  const {
    launchpads = [],
    poolTypes = [],
    categories = [],
    minMc,
    maxMc,
    maxAgeHours,
    minAgeHours,
    sortBy = "marketcap",
    sortDir = "desc",
    limit = 200,
  } = opts;

  // Resolve DB-backed category addresses
  let categoryAddresses: Set<string> | null = null;
  const dbCategories = categories.filter((c) => c !== "ai");
  if (dbCategories.length > 0) {
    const sets = dbCategories.map((c) => getTokenAddressesByCategory(c));
    categoryAddresses = new Set(sets.flat());
  }

  // Pick timeframe based on requested age range
  const timeframe: GmgnTimeframe =
    maxAgeHours && maxAgeHours <= 1 ? "1h" :
    maxAgeHours && maxAgeHours <= 6 ? "6h" : "24h";

  const tokens = await getRankedTokens({
    timeframe,
    orderby: sortBy,
    direction: sortDir,
    limit,
    filters: ["not_honeypot"],
  });

  const now = Date.now() / 1000;
  const results: TokenData[] = [];

  for (const t of tokens) {
    if (!t.address) continue;
    if ((t.liquidity ?? 0) <= 0) continue;

    // Launchpad filter
    if (launchpads.length > 0) {
      const lp = (t.launchpad ?? "").toLowerCase();
      const isPump = t.address.endsWith("pump") || lp.includes("pump");
      const matches = launchpads.some((id) => {
        if (id === "pump.fun") return isPump;
        if (id === "bags.fm") return lp.includes("bag");
        if (id === "moonshot") return lp.includes("moonshot");
        if (id === "letsbonk") return lp.includes("bonk") || lp.includes("letsbonk");
        return lp.includes(id.toLowerCase());
      });
      if (!matches) continue;
    }

    // Pool type filter
    if (poolTypes.length > 0) {
      const pt = (t.pool_type_str ?? "").toLowerCase();
      if (!poolTypes.some((id) => pt.includes(id.toLowerCase()))) continue;
    }

    // Market cap range
    if (minMc !== undefined && (t.market_cap ?? 0) < minMc) continue;
    if (maxMc !== undefined && (t.market_cap ?? 0) > maxMc) continue;

    // Age filter
    if (t.open_timestamp) {
      const ageHours = (now - t.open_timestamp) / 3600;
      if (maxAgeHours !== undefined && ageHours > maxAgeHours) continue;
      if (minAgeHours !== undefined && ageHours < minAgeHours) continue;
    }

    // Category filter
    if (categories.length > 0) {
      let match = false;
      if (categoryAddresses?.has(t.address)) match = true;
      if (!match && categories.includes("ai")) {
        const text = `${t.name ?? ""} ${t.symbol ?? ""}`.toLowerCase();
        match = AI_KEYWORDS.some((k) => text.includes(k));
      }
      if (!match) continue;
    }

    storeGmgnToken(t);
    results.push(gmgnToTokenData(t));
  }

  return results;
}
