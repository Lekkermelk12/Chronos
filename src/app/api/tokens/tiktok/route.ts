import { NextResponse } from "next/server";
import { getTokenAddressesByCategory, getTokenCount } from "@/lib/db";
import { getTokenPairs } from "@/lib/dexscreener";
import { runFullIndex } from "@/lib/indexer";
import { TokenData } from "@/types/token";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Auto-seed on first request if database is empty
    if (getTokenCount() === 0) {
      await runFullIndex();
    }

    // Get all TikTok meme token addresses from DB
    const addresses = getTokenAddressesByCategory("tiktok-meme");

    if (addresses.length === 0) {
      return NextResponse.json([]);
    }

    // Fetch live data from DexScreener for each token
    const allTokens: TokenData[] = [];

    // Process in batches of 10
    for (let i = 0; i < addresses.length; i += 10) {
      const batch = addresses.slice(i, i + 10);
      const results = await Promise.allSettled(
        batch.map(async (addr) => {
          const pairs = await getTokenPairs(addr);
          if (pairs.length === 0) return null;
          // Return highest liquidity pair
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
    return NextResponse.json(
      { error: "Failed to fetch TikTok coins" },
      { status: 500 }
    );
  }
}
