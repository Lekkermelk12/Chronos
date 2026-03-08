export interface DexScreenerPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceNative: string;
  priceUsd: string;
  txns: {
    m5: { buys: number; sells: number };
    h1: { buys: number; sells: number };
    h6: { buys: number; sells: number };
    h24: { buys: number; sells: number };
  };
  volume: {
    m5: number;
    h1: number;
    h6: number;
    h24: number;
  };
  priceChange: {
    m5: number;
    h1: number;
    h6: number;
    h24: number;
  };
  liquidity: {
    usd: number;
    base: number;
    quote: number;
  };
  fdv: number;
  marketCap: number;
  pairCreatedAt: number;
  info?: {
    imageUrl?: string;
    websites?: { label: string; url: string }[];
    socials?: { type: string; url: string }[];
  };
}

export interface DexScreenerResponse {
  schemaVersion: string;
  pairs: DexScreenerPair[];
}

export interface TokenData {
  address: string;
  name: string;
  symbol: string;
  imageUrl?: string;
  priceUsd: number;
  priceChange5m: number;
  priceChange1h: number;
  priceChange6h: number;
  priceChange24h: number;
  volume5m: number;
  volume1h: number;
  volume6h: number;
  volume24h: number;
  liquidity: number;
  marketCap: number;
  fdv: number;
  buys24h: number;
  sells24h: number;
  buys1h: number;
  sells1h: number;
  pairAddress: string;
  pairCreatedAt: number;
  dexUrl: string;
}

export interface JupiterPriceData {
  id: string;
  type: string;
  price: string;
  extraInfo?: {
    lastSwappedPrice?: {
      lastJupiterSellAt: number;
      lastJupiterSellPrice: string;
      lastJupiterBuyAt: number;
      lastJupiterBuyPrice: string;
    };
    quotedPrice?: {
      buyPrice: string;
      buyAt: number;
      sellPrice: string;
      sellAt: number;
    };
    confidenceLevel: string;
    depth?: {
      buyPriceImpactRatio: Record<string, number>;
      sellPriceImpactRatio: Record<string, number>;
    };
  };
}

export interface JupiterPriceResponse {
  data: Record<string, JupiterPriceData>;
  timeTaken: number;
}
