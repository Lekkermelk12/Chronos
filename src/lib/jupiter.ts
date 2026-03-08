import { JupiterPriceResponse } from "@/types/token";

const PRICE_API_URL = "https://api.jup.ag/price/v2";
const TOKEN_API_URL = "https://lite-api.jup.ag/tokens/v2";

function getApiKey(): string {
  return process.env.JUPITER_API_KEY || process.env.NEXT_PUBLIC_JUPITER_API_KEY || "";
}

function headers(): Record<string, string> {
  const key = getApiKey();
  return key ? { "X-API-Key": key } : {};
}

export async function getJupiterPrices(mintAddresses: string[]): Promise<JupiterPriceResponse> {
  const ids = mintAddresses.join(",");
  const res = await fetch(`${PRICE_API_URL}?ids=${ids}`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error(`Jupiter Price API failed: ${res.status}`);
  return res.json();
}

export interface JupiterTokenInfo {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
  tags?: string[];
  daily_volume?: number;
  created_at?: string;
  minted_at?: string;
  freeze_authority?: string | null;
  mint_authority?: string | null;
}

export async function searchJupiterTokens(query: string): Promise<JupiterTokenInfo[]> {
  const res = await fetch(`${TOKEN_API_URL}/search?query=${encodeURIComponent(query)}`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error(`Jupiter Token API search failed: ${res.status}`);
  return res.json();
}

export async function getTrendingJupiterTokens(): Promise<JupiterTokenInfo[]> {
  const res = await fetch(`${TOKEN_API_URL}/toptrending/24h?limit=20`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error(`Jupiter trending failed: ${res.status}`);
  return res.json();
}

export async function getTopTradedTokens(): Promise<JupiterTokenInfo[]> {
  const res = await fetch(`${TOKEN_API_URL}/toptraded/24h?limit=20`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error(`Jupiter top traded failed: ${res.status}`);
  return res.json();
}
