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
  dexId?: string;
  hasTiktok?: boolean;
  tiktokUrl?: string;
  socials?: { type: string; url: string }[];
  isReversal?: boolean;
  reversalMultiple?: number;
  isAlert?: boolean;
  alertReason?: string;
  isGithub?: boolean;
  githubUrl?: string;
  rugScore?: number;
  mintAuthorityDisabled?: boolean;
  freezeAuthorityDisabled?: boolean;
  lpLocked?: boolean;
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
