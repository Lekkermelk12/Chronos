import { DexScreenerPair } from "@/types/token";
import { upsertToken, addCategory, addSnapshot, getTokenCount, getDb } from "./db";
import { matchTiktokMeme, TIKTOK_SEARCH_QUERIES } from "./keywords";
import { pfetch } from "./fetch";

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
