import { DexScreenerPair, TokenData } from "@/types/token";

const BASE_URL = "https://api.dexscreener.com";

export function pairToTokenData(pair: DexScreenerPair): TokenData {
  return {
    address: pair.baseToken.address,
    name: pair.baseToken.name,
    symbol: pair.baseToken.symbol,
    imageUrl: pair.info?.imageUrl,
    priceUsd: parseFloat(pair.priceUsd) || 0,
    priceChange5m: pair.priceChange.m5 ?? 0,
    priceChange1h: pair.priceChange.h1 ?? 0,
    priceChange6h: pair.priceChange.h6 ?? 0,
    priceChange24h: pair.priceChange.h24 ?? 0,
    volume5m: pair.volume.m5 ?? 0,
    volume1h: pair.volume.h1 ?? 0,
    volume6h: pair.volume.h6 ?? 0,
    volume24h: pair.volume.h24 ?? 0,
    liquidity: pair.liquidity?.usd ?? 0,
    marketCap: pair.marketCap ?? 0,
    fdv: pair.fdv ?? 0,
    buys24h: pair.txns.h24?.buys ?? 0,
    sells24h: pair.txns.h24?.sells ?? 0,
    buys1h: pair.txns.h1?.buys ?? 0,
    sells1h: pair.txns.h1?.sells ?? 0,
    pairAddress: pair.pairAddress,
    pairCreatedAt: pair.pairCreatedAt,
    dexUrl: pair.url,
  };
}

export async function searchTokens(query: string): Promise<TokenData[]> {
  const res = await fetch(`${BASE_URL}/latest/dex/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error(`DexScreener search failed: ${res.status}`);
  const data = await res.json();
  const pairs: DexScreenerPair[] = data.pairs ?? [];
  return pairs
    .filter((p) => p.chainId === "solana")
    .map(pairToTokenData);
}

export async function getTokenPairs(tokenAddress: string): Promise<TokenData[]> {
  const res = await fetch(`${BASE_URL}/tokens/v1/solana/${tokenAddress}`);
  if (!res.ok) throw new Error(`DexScreener token lookup failed: ${res.status}`);
  const pairs: DexScreenerPair[] = await res.json();
  return (pairs ?? []).map(pairToTokenData);
}

export async function getTrendingTokens(): Promise<TokenData[]> {
  const res = await fetch(`${BASE_URL}/token-boosts/top/v1`);
  if (!res.ok) throw new Error(`DexScreener trending failed: ${res.status}`);
  const boosts = await res.json();

  // Get unique solana token addresses from boosts
  const solanaTokens = boosts
    .filter((b: { chainId: string }) => b.chainId === "solana")
    .map((b: { tokenAddress: string }) => b.tokenAddress)
    .filter((addr: string, i: number, arr: string[]) => arr.indexOf(addr) === i)
    .slice(0, 20);

  if (solanaTokens.length === 0) return [];

  // Fetch details for each token (batch by comma-separated addresses)
  const allTokenData: TokenData[] = [];
  for (const addr of solanaTokens) {
    try {
      const pairs = await getTokenPairs(addr);
      if (pairs.length > 0) {
        // Take the pair with highest liquidity
        const best = pairs.sort((a, b) => b.liquidity - a.liquidity)[0];
        allTokenData.push(best);
      }
    } catch {
      // Skip tokens that fail
    }
  }

  return allTokenData;
}
