// Client-side token processing — no DB, no server imports.
// Runs in the browser after fetching through /api/proxy.

import { TokenData } from "@/types/token";
import {
  GmgnRankToken,
  getRankedTokens,
  getTokenInfo,
  fetchPumpFunCoin,
  pumpFunCoinHasGithub,
} from "./gmgn-client";

const MIN_MARKET_CAP = 3500;
const MAX_LIQUIDITY = 10_000_000;
const ONE_DAY_S = 24 * 60 * 60;

export function gmgnToTokenData(t: GmgnRankToken): TokenData {
  return {
    address: t.address,
    name: t.name ?? "Unknown",
    symbol: t.symbol ?? "???",
    imageUrl: t.logo || undefined,
    priceUsd: t.price ?? 0,
    priceChange5m: t.price_change_percent5m ?? 0,
    priceChange1h: t.price_change_percent1h ?? 0,
    priceChange6h: t.price_change_percent ?? 0,
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
    mintAuthorityDisabled: t.renounced_mint === 1,
    freezeAuthorityDisabled: t.renounced_freeze_account === 1,
  };
}

function scoreReversal(t: GmgnRankToken): number {
  const change1h = t.price_change_percent1h ?? 0;
  const change5m = t.price_change_percent5m ?? 0;
  const mc = t.market_cap ?? 0;
  const vol = t.volume ?? 0;
  const buys = t.buys ?? 0;
  const sells = t.sells ?? 0;

  let priceScore = 0;
  if (change1h >= 100) priceScore = 40;
  else if (change1h >= 50) priceScore = 32;
  else if (change1h >= 30) priceScore = 24;
  else if (change1h >= 15) priceScore = 16;
  else if (change1h >= 5) priceScore = 8;
  if (change5m >= 20) priceScore = Math.min(40, priceScore + 8);
  else if (change5m >= 10) priceScore = Math.min(40, priceScore + 5);
  else if (change5m >= 5) priceScore = Math.min(40, priceScore + 2);
  if (change5m < 0) priceScore = Math.max(0, priceScore - 5);

  const volRatio = mc > 0 ? vol / mc : 0;
  let volumeScore = 0;
  if (volRatio >= 2.0) volumeScore = 30;
  else if (volRatio >= 1.0) volumeScore = 24;
  else if (volRatio >= 0.5) volumeScore = 18;
  else if (volRatio >= 0.2) volumeScore = 12;
  else if (volRatio >= 0.05) volumeScore = 6;

  const totalTxns = buys + sells;
  const buyRatio = totalTxns > 10 ? buys / totalTxns : 0.5;
  let buyScore = 0;
  if (buyRatio >= 0.75) buyScore = 20;
  else if (buyRatio >= 0.65) buyScore = 15;
  else if (buyRatio >= 0.55) buyScore = 10;
  else if (buyRatio >= 0.5) buyScore = 5;

  let safetyScore = 0;
  if (t.renounced_mint === 1) safetyScore += 5;
  if (t.renounced_freeze_account === 1) safetyScore += 5;

  return Math.min(100, priceScore + volumeScore + buyScore + safetyScore);
}

export async function getReversalCoins(): Promise<TokenData[]> {
  const [byVolume, bySwaps, byPrice] = await Promise.all([
    getRankedTokens({ timeframe: "1h", orderby: "volume", direction: "desc", limit: 150, filters: ["not_honeypot"] }),
    getRankedTokens({ timeframe: "6h", orderby: "swaps", direction: "desc", limit: 150, filters: ["not_honeypot"] }),
    getRankedTokens({ timeframe: "1h", orderby: "price", direction: "desc", limit: 100, filters: ["not_honeypot"] }),
  ]);

  const seen = new Map<string, GmgnRankToken>();
  for (const t of [...byVolume, ...bySwaps, ...byPrice]) {
    if (!seen.has(t.address)) seen.set(t.address, t);
  }

  const results: TokenData[] = [];
  for (const t of seen.values()) {
    if ((t.market_cap ?? 0) < MIN_MARKET_CAP) continue;
    if ((t.liquidity ?? 0) <= 0 || (t.liquidity ?? 0) > MAX_LIQUIDITY) continue;
    if ((t.price_change_percent1h ?? 0) <= 0 && (t.price_change_percent5m ?? 0) <= 0) continue;

    const score = scoreReversal(t);
    if (score < 15) continue;

    const token = gmgnToTokenData(t);
    token.isReversal = true;
    token.reversalScore = score;
    token.reversalMultiple =
      Math.round(((t.volume ?? 0) / Math.max(t.market_cap ?? 1, 1)) * 100) / 100;

    const change1h = t.price_change_percent1h ?? 0;
    const change5m = t.price_change_percent5m ?? 0;
    if (score >= 65) {
      token.isAlert = true;
      if (change1h >= 50) {
        token.alertReason = `Breakout! +${change1h.toFixed(0)}% in 1h · Score ${score}`;
      } else if (change5m >= 20) {
        token.alertReason = `Pumping +${change5m.toFixed(0)}% in 5m · Score ${score}`;
      } else {
        token.alertReason = `Strong reversal signal · Score ${score}`;
      }
    }
    results.push(token);
  }

  return results.sort((a, b) => {
    if (a.isAlert && !b.isAlert) return -1;
    if (!a.isAlert && b.isAlert) return 1;
    return (b.reversalScore ?? 0) - (a.reversalScore ?? 0);
  });
}

export async function getBonkCoins(): Promise<TokenData[]> {
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
    results.push(gmgnToTokenData(t));
  }
  return results.sort((a, b) => b.marketCap - a.marketCap);
}

export async function getOldCoins(): Promise<TokenData[]> {
  // Fetch multiple timeframes to get broader coverage
  const [byVol, byMc] = await Promise.all([
    getRankedTokens({ timeframe: "24h", orderby: "volume", direction: "desc", limit: 200 }),
    getRankedTokens({ timeframe: "24h", orderby: "marketcap", direction: "desc", limit: 200 }),
  ]);

  const seen = new Map<string, GmgnRankToken>();
  for (const t of [...byVol, ...byMc]) {
    if (!seen.has(t.address)) seen.set(t.address, t);
  }

  const now = Date.now() / 1000;
  const results: TokenData[] = [];
  for (const t of seen.values()) {
    if (t.open_timestamp && now - t.open_timestamp < ONE_DAY_S) continue;
    const isPump =
      t.address.endsWith("pump") || (t.launchpad ?? "").toLowerCase().includes("pump");
    if (!isPump) continue;
    if ((t.liquidity ?? 0) <= 0 || (t.liquidity ?? 0) > MAX_LIQUIDITY) continue;
    if ((t.market_cap ?? 0) < MIN_MARKET_CAP) continue;
    results.push(gmgnToTokenData(t));
  }
  return results.sort((a, b) => b.marketCap - a.marketCap);
}

export async function getBagsCoins(): Promise<TokenData[]> {
  const combos: Array<{ timeframe: "24h" | "6h" | "1h"; orderby: "volume" | "marketcap" | "swaps" }> = [
    { timeframe: "24h", orderby: "volume" },
    { timeframe: "24h", orderby: "marketcap" },
    { timeframe: "6h", orderby: "volume" },
    { timeframe: "1h", orderby: "swaps" },
  ];

  const gmgnSeen = new Map<string, GmgnRankToken>();
  await Promise.allSettled(
    combos.map(async ({ timeframe, orderby }) => {
      const tokens = await getRankedTokens({ timeframe, orderby, direction: "desc", limit: 200 });
      for (const t of tokens) {
        if (!gmgnSeen.has(t.address)) gmgnSeen.set(t.address, t);
      }
    })
  );

  const results: TokenData[] = [];
  for (const t of gmgnSeen.values()) {
    const launchpad = (t.launchpad ?? "").toLowerCase();
    const pool = (t.pool_type_str ?? "").toLowerCase();
    if (!launchpad.includes("bag") && !pool.includes("bag")) continue;
    if ((t.market_cap ?? 0) < MIN_MARKET_CAP) continue;
    if ((t.liquidity ?? 0) <= 0 || (t.liquidity ?? 0) > MAX_LIQUIDITY) continue;
    const token = gmgnToTokenData(t);
    token.isBags = true;
    results.push(token);
  }

  // DexScreener search for bags-related pairs
  const seenAddrs = new Set(results.map((r) => r.address));
  try {
    const res = await fetch(`/api/proxy?host=dexscreener&path=${encodeURIComponent("/latest/dex/search?q=bags.fm")}`);
    if (res.ok) {
      const data = await res.json();
      for (const pair of (data.pairs ?? [])) {
        if (pair.chainId !== "solana") continue;
        const addr = pair.baseToken?.address;
        if (!addr || seenAddrs.has(addr)) continue;
        const mc = pair.marketCap ?? pair.fdv ?? 0;
        const liq = pair.liquidity?.usd ?? 0;
        const isBagsDex = pair.dexId === "bags";
        if (mc < MIN_MARKET_CAP) continue;
        if (!isBagsDex && (liq <= 0 || liq > MAX_LIQUIDITY)) continue;
        seenAddrs.add(addr);
        results.push({
          address: addr,
          name: pair.baseToken?.name ?? "Unknown",
          symbol: pair.baseToken?.symbol ?? "???",
          imageUrl: pair.info?.imageUrl || undefined,
          priceUsd: parseFloat(pair.priceUsd) || 0,
          priceChange5m: pair.priceChange?.m5 ?? 0,
          priceChange1h: pair.priceChange?.h1 ?? 0,
          priceChange6h: pair.priceChange?.h6 ?? 0,
          priceChange24h: pair.priceChange?.h24 ?? 0,
          volume5m: 0, volume1h: 0, volume6h: 0,
          volume24h: pair.volume?.h24 ?? 0,
          liquidity: liq,
          marketCap: mc,
          fdv: pair.fdv ?? mc,
          buys24h: pair.txns?.h24?.buys ?? 0,
          sells24h: pair.txns?.h24?.sells ?? 0,
          buys1h: pair.txns?.h1?.buys ?? 0,
          sells1h: pair.txns?.h1?.sells ?? 0,
          pairAddress: pair.pairAddress ?? "",
          pairCreatedAt: pair.pairCreatedAt ?? 0,
          dexUrl: pair.url ?? `https://dexscreener.com/solana/${addr}`,
          dexId: pair.dexId,
          hasTiktok: false,
          socials: [],
          isBags: true,
        });
      }
    }
  } catch {
    // ignore
  }

  return results.sort((a, b) => b.marketCap - a.marketCap);
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

export async function getGithubCoins(): Promise<TokenData[]> {
  // Fetch addresses from the DB via the categories endpoint
  let dbAddrs: string[] = [];
  try {
    const res = await fetch("/api/categories/migrated");
    if (res.ok) {
      const data = await res.json();
      dbAddrs = Array.isArray(data.addresses) ? data.addresses : [];
    }
  } catch {
    // ignore
  }

  const candidateAddresses = new Set<string>([...KNOWN_GITHUB_COINS, ...dbAddrs.slice(0, 200)]);
  const uniqueAddrs = Array.from(candidateAddresses);

  const pumpFunGithubUrls = new Map<string, string>();
  const tokenDataMap = new Map<string, TokenData>();
  const BATCH_SIZE = 8;

  for (let i = 0; i < uniqueAddrs.length; i += BATCH_SIZE) {
    const batch = uniqueAddrs.slice(i, i + BATCH_SIZE);
    await Promise.allSettled(
      batch.flatMap((addr) => [
        getTokenInfo(addr).then((info) => {
          if (!info) return;
          tokenDataMap.set(addr, {
            address: info.address,
            name: info.name ?? "Unknown",
            symbol: info.symbol ?? "???",
            imageUrl: info.logo || undefined,
            priceUsd: info.price ?? 0,
            priceChange5m: 0, priceChange1h: 0, priceChange6h: 0, priceChange24h: 0,
            volume5m: 0, volume1h: 0, volume6h: 0,
            volume24h: info.volume_24h ?? 0,
            liquidity: info.liquidity ?? 0,
            marketCap: info.price && info.total_supply ? info.price * info.total_supply : 0,
            fdv: info.price && info.total_supply ? info.price * info.total_supply : 0,
            buys24h: 0, sells24h: 0, buys1h: 0, sells1h: 0,
            pairAddress: info.biggest_pool_address ?? "",
            pairCreatedAt: info.open_timestamp ? info.open_timestamp * 1000 : 0,
            dexUrl: `https://gmgn.ai/sol/token/${info.address}`,
            socials: [],
            mintAuthorityDisabled: info.renounced_mint === 1,
            freezeAuthorityDisabled: info.renounced_freeze_account === 1,
          });
        }),
        fetchPumpFunCoin(addr).then((coin) => {
          if (!coin) return;
          const gh = pumpFunCoinHasGithub(coin);
          if (gh.found && gh.url) pumpFunGithubUrls.set(addr, gh.url);
          if (KNOWN_GITHUB_CREATORS.includes(coin.creator)) pumpFunGithubUrls.set(addr, gh.url ?? "");
        }),
      ])
    );
  }

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

// TikTok coins — address list comes from the DB via /api/categories endpoint
export async function getTiktokCoins(): Promise<TokenData[]> {
  let addrs: string[] = [];
  try {
    const res = await fetch("/api/categories/tiktok-meme");
    if (res.ok) {
      const data = await res.json();
      addrs = Array.isArray(data.addresses) ? data.addresses : [];
    }
  } catch {
    // ignore
  }

  const results: TokenData[] = [];
  const BATCH_SIZE = 5;

  for (let i = 0; i < addrs.length; i += BATCH_SIZE) {
    const batch = addrs.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(
      batch.map(async (addr) => {
        const info = await getTokenInfo(addr);
        if (!info) return null;
        return {
          address: info.address,
          name: info.name ?? "Unknown",
          symbol: info.symbol ?? "???",
          imageUrl: info.logo || undefined,
          priceUsd: info.price ?? 0,
          priceChange5m: 0, priceChange1h: 0, priceChange6h: 0, priceChange24h: 0,
          volume5m: 0, volume1h: 0, volume6h: 0,
          volume24h: info.volume_24h ?? 0,
          liquidity: info.liquidity ?? 0,
          marketCap: info.price && info.total_supply ? info.price * info.total_supply : 0,
          fdv: info.price && info.total_supply ? info.price * info.total_supply : 0,
          buys24h: 0, sells24h: 0, buys1h: 0, sells1h: 0,
          pairAddress: info.biggest_pool_address ?? "",
          pairCreatedAt: info.open_timestamp ? info.open_timestamp * 1000 : 0,
          dexUrl: `https://gmgn.ai/sol/token/${info.address}`,
          hasTiktok: true,
          socials: [],
          mintAuthorityDisabled: info.renounced_mint === 1,
          freezeAuthorityDisabled: info.renounced_freeze_account === 1,
        } as TokenData;
      })
    );
    for (const r of batchResults) {
      if (r.status === "fulfilled" && r.value) results.push(r.value);
    }
  }

  return results
    .filter((t) => t.liquidity > 0 && t.marketCap >= MIN_MARKET_CAP)
    .sort((a, b) => b.marketCap - a.marketCap);
}

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
    if ((t.market_cap ?? 0) < MIN_MARKET_CAP) continue;
    if ((t.liquidity ?? 0) <= 0 || (t.liquidity ?? 0) > MAX_LIQUIDITY) continue;
    results.push(gmgnToTokenData(t));
  }
  return results.sort((a, b) => b.volume24h - a.volume24h);
}

export async function getTokenDetail(address: string): Promise<TokenData | null> {
  const info = await getTokenInfo(address);
  if (!info) return null;
  return {
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
}

export async function searchTokens(query: string): Promise<TokenData[]> {
  const q = query.toLowerCase();
  const tokens = await getRankedTokens({
    timeframe: "24h",
    orderby: "volume",
    direction: "desc",
    limit: 200,
  });

  const matched = tokens.filter((t) => {
    const name = (t.name ?? "").toLowerCase();
    const symbol = (t.symbol ?? "").toLowerCase();
    return name.includes(q) || symbol.includes(q) || t.address === query;
  });

  // If direct address lookup, also try getTokenInfo
  if (matched.length === 0 && query.length > 30) {
    const info = await getTokenInfo(query);
    if (info) {
      return [{
        address: info.address,
        name: info.name ?? "Unknown",
        symbol: info.symbol ?? "???",
        imageUrl: info.logo || undefined,
        priceUsd: info.price ?? 0,
        priceChange5m: 0, priceChange1h: 0, priceChange6h: 0, priceChange24h: 0,
        volume5m: 0, volume1h: 0, volume6h: 0,
        volume24h: info.volume_24h ?? 0,
        liquidity: info.liquidity ?? 0,
        marketCap: info.price && info.total_supply ? info.price * info.total_supply : 0,
        fdv: 0, buys24h: 0, sells24h: 0, buys1h: 0, sells1h: 0,
        pairAddress: info.biggest_pool_address ?? "",
        pairCreatedAt: info.open_timestamp ? info.open_timestamp * 1000 : 0,
        dexUrl: `https://gmgn.ai/sol/token/${info.address}`,
        socials: [],
      }];
    }
  }

  return matched.map(gmgnToTokenData);
}
