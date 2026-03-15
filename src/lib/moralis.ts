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
 * Includes retry logic for transient errors.
 */
export async function fetchGraduatedPage(cursor?: string): Promise<MoralisGraduatedResponse> {
  const params = new URLSearchParams({ limit: "100" });
  if (cursor) params.set("cursor", cursor);

  const maxRetries = 3;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await pfetch(
        `${MORALIS_BASE}/token/mainnet/exchange/pumpfun/graduated?${params}`,
        {
          headers: {
            accept: "application/json",
            "X-API-Key": getApiKey(),
          },
        }
      );

      if (res.status === 500 && attempt < maxRetries) {
        // Transient server error, retry after delay
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        continue;
      }

      if (!res.ok) {
        throw new Error(`Moralis API error: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      return {
        result: data.result ?? [],
        cursor: data.cursor ?? null,
      };
    } catch (err) {
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }

  return { result: [], cursor: null };
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
  onToken?: (token: MoralisGraduatedToken) => void;
}): Promise<MoralisGraduatedToken[]> {
  const minHolders = opts?.minHolders ?? 10;
  const minMarketCap = opts?.minMarketCap ?? 5000;
  const maxPages = opts?.maxPages ?? 100;

  const aliveTokens: MoralisGraduatedToken[] = [];
  let cursor: string | undefined;
  let page = 0;
  let totalSeen = 0;
  let consecutiveErrors = 0;

  while (page < maxPages) {
    try {
      const response = await fetchGraduatedPage(cursor);
      consecutiveErrors = 0;
      page++;
      totalSeen += response.result.length;

      // Filter for alive coins
      for (const token of response.result) {
        const holders = token.holders ?? 0;
        const mc = token.fullyDilutedValuation ?? 0;
        if (holders >= minHolders && mc >= minMarketCap) {
          aliveTokens.push(token);
          opts?.onToken?.(token);
        }
      }

      opts?.onPage?.(page, totalSeen, aliveTokens.length);

      // Stop if no more pages
      if (!response.cursor || response.result.length === 0) break;
      cursor = response.cursor;
    } catch {
      consecutiveErrors++;
      if (consecutiveErrors >= 5) {
        console.error(`[Moralis] Too many consecutive errors, stopping at page ${page}`);
        break;
      }
      // Wait and retry with same cursor
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  return aliveTokens;
}
