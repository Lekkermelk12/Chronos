import { NextResponse } from "next/server";
import { getTokenAddressesByCategory, getTokenCount, upsertToken, addCategory } from "@/lib/db";
import { getTokenPairs } from "@/lib/tokens";
import { TokenData } from "@/types/token";

export const dynamic = "force-dynamic";

// Seed list — insert directly into DB without API calls
const SEED_TIKTOK_COINS: { address: string; name: string; symbol: string }[] = [
  { address: "J8PSdNP3QewKq2Z1JJJFDMaqF7KcaiJhR7gbr5KZpump", name: "Tung Tung Tung Sahur", symbol: "TripleT" },
  { address: "59gPcuoED3gB7u66sAjjMiXprVBZmAi1wpGZyK6Upump", name: "Mogged", symbol: "MOGGED" },
  { address: "BkDaxAYEoBhrq7QLE32eDXU3TvNwCA3BR74hp4G5pump", name: "Lowkirkenuinely", symbol: "Kirk" },
  { address: "Df6yfrKC8kZE3KNkrHERKzAetSxbrWeniQfyJY4Jpump", name: "Just a chill guy", symbol: "CHILLGUY" },
  { address: "9AvytnUKsLxPxFHFqS6VLxaxt5p6BhYNr53SD2Chpump", name: "The Official 67 Coin", symbol: "67" },
  { address: "FYtP5AiiB4eUjVA88EeZS73PDpi7RPLusdqtXizYpump", name: "GOY", symbol: "GOY" },
  { address: "DL6BBBQ6heTg9Zr5gFZxsCK2AZt2aVyRqUZgChqopump", name: "Tiktok Coin", symbol: "TIKTOK" },
  { address: "66FUGxm2cEsZ3ASXeTTHmT6RggmUPCZAcwWxRknHpump", name: "Johnny", symbol: "JOHNNY" },
  { address: "3zWamrcm37PvqSrf8a1whYxy3ekBCnaVJ1ZX7BEHpump", name: "ascend", symbol: "ascend" },
  { address: "5LCVhWUh2KZd1wZ7MefZGCjF3tvRsqMJjscJSAW9pump", name: "CITY BOY", symbol: "CITYBOY" },
  { address: "14GMPMf3cRANLfJ9QYU19F5XogVGPjCB7f3NLACrpump", name: "Just can't prove it", symbol: "DETECTIVE" },
  { address: "8ZeTmGGktvSwSSghx8btbTAVGdWogThKM4DQBJgRpump", name: "All Roads Lead To Rome", symbol: "Rome" },
  { address: "HmCxqpgxaQng3A73F7vLgJjc9sr6ACFt8CEJwWY2hMGR", name: "Opium Bird", symbol: "OpiumBird" },
  { address: "GZcVdxXSenrKgnkAKCj9Yp7ConTB4poGfBohFVpupump", name: "Nosey", symbol: "Nosey" },
  { address: "8ryRQD6jWfxnSdvvVbQ8Tzwo1NgGP7w1X1nQPpb4pump", name: "meowl the owl cat", symbol: "meowl" },
  { address: "H4EkHReWbjJpqNUiUeYNNZbNKLqLfH8Jt9MkceXGpump", name: "Talking Objects", symbol: "OBJECTS" },
  { address: "Bw4hEZZSz2uff9wZLdpDikgbaWSd5fTEozQkV7KApump", name: "Skeleton Banging Shield", symbol: "RAAAAAH" },
  { address: "8BojTbbG2nnTXA1WgpHxoKdqdoa3AAnDvzqynHZdpump", name: "2-3years Dagestan and forget", symbol: "Dagestan" },
  { address: "6WdHhpRY7vL8SQ69bd89tAj3sk8jsjBrCLDUTZSNpump", name: "JESTERMAXXING", symbol: "JESTER" },
  { address: "4az7oyuUFco8GedLkWYzopurgadkSz8n64xCEXNYpump", name: "Agartha", symbol: "Agartha" },
  { address: "8zkYcsZGnu6yUaQX7hYGJrEHRs8VJuGCVrypXo7ipump", name: "WHY YOU HEZI", symbol: "HEZI" },
  { address: "8Jx8AAHj86wbQgUTjGuj6GTTL5Ps3cqxKRTvpaJApump", name: "Nietzschean Penguin", symbol: "PENGUIN" },
  { address: "32CdQdBUxbCsLy5AUHWmyidfwhgGUr9N573NBUrDpump", name: "maxxing", symbol: "maxxing" },
  { address: "EygStH4gHv1h4E8w4raYv6NGsrDiij3nbfCc26iTpump", name: "Live Action Roleplay", symbol: "LARP" },
];

function ensureSeeded() {
  if (getTokenCount() === 0) {
    for (const coin of SEED_TIKTOK_COINS) {
      upsertToken({
        address: coin.address,
        name: coin.name,
        symbol: coin.symbol,
        source: "pump.fun",
      });
      addCategory(coin.address, "tiktok-meme", 1.0, "seed-list");
    }
  }
}

export async function GET() {
  try {
    // Instant seed — no API calls, just DB inserts
    ensureSeeded();

    // Get all TikTok meme token addresses from DB
    const addresses = getTokenAddressesByCategory("tiktok-meme");

    if (addresses.length === 0) {
      return NextResponse.json([]);
    }

    // Fetch live data from GMGN for each token
    const allTokens: TokenData[] = [];

    // Process in batches of 10
    for (let i = 0; i < addresses.length; i += 10) {
      const batch = addresses.slice(i, i + 10);
      const results = await Promise.allSettled(
        batch.map(async (addr) => {
          const pairs = await getTokenPairs(addr);
          if (pairs.length === 0) return null;
          return pairs.sort((a, b) => b.liquidity - a.liquidity)[0];
        })
      );

      for (const result of results) {
        if (result.status === "fulfilled" && result.value) {
          allTokens.push(result.value);
        }
      }
    }

    // Sort by market cap descending
    allTokens.sort((a, b) => b.marketCap - a.marketCap);

    return NextResponse.json(allTokens);
  } catch (error) {
    console.error("TikTok coins error:", error);
    return NextResponse.json([], { status: 500 });
  }
}
