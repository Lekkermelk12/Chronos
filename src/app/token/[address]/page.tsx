"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { TokenData } from "@/types/token";
import {
  formatUsd,
  formatNumber,
  formatPercent,
  timeAgo,
} from "@/lib/format";
import { toggleWatchlist, isInWatchlist } from "@/components/WatchlistSidebar";

type TimeFrame = "5m" | "1h" | "6h" | "24h";

export default function TokenDetailPage() {
  const params = useParams();
  const router = useRouter();
  const address = params.address as string;

  const [token, setToken] = useState<TokenData | null>(null);
  const [loading, setLoading] = useState(true);
  const [watched, setWatched] = useState(false);
  const [activeTimeframe, setActiveTimeframe] = useState<TimeFrame>("24h");

  const fetchToken = useCallback(async () => {
    try {
      const res = await fetch(`/api/tokens/search?q=${encodeURIComponent(address)}`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const match = data.find((t: TokenData) => t.address === address) || data[0];
        setToken(match);
      }
    } catch {
      console.error("Failed to fetch token");
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchToken();
    setWatched(isInWatchlist(address));
  }, [address, fetchToken]);

  // Auto-refresh
  useEffect(() => {
    const interval = setInterval(fetchToken, 30_000);
    return () => clearInterval(interval);
  }, [fetchToken]);

  const handleToggleWatchlist = () => {
    const added = toggleWatchlist(address);
    setWatched(added);
    window.dispatchEvent(new Event("watchlist-updated"));
  };

  const getPriceChangeForTimeframe = (tf: TimeFrame) => {
    if (!token) return 0;
    switch (tf) {
      case "5m": return token.priceChange5m;
      case "1h": return token.priceChange1h;
      case "6h": return token.priceChange6h;
      case "24h": return token.priceChange24h;
    }
  };

  const getVolumeForTimeframe = (tf: TimeFrame) => {
    if (!token) return 0;
    switch (tf) {
      case "5m": return token.volume5m;
      case "1h": return token.volume1h;
      case "6h": return token.volume6h;
      case "24h": return token.volume24h;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen wood-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pendulum inline-block mb-4">
            <svg width="24" height="48" viewBox="0 0 24 48">
              <line x1="12" y1="0" x2="12" y2="40" stroke="#c9a84c" strokeWidth="1.5" />
              <circle cx="12" cy="42" r="5" fill="#c9a84c" />
            </svg>
          </div>
          <p className="text-[#d4c49a] text-sm font-medium">Loading token data...</p>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen wood-bg flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#d4c49a] text-lg font-semibold mb-4">Token not found</p>
          <button
            onClick={() => router.push("/")}
            className="text-[#dbb85c] hover:underline text-sm font-semibold"
          >
            &larr; Back to Chronos
          </button>
        </div>
      </div>
    );
  }

  const totalTxns = token.buys24h + token.sells24h;
  const buyPercent = totalTxns > 0 ? (token.buys24h / totalTxns) * 100 : 50;
  const totalTxns1h = token.buys1h + token.sells1h;
  const buyPercent1h = totalTxns1h > 0 ? (token.buys1h / totalTxns1h) * 100 : 50;

  // Build DexScreener chart embed URL
  const chartUrl = token.pairAddress
    ? `https://dexscreener.com/solana/${token.pairAddress}?embed=1&theme=dark&trades=0&info=0`
    : null;

  return (
    <div className="min-h-screen wood-bg">
      {/* Top Bar */}
      <header className="border-b border-[#6b4427] bg-[#1a0f07]/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-[1600px] mx-auto px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/")}
              className="text-[#d4c49a] hover:text-[#dbb85c] transition-colors text-sm font-semibold"
            >
              &larr; Back
            </button>
            <div className="w-px h-6 bg-[#6b4427]" />
            <div className="flex items-center gap-2">
              {token.imageUrl && (
                <Image
                  src={token.imageUrl}
                  alt={token.symbol}
                  width={30}
                  height={30}
                  className="w-[30px] h-[30px] rounded-full border border-[#6b4427]"
                  unoptimized
                />
              )}
              <div>
                <h1 className="text-lg font-extrabold text-[#faf0da]">
                  {token.symbol}
                  <span className="text-sm text-[#a8923e] ml-2 font-semibold">
                    {token.name}
                  </span>
                </h1>
                <div className="flex items-center gap-2 text-[11px] text-[#a8923e] font-medium">
                  <span>Solana</span>
                  <span>&middot;</span>
                  <span>{token.dexId || "DEX"}</span>
                  {token.pairCreatedAt && (
                    <>
                      <span>&middot;</span>
                      <span>{timeAgo(token.pairCreatedAt)}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleWatchlist}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                watched
                  ? "bg-[#dbb85c]/20 border-[#dbb85c] text-[#dbb85c]"
                  : "bg-[#2d1a0e] border-[#6b4427] text-[#d4c49a] hover:border-[#dbb85c]/50"
              }`}
            >
              <span>{watched ? "★" : "☆"}</span>
              {watched ? "Watching" : "Watch"}
            </button>
            {token.dexUrl && (
              <a
                href={token.dexUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-[#d4c49a] hover:text-[#dbb85c] border border-[#6b4427] px-3 py-1.5 rounded-lg transition-colors"
              >
                DexScreener ↗
              </a>
            )}
            <a
              href={`https://pump.fun/coin/${token.address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-[#d4c49a] hover:text-[#dbb85c] border border-[#6b4427] px-3 py-1.5 rounded-lg transition-colors"
            >
              PumpFun ↗
            </a>
            <a
              href={`https://solscan.io/token/${token.address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-[#d4c49a] hover:text-[#dbb85c] border border-[#6b4427] px-3 py-1.5 rounded-lg transition-colors"
            >
              Solscan ↗
            </a>
            {token.githubUrl && (
              <a
                href={token.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-[#d4c49a] hover:text-[#dbb85c] border border-[#6b4427] px-3 py-1.5 rounded-lg transition-colors"
              >
                GitHub ↗
              </a>
            )}
            {token.socials?.map((s, i) => (
              <a
                key={i}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-[#d4c49a] hover:text-[#dbb85c] border border-[#6b4427] px-2 py-1.5 rounded-lg transition-colors capitalize"
              >
                {s.type}
              </a>
            ))}
          </div>
        </div>
      </header>

      <div className="max-w-[1600px] mx-auto px-4 py-4">
        {/* Price & Key Metrics Row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          <div className="metric-card col-span-2 md:col-span-1">
            <div className="text-xs text-[#a8923e] uppercase tracking-wider mb-1 font-bold">
              Price USD
            </div>
            <div className="text-xl font-extrabold text-[#faf0da] font-mono">
              {formatUsd(token.priceUsd)}
            </div>
          </div>
          <div className="metric-card">
            <div className="text-xs text-[#a8923e] uppercase tracking-wider mb-1 font-bold">
              Market Cap
            </div>
            <div className="text-xl font-extrabold text-[#dbb85c] font-mono">
              {formatUsd(token.marketCap)}
            </div>
          </div>
          <div className="metric-card">
            <div className="text-xs text-[#a8923e] uppercase tracking-wider mb-1 font-bold">
              Liquidity
            </div>
            <div className="text-xl font-extrabold text-[#f0dfc0] font-mono">
              {formatUsd(token.liquidity)}
            </div>
          </div>
          <div className="metric-card">
            <div className="text-xs text-[#a8923e] uppercase tracking-wider mb-1 font-bold">
              FDV
            </div>
            <div className="text-xl font-extrabold text-[#f0dfc0] font-mono">
              {formatUsd(token.fdv)}
            </div>
          </div>
          <div className="metric-card">
            <div className="text-xs text-[#a8923e] uppercase tracking-wider mb-1 font-bold">
              Vol 24h
            </div>
            <div className="text-xl font-extrabold text-[#f0dfc0] font-mono">
              {formatUsd(token.volume24h)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Chart - Main area */}
          <div className="lg:col-span-3">
            <div className="ornate-border rounded-xl overflow-hidden bg-[#0d0907]">
              {chartUrl ? (
                <iframe
                  src={chartUrl}
                  className="w-full border-0"
                  style={{ height: "500px" }}
                  title={`${token.symbol} Chart`}
                  sandbox="allow-scripts allow-same-origin allow-popups"
                />
              ) : (
                <div className="flex items-center justify-center h-[500px] text-[#a8923e] italic text-sm">
                  Chart unavailable - no pair data
                </div>
              )}
            </div>
          </div>

          {/* Right sidebar - Metrics */}
          <div className="lg:col-span-1 space-y-3">
            {/* Price Changes */}
            <div className="ornate-border rounded-xl bg-[#1a0f07]/80 p-3">
              <div className="text-xs text-[#a8923e] uppercase tracking-wider mb-2 font-bold">
                Price Change
              </div>
              <div className="grid grid-cols-4 gap-1">
                {(["5m", "1h", "6h", "24h"] as TimeFrame[]).map((tf) => {
                  const val = getPriceChangeForTimeframe(tf);
                  const isActive = activeTimeframe === tf;
                  return (
                    <button
                      key={tf}
                      onClick={() => setActiveTimeframe(tf)}
                      className={`text-center py-1.5 rounded text-xs transition-all ${
                        isActive
                          ? "bg-[#5c3a21] border border-[#c9a84c]/50"
                          : "bg-[#2d1a0e] border border-transparent hover:border-[#6b4427]"
                      }`}
                    >
                      <div className="text-[11px] text-[#a8923e] mb-0.5 font-semibold">{tf.toUpperCase()}</div>
                      <div
                        className={`font-mono font-bold ${
                          val >= 0 ? "text-[#5ea872]" : "text-[#e05555]"
                        }`}
                      >
                        {formatPercent(val)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Transaction Stats */}
            <div className="ornate-border rounded-xl bg-[#1a0f07]/80 p-3">
              <div className="text-xs text-[#a8923e] uppercase tracking-wider mb-2 font-bold">
                Transactions (24h)
              </div>
              <div className="text-center mb-2">
                <span className="text-xl font-bold text-[#f5e6c8] font-mono">
                  {formatNumber(totalTxns)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-[#5ea872] font-mono">
                  Buys: {formatNumber(token.buys24h)}
                </span>
                <span className="text-[#e05555] font-mono">
                  Sells: {formatNumber(token.sells24h)}
                </span>
              </div>
              <div className="h-2 bg-[#2d1a0e] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#4a7c59] to-[#5a9c6a] rounded-full transition-all"
                  style={{ width: `${buyPercent}%` }}
                />
              </div>
            </div>

            {/* 1h Stats */}
            <div className="ornate-border rounded-xl bg-[#1a0f07]/80 p-3">
              <div className="text-xs text-[#a8923e] uppercase tracking-wider mb-2 font-bold">
                Transactions (1h)
              </div>
              <div className="text-center mb-2">
                <span className="text-xl font-bold text-[#f5e6c8] font-mono">
                  {formatNumber(totalTxns1h)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-[#5ea872] font-mono">
                  Buys: {formatNumber(token.buys1h)}
                </span>
                <span className="text-[#e05555] font-mono">
                  Sells: {formatNumber(token.sells1h)}
                </span>
              </div>
              <div className="h-2 bg-[#2d1a0e] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#4a7c59] to-[#5a9c6a] rounded-full transition-all"
                  style={{ width: `${buyPercent1h}%` }}
                />
              </div>
            </div>

            {/* Volume by Timeframe */}
            <div className="ornate-border rounded-xl bg-[#1a0f07]/80 p-3">
              <div className="text-xs text-[#a8923e] uppercase tracking-wider mb-2 font-bold">
                Volume
              </div>
              <div className="space-y-2">
                {(["5m", "1h", "6h", "24h"] as TimeFrame[]).map((tf) => (
                  <div key={tf} className="flex items-center justify-between text-xs">
                    <span className="text-[#a8923e] uppercase">{tf}</span>
                    <span className="text-[#f0dfc0] font-mono">
                      {formatUsd(getVolumeForTimeframe(tf))}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Token Info */}
            <div className="ornate-border rounded-xl bg-[#1a0f07]/80 p-3">
              <div className="text-xs text-[#a8923e] uppercase tracking-wider mb-2 font-bold">
                Token Info
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[#a8923e]">Address</span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="text-[#d4c49a] font-mono cursor-pointer hover:text-[#c9a84c] transition-colors"
                      onClick={() => navigator.clipboard.writeText(token.address)}
                      title="Click to copy"
                    >
                      {token.address.slice(0, 6)}...{token.address.slice(-4)}
                    </span>
                    <a
                      href={`https://solscan.io/token/${token.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#a8923e] hover:text-[#dbb85c] transition-colors"
                      title="View on Solscan"
                    >
                      ↗
                    </a>
                  </div>
                </div>
                {token.pairAddress && (
                  <div className="flex items-center justify-between">
                    <span className="text-[#a8923e]">Pair</span>
                    <span
                      className="text-[#d4c49a] font-mono cursor-pointer hover:text-[#c9a84c] transition-colors"
                      onClick={() =>
                        navigator.clipboard.writeText(token.pairAddress)
                      }
                      title="Click to copy"
                    >
                      {token.pairAddress.slice(0, 6)}...
                      {token.pairAddress.slice(-4)}
                    </span>
                  </div>
                )}
                {token.pairCreatedAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-[#a8923e]">Created</span>
                    <span className="text-[#d4c49a]">
                      {timeAgo(token.pairCreatedAt)}
                    </span>
                  </div>
                )}
                {token.dexId && (
                  <div className="flex items-center justify-between">
                    <span className="text-[#a8923e]">DEX</span>
                    <span className="text-[#d4c49a] capitalize">
                      {token.dexId}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
