import { DexScreenerPair } from "@/types/token";
import { upsertToken, addCategory, addSnapshot, getTokenCount, getDb, getAllTokenAddresses, deleteTokens } from "./db";
import { matchTiktokMeme, TIKTOK_SEARCH_QUERIES } from "./keywords";
import { pfetch } from "./fetch";
import { fetchAllGraduatedTokens, MoralisGraduatedToken } from "./moralis";

const DEXSCREENER_BASE = "https://api.dexscreener.com";

// Known TikTok meme coin addresses (curated seed list)
const SEED_ADDRESSES = [
  "J8PSdNP3QewKq2Z1JJJFDMaqF7KcaiJhR7gbr5KZpump", // Tung Tung Tung Sahur
  "59gPcuoED3gB7u66sAjjMiXprVBZmAi1wpGZyK6Upump", // Mogged
  "BkDaxAYEoBhrq7QLE32eDXU3TvNwCA3BR74hp4G5pump", // Lowkirkenuinely
  "Df6yfrKC8kZE3KNkrHERKzAetSxbrWeniQfyJY4Jpump", // Just a chill guy
  "9AvytnUKsLxPxFHFqS6VLxaxt5p6BhYNr53SD2Chpump", // The Official 67 Coin
  "FYtP5AiiB4eUjVA88EeZS73PDpi7RPLusdqtXizYpump", // GOY
  "DL6BBBQ6heTg9Zr5gFZxsCK2AZt2aVyRqUZgChqopump", // Tiktok Coin
  "66FUGxm2cEsZ3ASXeTTHmT6RggmUPCZAcwWxRknHpump", // Johnny
  "3zWamrcm37PvqSrf8a1whYxy3ekBCnaVJ1ZX7BEHpump", // ascend
  "5LCVhWUh2KZd1wZ7MefZGCjF3tvRsqMJjscJSAW9pump", // CITY BOY
  "14GMPMf3cRANLfJ9QYU19F5XogVGPjCB7f3NLACrpump", // Just can't prove it
  "8ZeTmGGktvSwSSghx8btbTAVGdWogThKM4DQBJgRpump", // All Roads Lead To Rome
  "HmCxqpgxaQng3A73F7vLgJjc9sr6ACFt8CEJwWY2hMGR", // Opium Bird
  "GZcVdxXSenrKgnkAKCj9Yp7ConTB4poGfBohFVpupump", // Nosey
  "8ryRQD6jWfxnSdvvVbQ8Tzwo1NgGP7w1X1nQPpb4pump", // meowl the owl cat
  "H4EkHReWbjJpqNUiUeYNNZbNKLqLfH8Jt9MkceXGpump", // Talking Objects
  "Bw4hEZZSz2uff9wZLdpDikgbaWSd5fTEozQkV7KApump", // Skeleton Banging Shield
  "8BojTbbG2nnTXA1WgpHxoKdqdoa3AAnDvzqynHZdpump", // Dagestan
  "6WdHhpRY7vL8SQ69bd89tAj3sk8jsjBrCLDUTZSNpump", // JESTERMAXXING
  "4az7oyuUFco8GedLkWYzopurgadkSz8n64xCEXNYpump", // Agartha
  "8zkYcsZGnu6yUaQX7hYGJrEHRs8VJuGCVrypXo7ipump", // WHY YOU HEZI
  "8Jx8AAHj86wbQgUTjGuj6GTTL5Ps3cqxKRTvpaJApump", // Nietzschean Penguin
  "32CdQdBUxbCsLy5AUHWmyidfwhgGUr9N573NBUrDpump", // maxxing
  "EygStH4gHv1h4E8w4raYv6NGsrDiij3nbfCc26iTpump", // Live Action Roleplay
];

/**
 * Fetch pair data from DexScreener for a token address.
 * Returns the best pair (highest liquidity) or null.
 */
async function fetchBestPair(address: string): Promise<DexScreenerPair | null> {
  try {
    const res = await pfetch(`${DEXSCREENER_BASE}/tokens/v1/solana/${address}`);
    if (!res.ok) return null;
    const pairs: DexScreenerPair[] = await res.json();
    if (!pairs || pairs.length === 0) return null;
    return pairs
      .filter((p) => p.chainId === "solana")
      .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Process a DexScreener pair: upsert token, auto-categorize, add snapshot.
 */
function processPair(pair: DexScreenerPair, forceCategory?: string) {
  const addr = pair.baseToken.address;
  const name = pair.baseToken.name;
  const symbol = pair.baseToken.symbol;

  // Determine source from pair data
  const source = pair.pairAddress?.endsWith("pump") || addr.endsWith("pump")
    ? "pump.fun"
    : pair.dexId ?? "unknown";

  upsertToken({
    address: addr,
    name,
    symbol,
    imageUrl: pair.info?.imageUrl,
    dexUrl: pair.url,
    dexId: pair.dexId,
    pairAddress: pair.pairAddress,
    pairCreatedAt: pair.pairCreatedAt,
    source,
  });

  // Auto-categorize based on keyword matching
  const match = matchTiktokMeme(name, symbol);
  if (match) {
    addCategory(addr, "tiktok-meme", match.confidence, match.keyword);
    if (match.tag) {
      addCategory(addr, match.tag, match.confidence, match.keyword);
    }
  }

  // Force category if specified (e.g. for seed addresses)
  if (forceCategory) {
    addCategory(addr, forceCategory, 1.0, "seed-list");
  }

  // Check for TikTok social link
  const socials = pair.info?.socials ?? [];
  const websites = pair.info?.websites ?? [];
  const hasTiktokLink =
    socials.some((s) => s.type === "tiktok" || s.url?.includes("tiktok.com")) ||
    websites.some((w) => w.url?.includes("tiktok.com"));
  if (hasTiktokLink) {
    addCategory(addr, "has-tiktok-link", 1.0, "social-link");
  }

  // Add snapshot
  addSnapshot(addr, {
    priceUsd: parseFloat(pair.priceUsd) || 0,
    marketCap: pair.marketCap ?? 0,
    volume24h: pair.volume?.h24 ?? 0,
    liquidity: pair.liquidity?.usd ?? 0,
    buys24h: pair.txns?.h24?.buys ?? 0,
    sells24h: pair.txns?.h24?.sells ?? 0,
  });
}

/**
 * Seed the database with known TikTok meme coin addresses.
 */
export async function seedDatabase(): Promise<{ seeded: number; errors: number }> {
  let seeded = 0;
  let errors = 0;

  // Process in batches of 5 to avoid rate limiting
  for (let i = 0; i < SEED_ADDRESSES.length; i += 5) {
    const batch = SEED_ADDRESSES.slice(i, i + 5);
    const results = await Promise.allSettled(
      batch.map((addr) => fetchBestPair(addr))
    );

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      if (result.status === "fulfilled" && result.value) {
        processPair(result.value, "tiktok-meme");
        seeded++;
      } else {
        errors++;
      }
    }
  }

  return { seeded, errors };
}

/**
 * Discover new TikTok meme tokens by searching DexScreener with meme keywords.
 * Returns count of newly discovered tokens.
 */
export async function discoverNewTokens(): Promise<{ discovered: number; total: number }> {
  const existingCount = getTokenCount();
  const seenAddresses = new Set<string>();

  // Get existing addresses to avoid re-processing
  const db = getDb();
  const existing = db.prepare("SELECT address FROM tokens").all() as { address: string }[];
  for (const row of existing) {
    seenAddresses.add(row.address);
  }

  const newPairs: DexScreenerPair[] = [];

  // Search DexScreener with TikTok meme keywords
  for (const query of TIKTOK_SEARCH_QUERIES) {
    try {
      const res = await pfetch(
        `${DEXSCREENER_BASE}/latest/dex/search?q=${encodeURIComponent(query)}`
      );
      if (!res.ok) continue;
      const data = await res.json();
      const pairs: DexScreenerPair[] = data.pairs ?? [];

      for (const pair of pairs) {
        if (pair.chainId !== "solana") continue;
        const addr = pair.baseToken.address;
        if (seenAddresses.has(addr)) continue;

        // Check if name/symbol matches TikTok meme patterns
        const match = matchTiktokMeme(pair.baseToken.name, pair.baseToken.symbol);
        if (match && match.confidence >= 0.6) {
          newPairs.push(pair);
          seenAddresses.add(addr);
        }
      }
    } catch {
      // Skip failed queries
    }
  }

  // Also check trending for any TikTok memes
  try {
    const trendingRes = await pfetch(`${DEXSCREENER_BASE}/token-boosts/top/v1`);
    if (trendingRes.ok) {
      const boosts = await trendingRes.json();
      const solanaAddrs = boosts
        .filter((b: { chainId: string }) => b.chainId === "solana")
        .map((b: { tokenAddress: string }) => b.tokenAddress)
        .filter((addr: string) => !seenAddresses.has(addr));

      for (const addr of solanaAddrs.slice(0, 20)) {
        const pair = await fetchBestPair(addr);
        if (!pair) continue;
        const match = matchTiktokMeme(pair.baseToken.name, pair.baseToken.symbol);
        if (match && match.confidence >= 0.6) {
          newPairs.push(pair);
          seenAddresses.add(addr);
        }
      }
    }
  } catch {
    // skip
  }

  // Process all newly discovered tokens
  for (const pair of newPairs) {
    processPair(pair);
  }

  const newCount = getTokenCount();
  return { discovered: newCount - existingCount, total: newCount };
}

/**
 * Update snapshots for all existing tokens in the database.
 * This refreshes price/MC/volume data.
 */
export async function refreshSnapshots(): Promise<{ updated: number }> {
  const db = getDb();
  const addresses = db.prepare("SELECT address FROM tokens").all() as { address: string }[];
  let updated = 0;

  // Process in batches
  for (let i = 0; i < addresses.length; i += 5) {
    const batch = addresses.slice(i, i + 5);
    const results = await Promise.allSettled(
      batch.map((row) => fetchBestPair(row.address))
    );

    for (const result of results) {
      if (result.status === "fulfilled" && result.value) {
        const pair = result.value;
        addSnapshot(pair.baseToken.address, {
          priceUsd: parseFloat(pair.priceUsd) || 0,
          marketCap: pair.marketCap ?? 0,
          volume24h: pair.volume?.h24 ?? 0,
          liquidity: pair.liquidity?.usd ?? 0,
          buys24h: pair.txns?.h24?.buys ?? 0,
          sells24h: pair.txns?.h24?.sells ?? 0,
        });
        updated++;
      }
    }
  }

  return { updated };
}

/**
 * Full index run: seed (if needed) + discover new + refresh snapshots.
 */
export async function runFullIndex(): Promise<{
  seeded: number;
  discovered: number;
  refreshed: number;
  totalTokens: number;
}> {
  // Seed if database is empty
  let seeded = 0;
  if (getTokenCount() === 0) {
    const seedResult = await seedDatabase();
    seeded = seedResult.seeded;
  }

  // Discover new tokens
  const discoverResult = await discoverNewTokens();

  // Refresh snapshots for all tokens
  const refreshResult = await refreshSnapshots();

  return {
    seeded,
    discovered: discoverResult.discovered,
    refreshed: refreshResult.updated,
    totalTokens: discoverResult.total || getTokenCount(),
  };
}

/**
 * Store a Moralis graduated token in the database.
 */
function storeMoralisToken(token: MoralisGraduatedToken): void {
  upsertToken({
    address: token.tokenAddress,
    name: token.name || "Unknown",
    symbol: token.symbol || "???",
    imageUrl: token.logo ?? undefined,
    source: "pump.fun",
  });
  addCategory(token.tokenAddress, "migrated", 1.0, "moralis-graduated");
  addSnapshot(token.tokenAddress, {
    priceUsd: token.priceUsd ?? 0,
    marketCap: token.fullyDilutedValuation ?? 0,
    liquidity: token.liquidity ?? 0,
  });
}

const PUMPFUN_API = "https://frontend-api-v3.pump.fun";
const PUMPFUN_HEADERS = {
  "User-Agent": "Mozilla/5.0",
  Accept: "application/json",
  Origin: "https://pump.fun",
  Referer: "https://pump.fun/",
};

/**
 * Index migrated PumpFun coins by scanning DexScreener for Solana tokens
 * and storing any that are PumpFun-originated (address ends with "pump")
 * and trading on Raydium/PumpSwap.
 */
export async function indexMigratedFromDexScreener(): Promise<{
  scanned: number;
  stored: number;
}> {
  const queries = [
    // Core platform terms
    "solana", "sol", "pump", "raydium", "pumpswap", "meme", "degen",
    // Popular categories
    "bonk", "dog", "cat", "pepe", "ai", "trump", "based", "moon",
    "viral", "tiktok", "dev", "github", "nft", "gaming",
    // Animal memes
    "shib", "doge", "frog", "bear", "bull", "monkey", "ape", "bird", "fish",
    // Trending themes
    "elon", "bitcoin", "eth", "crypto", "chad", "wojak", "cope", "hopium",
    "alpha", "beta", "sigma", "omega", "king", "queen",
    // Cultural / brainrot
    "brainrot", "skibidi", "rizz", "gyatt", "ohio", "sussy",
    "tung", "italian", "maxxing", "looksmax",
    // Tech / finance
    "token", "coin", "swap", "yield", "stake", "farm", "vault",
    "dao", "defi", "web3", "metaverse",
    // Misc popular
    "baby", "mini", "super", "mega", "ultra", "giga", "turbo",
    "ninja", "samurai", "dragon", "phoenix", "wizard",
    "gold", "diamond", "gem", "rocket", "fire", "laser",
  ];

  let scanned = 0;
  let stored = 0;

  for (const query of queries) {
    try {
      const res = await pfetch(
        `${DEXSCREENER_BASE}/latest/dex/search?q=${encodeURIComponent(query)}`
      );
      if (!res.ok) continue;
      const data = await res.json();
      const pairs: DexScreenerPair[] = data.pairs ?? [];
      scanned += pairs.length;

      for (const pair of pairs) {
        if (pair.chainId !== "solana") continue;
        const addr = pair.baseToken.address;
        if (!addr.endsWith("pump")) continue;
        const dex = pair.dexId?.toLowerCase() ?? "";
        if (!dex.includes("raydium") && !dex.includes("pumpswap") && !dex.includes("pump")) continue;

        processPair(pair);
        addCategory(addr, "migrated", 1.0, dex);
        stored++;
      }
    } catch {
      // skip
    }
  }

  return { scanned, stored };
}

/**
 * Index graduated coins from PumpFun API using all sort orders and directions
 * to maximize unique coin discovery. PumpFun limits offset to ~1050 per query,
 * but different sort+order combos return different coins.
 */
export async function indexFromPumpFun(maxCoins = 1050): Promise<{
  scanned: number;
  stored: number;
}> {
  let stored = 0;
  let scanned = 0;
  const PAGE_SIZE = 50;
  const seenMints = new Set<string>();

  const sortCombos: [string, string][] = [
    ["market_cap", "DESC"],
    ["market_cap", "ASC"],
    ["created_timestamp", "DESC"],
    ["created_timestamp", "ASC"],
    ["last_trade_timestamp", "DESC"],
    ["last_trade_timestamp", "ASC"],
    ["reply_count", "DESC"],
    // reply_count ASC returns 0 results
  ];

  for (const [sort, order] of sortCombos) {
    for (let offset = 0; offset < maxCoins; offset += PAGE_SIZE) {
      try {
        const res = await pfetch(
          `${PUMPFUN_API}/coins?limit=${PAGE_SIZE}&offset=${offset}&sort=${sort}&order=${order}&includeNsfw=false&complete=true`,
          { headers: PUMPFUN_HEADERS }
        );
        if (!res.ok) break;
        const coins = await res.json();
        if (!Array.isArray(coins) || coins.length === 0) break;
        scanned += coins.length;

        for (const coin of coins) {
          if (!coin.mint || !coin.complete) continue;
          if (seenMints.has(coin.mint)) continue;
          seenMints.add(coin.mint);

          upsertToken({
            address: coin.mint,
            name: coin.name || "Unknown",
            symbol: coin.symbol || "???",
            imageUrl: coin.image_uri ?? undefined,
            source: "pump.fun",
          });
          addCategory(coin.mint, "migrated", 1.0, "pumpfun-graduated");
          addSnapshot(coin.mint, {
            priceUsd: 0,
            marketCap: coin.usd_market_cap ?? 0,
          });
          stored++;
        }
      } catch {
        break;
      }
    }
    console.log(`[PumpFun] ${sort} ${order}: ${seenMints.size} unique coins so far`);
  }

  return { scanned, stored };
}

/**
 * Minimum market cap floor. Coins below this are considered dead/scam.
 */
const MIN_MC_FLOOR = 3500;

/**
 * Index ALL graduated pump.fun tokens from Moralis API chronologically.
 * Stores tokens as they stream in via onToken callback.
 * Filters out dead floor coins (< $3.5K MC).
 *
 * @param maxPages - Max pages to fetch (100 tokens/page). Default 2000 = up to 200K tokens.
 */
export async function indexGraduatedTokens(maxPages = 2000): Promise<{
  totalScanned: number;
  aliveStored: number;
  pages: number;
}> {
  let pages = 0;
  let totalScanned = 0;
  let stored = 0;

  const aliveTokens = await fetchAllGraduatedTokens({
    minHolders: 0,
    minMarketCap: MIN_MC_FLOOR,
    maxPages,
    onToken: (token) => {
      storeMoralisToken(token);
      stored++;
    },
    onPage: (page, total, alive) => {
      pages = page;
      totalScanned = total;
      if (page % 25 === 0) {
        console.log(`[Moralis] Page ${page}: scanned ${total} tokens, ${alive} alive (stored: ${stored})`);
      }
    },
  });

  return {
    totalScanned,
    aliveStored: aliveTokens.length,
    pages,
  };
}

const DEXSCREENER_TOKEN_URL = "https://api.dexscreener.com/tokens/v1/solana";

/**
 * Validate all stored tokens against DexScreener live data.
 * Removes tokens that:
 * - Have no liquidity on any DEX (didn't actually bond / liquidity pulled)
 * - Current market cap is below $3.5K (dead floor)
 * - Don't trade on Raydium or PumpSwap (not actually migrated)
 *
 * DexScreener /tokens/v1/solana supports up to 30 addresses per request.
 */
export async function cleanupDeadTokens(onProgress?: (checked: number, total: number, removed: number) => void): Promise<{
  checked: number;
  removed: number;
  remaining: number;
}> {
  const allAddresses = getAllTokenAddresses();
  const total = allAddresses.length;
  const toRemove: string[] = [];
  const BATCH_SIZE = 30; // DexScreener allows up to 30 per request
  let checked = 0;

  for (let i = 0; i < allAddresses.length; i += BATCH_SIZE) {
    const batch = allAddresses.slice(i, i + BATCH_SIZE);
    const addrList = batch.join(",");

    try {
      const res = await pfetch(`${DEXSCREENER_TOKEN_URL}/${addrList}`);
      if (!res.ok) {
        // If API fails, skip this batch (don't delete on API errors)
        checked += batch.length;
        continue;
      }

      const pairs: DexScreenerPair[] = await res.json();
      if (!Array.isArray(pairs)) {
        checked += batch.length;
        continue;
      }

      // Group pairs by token address, keep best pair per token
      const bestPairByToken = new Map<string, DexScreenerPair>();
      for (const pair of pairs) {
        if (pair.chainId !== "solana") continue;
        const addr = pair.baseToken.address;
        const existing = bestPairByToken.get(addr);
        if (!existing || (pair.liquidity?.usd ?? 0) > (existing.liquidity?.usd ?? 0)) {
          bestPairByToken.set(addr, pair);
        }
      }

      // Check each address in the batch
      for (const addr of batch) {
        const bestPair = bestPairByToken.get(addr);

        if (!bestPair) {
          // No pair data at all = not trading on any DEX = dead
          toRemove.push(addr);
          checked++;
          continue;
        }

        const mc = bestPair.marketCap ?? bestPair.fdv ?? 0;
        const liq = bestPair.liquidity?.usd ?? 0;
        const dex = bestPair.dexId?.toLowerCase() ?? "";
        const isBonded = dex.includes("raydium") || dex.includes("pumpswap") || dex.includes("pump");

        // Remove if: no liquidity, below MC floor, or not bonded to a real DEX
        if (liq <= 0 || mc < MIN_MC_FLOOR || !isBonded) {
          toRemove.push(addr);
        } else {
          // Token is alive - update its snapshot with fresh data
          addSnapshot(addr, {
            priceUsd: parseFloat(bestPair.priceUsd) || 0,
            marketCap: mc,
            volume24h: bestPair.volume?.h24 ?? 0,
            liquidity: liq,
            buys24h: bestPair.txns?.h24?.buys ?? 0,
            sells24h: bestPair.txns?.h24?.sells ?? 0,
          });
          // Update token with DEX info
          upsertToken({
            address: addr,
            name: bestPair.baseToken.name,
            symbol: bestPair.baseToken.symbol,
            imageUrl: bestPair.info?.imageUrl,
            dexUrl: bestPair.url,
            dexId: bestPair.dexId,
            pairAddress: bestPair.pairAddress,
            pairCreatedAt: bestPair.pairCreatedAt,
            source: "pump.fun",
          });
        }

        checked++;
      }

      onProgress?.(checked, total, toRemove.length);
    } catch {
      checked += batch.length;
    }

    // Small delay between batches to respect rate limits
    if (i + BATCH_SIZE < allAddresses.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  // Batch delete all dead tokens
  if (toRemove.length > 0) {
    deleteTokens(toRemove);
  }

  return {
    checked,
    removed: toRemove.length,
    remaining: total - toRemove.length,
  };
}
