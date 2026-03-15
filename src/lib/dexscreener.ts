import { DexScreenerPair, TokenData } from "@/types/token";
import { pfetch } from "./fetch";
import { upsertToken, addCategory, addSnapshot } from "./db";

const BASE_URL = "https://api.dexscreener.com";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const MIN_MARKET_CAP = 6000;
const MAX_LIQUIDITY = 10_000_000; // $10M max - anything above is likely scam/fake data

/**
 * Check if a token is a genuine PumpFun-launched coin.
 * PumpFun token addresses always end with "pump".
 */
function isPumpFunToken(address: string): boolean {
  return address.endsWith("pump");
}

/**
 * Validate that a pair has reasonable liquidity (filters scam coins with fake $100M+ liq).
 */
function hasReasonableLiquidity(pair: DexScreenerPair): boolean {
  const liq = pair.liquidity?.usd ?? 0;
  return liq > 0 && liq <= MAX_LIQUIDITY;
}

export function pairToTokenData(pair: DexScreenerPair): TokenData {
  const socials = pair.info?.socials ?? [];
  const websites = pair.info?.websites ?? [];
  const tiktokSocial = socials.find(
    (s) => s.type === "tiktok" || s.url?.includes("tiktok.com")
  );
  const githubSocial = socials.find(
    (s) => s.type === "github" || s.url?.includes("github.com")
  );
  const githubWebsite = websites.find((w) => w.url?.includes("github.com"));
  const githubLink = githubSocial?.url ?? githubWebsite?.url;

  return {
    address: pair.baseToken.address,
    name: pair.baseToken.name,
    symbol: pair.baseToken.symbol,
    imageUrl: pair.info?.imageUrl,
    priceUsd: parseFloat(pair.priceUsd) || 0,
    priceChange5m: pair.priceChange?.m5 ?? 0,
    priceChange1h: pair.priceChange?.h1 ?? 0,
    priceChange6h: pair.priceChange?.h6 ?? 0,
    priceChange24h: pair.priceChange?.h24 ?? 0,
    volume5m: pair.volume?.m5 ?? 0,
    volume1h: pair.volume?.h1 ?? 0,
    volume6h: pair.volume?.h6 ?? 0,
    volume24h: pair.volume?.h24 ?? 0,
    liquidity: pair.liquidity?.usd ?? 0,
    marketCap: pair.marketCap ?? 0,
    fdv: pair.fdv ?? 0,
    buys24h: pair.txns?.h24?.buys ?? 0,
    sells24h: pair.txns?.h24?.sells ?? 0,
    buys1h: pair.txns?.h1?.buys ?? 0,
    sells1h: pair.txns?.h1?.sells ?? 0,
    pairAddress: pair.pairAddress,
    pairCreatedAt: pair.pairCreatedAt,
    dexUrl: pair.url,
    dexId: pair.dexId,
    hasTiktok: !!tiktokSocial,
    tiktokUrl: tiktokSocial?.url,
    isGithub: !!githubLink,
    githubUrl: githubLink,
    socials,
  };
}

export async function searchTokens(query: string): Promise<TokenData[]> {
  const res = await pfetch(`${BASE_URL}/latest/dex/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error(`DexScreener search failed: ${res.status}`);
  const data = await res.json();
  const pairs: DexScreenerPair[] = data.pairs ?? [];
  return pairs
    .filter((p) => p.chainId === "solana")
    .map(pairToTokenData);
}

export async function getRawPairs(tokenAddress: string): Promise<DexScreenerPair[]> {
  const res = await pfetch(`${BASE_URL}/tokens/v1/solana/${tokenAddress}`);
  if (!res.ok) throw new Error(`DexScreener token lookup failed: ${res.status}`);
  const pairs: DexScreenerPair[] = await res.json();
  return pairs ?? [];
}

export async function getTokenPairs(tokenAddress: string): Promise<TokenData[]> {
  const pairs = await getRawPairs(tokenAddress);
  storeMigratedFromPairs(pairs);
  return pairs.map(pairToTokenData);
}

export async function getTrendingTokens(): Promise<TokenData[]> {
  const res = await pfetch(`${BASE_URL}/token-boosts/top/v1`);
  if (!res.ok) throw new Error(`DexScreener trending failed: ${res.status}`);
  const boosts = await res.json();

  const solanaTokens = boosts
    .filter((b: { chainId: string }) => b.chainId === "solana")
    .map((b: { tokenAddress: string }) => b.tokenAddress)
    .filter((addr: string, i: number, arr: string[]) => arr.indexOf(addr) === i)
    .slice(0, 20);

  if (solanaTokens.length === 0) return [];

  const allTokenData: TokenData[] = [];
  const BATCH_SIZE = 10;

  for (let i = 0; i < solanaTokens.length; i += BATCH_SIZE) {
    const batch = solanaTokens.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((addr: string) => getTokenPairs(addr))
    );
    for (const result of results) {
      if (result.status === "fulfilled" && result.value.length > 0) {
        const best = result.value.sort((a: TokenData, b: TokenData) => b.liquidity - a.liquidity)[0];
        allTokenData.push(best);
      }
    }
  }

  return allTokenData;
}

/**
 * Fetch old coins from Raydium and PumpSwap (>1 day old, >6k MC)
 * Uses DexScreener search + DB migrated coins for coverage
 */
export async function getOldCoins(): Promise<TokenData[]> {
  const queries = [
    "raydium",
    "pumpswap",
  ];

  const allPairs: DexScreenerPair[] = [];

  for (const query of queries) {
    try {
      const res = await pfetch(`${BASE_URL}/latest/dex/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) continue;
      const data = await res.json();
      const pairs: DexScreenerPair[] = data.pairs ?? [];
      allPairs.push(...pairs);
    } catch {
      // Skip failed queries
    }
  }

  // Pull old migrated coins from DB for better coverage of early gems
  const { getTokenAddressesByCategory } = await import("./db");
  const migratedAddrs = getTokenAddressesByCategory("migrated");
  const seenAddrs = new Set(allPairs.map((p) => p.baseToken.address));
  const dbOnlyAddrs = migratedAddrs.filter((a) => !seenAddrs.has(a)).slice(0, 100);

  const BATCH_SIZE_DB = 10;
  for (let i = 0; i < dbOnlyAddrs.length; i += BATCH_SIZE_DB) {
    const batch = dbOnlyAddrs.slice(i, i + BATCH_SIZE_DB);
    const results = await Promise.allSettled(
      batch.map(async (addr: string) => {
        const res = await pfetch(`${BASE_URL}/tokens/v1/solana/${addr}`);
        if (!res.ok) return [];
        const pairs: DexScreenerPair[] = await res.json();
        return pairs ?? [];
      })
    );
    for (const result of results) {
      if (result.status === "fulfilled") {
        allPairs.push(...result.value);
      }
    }
  }

  // Store any migrated coins we found along the way
  storeMigratedFromPairs(allPairs);

  const now = Date.now();

  // Filter: Solana, PumpFun-launched, Raydium/PumpSwap, >1 day old, >6k MC, reasonable liquidity
  const filtered = allPairs.filter((p) => {
    if (p.chainId !== "solana") return false;
    if (!isPumpFunToken(p.baseToken.address)) return false;
    const dex = p.dexId?.toLowerCase() ?? "";
    if (!dex.includes("raydium") && !dex.includes("pumpswap") && !dex.includes("pump")) return false;
    if (!p.pairCreatedAt || now - p.pairCreatedAt < ONE_DAY_MS) return false;
    if ((p.marketCap ?? 0) < MIN_MARKET_CAP) return false;
    if (!hasReasonableLiquidity(p)) return false;
    return true;
  });

  // Deduplicate by base token address, keep highest liquidity
  const tokenMap = new Map<string, DexScreenerPair>();
  for (const pair of filtered) {
    const existing = tokenMap.get(pair.baseToken.address);
    if (!existing || (pair.liquidity?.usd ?? 0) > (existing.liquidity?.usd ?? 0)) {
      tokenMap.set(pair.baseToken.address, pair);
    }
  }

  return Array.from(tokenMap.values())
    .map(pairToTokenData)
    .sort((a, b) => b.marketCap - a.marketCap);
}

/**
 * Known PumpFun tokens with creator fees redirected to GitHub accounts.
 * These are coins where the fee sharing config sends fees to a GitHub user
 * via PumpFun's Social Fee PDA system. The on-chain data isn't exposed via
 * any REST API, so we maintain a seed list of known addresses.
 */
const KNOWN_GITHUB_COINS: string[] = [
  "5L2MNMsMfNbR4txdGH35hEcU3ykfMgdNrBbCE24wpump", // ClawVault
  "H1YMgqMkjNnkNRJSuxP3Bbt16yMrRjJ9YBRzNJbpump", // MiroFish
  "72XegmCRFpFZSaHvvPS5gfiP5GCrUYmn7JYsTWpump",   // GitNexus
  "DFs6jcPpMnf1RCsso39GK6EBcn7fYqHF1NGhbMRpump",   // Project AIRI
  "4FYRbKiRcHYzHTW9UrSSbkGH3iR51AddGvaFJTsDpump",   // (known GitHub fee coin)
  "79iLB2MuLNfpu7KaX8FB55XWbLpFj4RH7gnGJhV8pump",   // (known GitHub fee coin)
];

/**
 * Known creators who use PumpFun's GitHub fee sharing feature.
 * Coins from these creators likely have fees redirected to GitHub.
 */
const KNOWN_GITHUB_CREATORS: string[] = [
  "F92Meoc5FBazvXvX9XX7C5J2MbNxFFDhwSEyWQMv1hgV", // MiroFish/GitNexus/AIRI creator
];

/**
 * Check if a pair has a GitHub social link on DexScreener
 */
function hasGithubLink(pair: DexScreenerPair): { found: boolean; url?: string } {
  const socials = pair.info?.socials ?? [];
  const websites = pair.info?.websites ?? [];
  const ghSocial = socials.find((s) => s.type === "github" || s.url?.includes("github.com"));
  const ghWebsite = websites.find((w) => w.url?.includes("github.com"));
  const url = ghSocial?.url ?? ghWebsite?.url;
  return { found: !!url, url };
}

/**
 * Fetch GitHub coins - PumpFun tokens with creator fees redirected to GitHub.
 * Uses DexScreener social links + a seed list of known GitHub fee-sharing coins.
 * Note: PumpFun's fee sharing config is on-chain only (Social Fee PDA),
 * not exposed via any REST API, so we combine multiple detection methods.
 */
export async function getGithubCoins(): Promise<TokenData[]> {
  const candidateAddresses = new Set<string>();

  // 1. Always include known GitHub fee-sharing coins
  for (const addr of KNOWN_GITHUB_COINS) {
    candidateAddresses.add(addr);
  }

  // 2. Search DexScreener for github-related coins
  const queries = ["github", "dev", "open source", "developer", "git"];
  for (const query of queries) {
    try {
      const res = await pfetch(`${BASE_URL}/latest/dex/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) continue;
      const data = await res.json();
      const pairs: DexScreenerPair[] = data.pairs ?? [];
      for (const p of pairs) {
        if (p.chainId === "solana" && isPumpFunToken(p.baseToken.address)) {
          candidateAddresses.add(p.baseToken.address);
        }
      }
    } catch {
      // skip
    }
  }

  // 3. Pull from DB migrated coins for broader coverage
  const { getTokenAddressesByCategory } = await import("./db");
  const migratedAddrs = getTokenAddressesByCategory("migrated");
  for (const addr of migratedAddrs.slice(0, 200)) {
    candidateAddresses.add(addr);
  }

  // 4. Fetch full pair data and filter for GitHub links
  const uniqueAddrs = Array.from(candidateAddresses);
  const allPairs: DexScreenerPair[] = [];
  const BATCH_SIZE = 10;

  for (let i = 0; i < uniqueAddrs.length; i += BATCH_SIZE) {
    const batch = uniqueAddrs.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (addr) => {
        const res = await pfetch(`${BASE_URL}/tokens/v1/solana/${addr}`);
        if (!res.ok) return [];
        const pairs: DexScreenerPair[] = await res.json();
        return pairs ?? [];
      })
    );
    for (const result of results) {
      if (result.status === "fulfilled") {
        allPairs.push(...result.value);
      }
    }
  }

  // Store migrated coins found along the way
  storeMigratedFromPairs(allPairs);

  // 5. Filter: PumpFun tokens that either have GitHub links on DexScreener
  //    OR are in our known GitHub fee-sharing list
  const knownSet = new Set(KNOWN_GITHUB_COINS);
  const githubPairs = allPairs.filter(
    (p) =>
      p.chainId === "solana" &&
      isPumpFunToken(p.baseToken.address) &&
      hasReasonableLiquidity(p) &&
      (hasGithubLink(p).found || knownSet.has(p.baseToken.address))
  );

  // 6. Deduplicate by token address, keep highest liquidity
  const tokenMap = new Map<string, DexScreenerPair>();
  for (const pair of githubPairs) {
    const existing = tokenMap.get(pair.baseToken.address);
    if (!existing || (pair.liquidity?.usd ?? 0) > (existing.liquidity?.usd ?? 0)) {
      tokenMap.set(pair.baseToken.address, pair);
    }
  }

  return Array.from(tokenMap.values())
    .map((pair) => {
      const token = pairToTokenData(pair);
      const gh = hasGithubLink(pair);
      token.isGithub = true;
      token.githubUrl = gh.url;
      return token;
    })
    .sort((a, b) => b.marketCap - a.marketCap);
}

/**
 * Check if a pair has a TikTok social link on DexScreener
 */
function hasTiktokLink(pair: DexScreenerPair): boolean {
  const socials = pair.info?.socials ?? [];
  const websites = pair.info?.websites ?? [];
  return (
    socials.some((s) => s.type === "tiktok" || s.url?.includes("tiktok.com")) ||
    websites.some((w) => w.url?.includes("tiktok.com"))
  );
}

/**
 * Fetch TikTok coins - tokens that have actual TikTok social links on their DexScreener page.
 * Strategy: gather a broad pool of Solana tokens, fetch full data for each to get socials,
 * then strictly filter for tokens with a TikTok link.
 */
export async function getTiktokCoins(): Promise<TokenData[]> {
  const candidateAddresses = new Set<string>();

  // 1. Broad searches to find candidates
  const queries = ["solana", "meme", "pump", "sol", "viral", "tiktok"];
  for (const query of queries) {
    try {
      const res = await pfetch(`${BASE_URL}/latest/dex/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) continue;
      const data = await res.json();
      const pairs: DexScreenerPair[] = data.pairs ?? [];
      for (const p of pairs) {
        if (p.chainId === "solana") {
          candidateAddresses.add(p.baseToken.address);
        }
      }
    } catch {
      // Skip
    }
  }

  // 2. Pull from DB migrated coins for broader coverage
  const { getTokenAddressesByCategory } = await import("./db");
  const migratedAddrs = getTokenAddressesByCategory("migrated");
  for (const addr of migratedAddrs.slice(0, 200)) {
    candidateAddresses.add(addr);
  }

  // 3. Fetch full pair data for each candidate to get complete social info
  const uniqueAddrs = Array.from(candidateAddresses);
  const allPairs: DexScreenerPair[] = [];
  const BATCH_SIZE = 10;

  for (let i = 0; i < uniqueAddrs.length; i += BATCH_SIZE) {
    const batch = uniqueAddrs.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (addr) => {
        const res = await pfetch(`${BASE_URL}/tokens/v1/solana/${addr}`);
        if (!res.ok) return [];
        const pairs: DexScreenerPair[] = await res.json();
        return pairs ?? [];
      })
    );
    for (const result of results) {
      if (result.status === "fulfilled") {
        allPairs.push(...result.value);
      }
    }
  }

  // Store migrated coins found along the way
  storeMigratedFromPairs(allPairs);

  // 5. Strictly filter for PumpFun tokens with actual TikTok links and reasonable liquidity
  const tiktokPairs = allPairs.filter(
    (p) => p.chainId === "solana" && isPumpFunToken(p.baseToken.address) && hasTiktokLink(p) && hasReasonableLiquidity(p)
  );

  // 6. Deduplicate by base token address, keep highest liquidity pair
  const tokenMap = new Map<string, DexScreenerPair>();
  for (const pair of tiktokPairs) {
    const existing = tokenMap.get(pair.baseToken.address);
    if (!existing || (pair.liquidity?.usd ?? 0) > (existing.liquidity?.usd ?? 0)) {
      tokenMap.set(pair.baseToken.address, pair);
    }
  }

  return Array.from(tokenMap.values())
    .map(pairToTokenData)
    .sort((a, b) => b.marketCap - a.marketCap);
}

/**
 * Detect reversal coins - tokens showing significant MC increase with volume
 * A reversal = coin was at low MC and suddenly jumped up with volume
 *
 * Detection logic:
 * - 24h price change is very positive (big pump)
 * - BUT 6h change is even more positive than 24h (recent surge)
 * - High volume relative to market cap (volume/mc ratio)
 * - Alert if a coin was in a range and suddenly breaks out (6h change >> 1h average range)
 */
export async function getReversalCoins(): Promise<TokenData[]> {
  // Search for Solana tokens via DexScreener
  const queries = ["solana", "sol meme", "pump", "raydium sol"];
  const allPairs: DexScreenerPair[] = [];

  for (const query of queries) {
    try {
      const res = await pfetch(`${BASE_URL}/latest/dex/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) continue;
      const data = await res.json();
      const pairs: DexScreenerPair[] = data.pairs ?? [];
      allPairs.push(...pairs);
    } catch {
      // Skip
    }
  }

  // Pull migrated coins from DB for broader reversal scanning
  const { getTokenAddressesByCategory } = await import("./db");
  const migratedAddrs = getTokenAddressesByCategory("migrated");
  const seenAddrs = new Set(allPairs.map((p) => p.baseToken.address));
  const dbOnlyAddrs = migratedAddrs.filter((a) => !seenAddrs.has(a)).slice(0, 100);

  const BATCH_SIZE_DB = 10;
  for (let i = 0; i < dbOnlyAddrs.length; i += BATCH_SIZE_DB) {
    const batch = dbOnlyAddrs.slice(i, i + BATCH_SIZE_DB);
    const results = await Promise.allSettled(
      batch.map(async (addr: string) => {
        const res = await pfetch(`${BASE_URL}/tokens/v1/solana/${addr}`);
        if (!res.ok) return [];
        const pairs: DexScreenerPair[] = await res.json();
        return pairs ?? [];
      })
    );
    for (const result of results) {
      if (result.status === "fulfilled") {
        allPairs.push(...result.value);
      }
    }
  }

  // Store any migrated coins we found along the way
  storeMigratedFromPairs(allPairs);

  // Filter for Solana PumpFun reversal candidates with reasonable liquidity
  const reversals = allPairs.filter((p) => {
    if (p.chainId !== "solana") return false;
    if (!isPumpFunToken(p.baseToken.address)) return false;
    if (!hasReasonableLiquidity(p)) return false;
    const mc = p.marketCap ?? 0;
    if (mc < MIN_MARKET_CAP) return false;

    const change6h = p.priceChange?.h6 ?? 0;
    const change24h = p.priceChange?.h24 ?? 0;
    const change1h = p.priceChange?.h1 ?? 0;
    const vol24h = p.volume?.h24 ?? 0;
    const vol1h = p.volume?.h1 ?? 0;

    // Reversal detection:
    // 1. Strong recent pump (6h change > 30%)
    // 2. Volume spike (1h volume is significant relative to MC)
    // 3. Recent momentum (1h change positive and strong)
    const hasStrongPump = change6h > 30 || change1h > 15;
    const hasVolume = vol1h > mc * 0.05 || vol24h > mc * 0.3;
    const hasPositiveMomentum = change1h > 5;

    // Alert condition: was in a range (24h change was negative or flat) but now surging
    const wasDown = change24h < 10;
    const nowUp = change6h > 50 || change1h > 20;

    return (hasStrongPump && hasVolume && hasPositiveMomentum) || (wasDown && nowUp);
  });

  // Deduplicate
  const tokenMap = new Map<string, DexScreenerPair>();
  for (const pair of reversals) {
    const existing = tokenMap.get(pair.baseToken.address);
    if (!existing || (pair.liquidity?.usd ?? 0) > (existing.liquidity?.usd ?? 0)) {
      tokenMap.set(pair.baseToken.address, pair);
    }
  }

  return Array.from(tokenMap.values())
    .map((pair) => {
      const token = pairToTokenData(pair);
      token.isReversal = true;

      // Calculate reversal strength based on volume relative to MC
      const volRatio = (pair.volume?.h1 ?? 0) / Math.max(pair.marketCap ?? 1, 1);
      token.reversalMultiple = Math.round(volRatio * 100) / 100;

      // Flag alert if sudden breakout from range
      const change6h = pair.priceChange?.h6 ?? 0;
      const change24h = pair.priceChange?.h24 ?? 0;
      if (change6h > 100 && change24h < change6h * 0.5) {
        token.isAlert = true;
        token.alertReason = `Breakout! MC surged ${change6h.toFixed(0)}% in 6h`;
      } else if ((pair.priceChange?.h1 ?? 0) > 30) {
        token.isAlert = true;
        token.alertReason = `Pumping ${(pair.priceChange?.h1 ?? 0).toFixed(0)}% in 1h with volume`;
      }

      return token;
    })
    .sort((a, b) => {
      // Sort alerts first, then by volume
      if (a.isAlert && !b.isAlert) return -1;
      if (!a.isAlert && b.isAlert) return 1;
      return b.volume1h - a.volume1h;
    });
}

/**
 * Check if a DexScreener pair represents a migrated pump.fun token
 * (address ends in "pump", trading on Raydium or PumpSwap).
 * If so, store it in the database.
 */
export function storeMigratedPair(pair: DexScreenerPair): boolean {
  if (pair.chainId !== "solana") return false;
  const addr = pair.baseToken.address;
  if (!addr.endsWith("pump")) return false;
  const dex = pair.dexId?.toLowerCase() ?? "";
  if (!dex.includes("raydium") && !dex.includes("pumpswap")) return false;

  upsertToken({
    address: addr,
    name: pair.baseToken.name,
    symbol: pair.baseToken.symbol,
    imageUrl: pair.info?.imageUrl,
    dexUrl: pair.url,
    dexId: pair.dexId,
    pairAddress: pair.pairAddress,
    pairCreatedAt: pair.pairCreatedAt,
    source: "pump.fun",
  });
  addCategory(addr, "migrated", 1.0, dex);
  addSnapshot(addr, {
    priceUsd: parseFloat(pair.priceUsd) || 0,
    marketCap: pair.marketCap ?? 0,
    volume24h: pair.volume?.h24 ?? 0,
    liquidity: pair.liquidity?.usd ?? 0,
    buys24h: pair.txns?.h24?.buys ?? 0,
    sells24h: pair.txns?.h24?.sells ?? 0,
  });
  return true;
}

/**
 * Scan an array of pairs and store any migrated coins found.
 */
export function storeMigratedFromPairs(pairs: DexScreenerPair[]): number {
  let stored = 0;
  for (const pair of pairs) {
    if (storeMigratedPair(pair)) stored++;
  }
  return stored;
}

