import { pfetch } from "./fetch";

const MORALIS_BASE = "https://solana-gateway.moralis.io";

function getApiKey(): string {
  const key = process.env.MORALIS_API_KEY;
  if (!key) throw new Error("MORALIS_API_KEY not set in environment");
  return key;
}

export interface MoralisGraduatedToken {
  tokenAddress: string;
  name: string;
  symbol: string;
  logo: string | null;
  decimals: number;
  priceUsd: number | null;
  priceNative: string | null;
  liquidity: number | null;
  fullyDilutedValuation: number | null;
  graduatedAt: string | null;
  holders?: number;
}

export interface MoralisGraduatedResponse {
  result: MoralisGraduatedToken[];
  cursor: string | null;
}

/**
 * Fetch a single page of graduated pump.fun tokens from Moralis.
 */
export async function fetchGraduatedPage(cursor?: string): Promise<MoralisGraduatedResponse> {
  const params = new URLSearchParams({ limit: "100" });
  if (cursor) params.set("cursor", cursor);

  const res = await pfetch(
    `${MORALIS_BASE}/token/mainnet/exchange/pumpfun/graduated?${params}`,
    {
      headers: {
        accept: "application/json",
        "X-API-Key": getApiKey(),
      },
    }
  );

  if (!res.ok) {
    throw new Error(`Moralis API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  return {
    result: data.result ?? [],
    cursor: data.cursor ?? null,
  };
}

/**
 * Fetch ALL graduated pump.fun tokens by paginating through the Moralis API.
 * Filters for "alive" coins: holders > minHolders AND MC > minMarketCap.
 *
 * @param minHolders - Minimum holder count (default 10)
 * @param minMarketCap - Minimum market cap / FDV in USD (default 5000)
 * @param maxPages - Maximum pages to fetch (default 100 = up to 10,000 tokens)
 * @param onPage - Optional callback after each page for progress tracking
 */
export async function fetchAllGraduatedTokens(opts?: {
  minHolders?: number;
  minMarketCap?: number;
  maxPages?: number;
  onPage?: (page: number, total: number, alive: number) => void;
}): Promise<MoralisGraduatedToken[]> {
  const minHolders = opts?.minHolders ?? 10;
  const minMarketCap = opts?.minMarketCap ?? 5000;
  const maxPages = opts?.maxPages ?? 100;

  const aliveTokens: MoralisGraduatedToken[] = [];
  let cursor: string | undefined;
  let page = 0;
  let totalSeen = 0;

  while (page < maxPages) {
    const response = await fetchGraduatedPage(cursor);
    page++;
    totalSeen += response.result.length;

    // Filter for alive coins
    for (const token of response.result) {
      const holders = token.holders ?? 0;
      const mc = token.fullyDilutedValuation ?? 0;
      if (holders >= minHolders && mc >= minMarketCap) {
        aliveTokens.push(token);
      }
    }

    opts?.onPage?.(page, totalSeen, aliveTokens.length);

    // Stop if no more pages
    if (!response.cursor || response.result.length === 0) break;
    cursor = response.cursor;
  }

  return aliveTokens;
}
