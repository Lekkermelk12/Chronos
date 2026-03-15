"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Image from "next/image";
import { TokenData } from "@/types/token";
import { formatUsd, formatNumber, formatPercent, timeAgo } from "@/lib/format";
import { toggleWatchlist, getWatchlist } from "@/components/WatchlistSidebar";

type SortKey =
  | "marketCap"
  | "priceUsd"
  | "priceChange1h"
  | "priceChange6h"
  | "priceChange24h"
  | "volume24h"
  | "liquidity"
  | "buys1h"
  | "pairCreatedAt"
  | "rugScore";

type SortDir = "asc" | "desc";

interface TokenTableProps {
  tokens: TokenData[];
  loading?: boolean;
  showAlerts?: boolean;
  onTokenClick?: (token: TokenData) => void;
}

function PriceChangeCell({ value }: { value: number }) {
  const color = value >= 0 ? "text-[#5ea872]" : "text-[#e05555]";
  return <span className={`font-mono font-bold ${color}`}>{formatPercent(value)}</span>;
}

function SafetyBadge({ token }: { token: TokenData }) {
  if (token.rugScore === undefined) {
    return <span className="text-[#6b4427]">&mdash;</span>;
  }
  const score = token.rugScore;
  const mintSafe = token.mintAuthorityDisabled !== false;
  const freezeSafe = token.freezeAuthorityDisabled !== false;

  let color = "text-[#5ea872]";
  let label = "Safe";
  if (score > 1000) {
    color = "text-[#e05555]";
    label = "Danger";
  } else if (score > 400) {
    color = "text-[#e0a555]";
    label = "Warn";
  } else if (score > 100) {
    color = "text-[#d4c49a]";
    label = "OK";
  }

  const details: string[] = [];
  if (!mintSafe) details.push("Mint enabled");
  if (!freezeSafe) details.push("Freeze enabled");

  return (
    <span className={color} title={details.length > 0 ? details.join(", ") : `RugCheck score: ${score}`}>
      {label}
    </span>
  );
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <span className="text-[#3d2517] ml-0.5">&#9650;</span>;
  return (
    <span className="text-[#dbb85c] ml-0.5">
      {dir === "desc" ? "\u25BC" : "\u25B2"}
    </span>
  );
}

export default function TokenTable({
  tokens,
  loading,
  showAlerts,
  onTokenClick,
}: TokenTableProps) {
  const [watchedAddresses, setWatchedAddresses] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("marketCap");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sortedTokens = useMemo(() => {
    const sorted = [...tokens].sort((a, b) => {
      let aVal: number, bVal: number;
      if (sortKey === "buys1h") {
        aVal = a.buys1h + a.sells1h;
        bVal = b.buys1h + b.sells1h;
      } else {
        aVal = (a[sortKey] as number) ?? 0;
        bVal = (b[sortKey] as number) ?? 0;
      }
      return sortDir === "desc" ? bVal - aVal : aVal - bVal;
    });
    return sorted;
  }, [tokens, sortKey, sortDir]);

  const refreshWatchlist = useCallback(() => {
    setWatchedAddresses(new Set(getWatchlist()));
  }, []);

  useEffect(() => {
    refreshWatchlist();
    const handler = () => refreshWatchlist();
    window.addEventListener("watchlist-updated", handler);
    return () => window.removeEventListener("watchlist-updated", handler);
  }, [refreshWatchlist]);

  const handleStar = (e: React.MouseEvent, token: TokenData) => {
    e.stopPropagation();
    toggleWatchlist(token.address);
    refreshWatchlist();
    window.dispatchEvent(new Event("watchlist-updated"));
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="animate-pendulum">
          <svg width="24" height="48" viewBox="0 0 24 48">
            <line x1="12" y1="0" x2="12" y2="40" stroke="#c9a84c" strokeWidth="1.5" />
            <circle cx="12" cy="42" r="5" fill="#c9a84c" />
          </svg>
        </div>
        <span className="text-[#bfa97a] text-sm italic">Winding the clock...</span>
      </div>
    );
  }

  if (tokens.length === 0) {
    return (
      <div className="text-center py-20 text-[#bfa97a] italic">
        No tokens found. The clock is still searching through time...
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b-2 border-[#6b4427] text-[#dbb85c] text-left">
            <th className="py-3 px-1 font-bold w-8"></th>
            <th className="py-3 px-2 font-bold">#</th>
            <th className="py-3 px-2 font-bold">Token</th>
            <th className="py-3 px-2 font-bold text-right cursor-pointer select-none hover:text-[#faf0da] transition-colors" onClick={() => handleSort("priceUsd")}>
              Price <SortIcon active={sortKey === "priceUsd"} dir={sortDir} />
            </th>
            <th className="py-3 px-2 font-bold text-right cursor-pointer select-none hover:text-[#faf0da] transition-colors" onClick={() => handleSort("priceChange1h")}>
              1h <SortIcon active={sortKey === "priceChange1h"} dir={sortDir} />
            </th>
            <th className="py-3 px-2 font-bold text-right cursor-pointer select-none hover:text-[#faf0da] transition-colors" onClick={() => handleSort("priceChange6h")}>
              6h <SortIcon active={sortKey === "priceChange6h"} dir={sortDir} />
            </th>
            <th className="py-3 px-2 font-bold text-right cursor-pointer select-none hover:text-[#faf0da] transition-colors" onClick={() => handleSort("priceChange24h")}>
              24h <SortIcon active={sortKey === "priceChange24h"} dir={sortDir} />
            </th>
            <th className="py-3 px-2 font-bold text-right cursor-pointer select-none hover:text-[#faf0da] transition-colors" onClick={() => handleSort("volume24h")}>
              Vol 24h <SortIcon active={sortKey === "volume24h"} dir={sortDir} />
            </th>
            <th className="py-3 px-2 font-bold text-right cursor-pointer select-none hover:text-[#faf0da] transition-colors" onClick={() => handleSort("liquidity")}>
              Liq <SortIcon active={sortKey === "liquidity"} dir={sortDir} />
            </th>
            <th className="py-3 px-2 font-bold text-right cursor-pointer select-none hover:text-[#faf0da] transition-colors" onClick={() => handleSort("marketCap")}>
              MCap <SortIcon active={sortKey === "marketCap"} dir={sortDir} />
            </th>
            <th className="py-3 px-2 font-bold text-right cursor-pointer select-none hover:text-[#faf0da] transition-colors" onClick={() => handleSort("buys1h")}>
              Txns 1h <SortIcon active={sortKey === "buys1h"} dir={sortDir} />
            </th>
            <th className="py-3 px-2 font-bold text-right cursor-pointer select-none hover:text-[#faf0da] transition-colors" onClick={() => handleSort("pairCreatedAt")}>
              Age <SortIcon active={sortKey === "pairCreatedAt"} dir={sortDir} />
            </th>
            <th className="py-3 px-2 font-bold text-right cursor-pointer select-none hover:text-[#faf0da] transition-colors" onClick={() => handleSort("rugScore")}>
              Safety <SortIcon active={sortKey === "rugScore"} dir={sortDir} />
            </th>
            {showAlerts && (
              <th className="py-3 px-2 font-bold text-right">Signal</th>
            )}
          </tr>
        </thead>
        <tbody>
          {sortedTokens.map((token, i) => {
            const isWatched = watchedAddresses.has(token.address);
            return (
              <tr
                key={`${token.pairAddress}-${i}`}
                className={`border-b border-[#3d2517]/50 table-row-hover transition-colors token-row cursor-pointer ${
                  token.isAlert ? "alert-row" : ""
                }`}
                style={{ animationDelay: `${i * 0.05}s` }}
                onClick={() => onTokenClick?.(token)}
              >
                <td className="py-3 px-1">
                  <button
                    onClick={(e) => handleStar(e, token)}
                    className={`text-sm transition-colors ${
                      isWatched
                        ? "text-[#c9a84c]"
                        : "text-[#3d2517] hover:text-[#8b7635]"
                    }`}
                    title={isWatched ? "Remove from watchlist" : "Add to watchlist"}
                  >
                    {isWatched ? "★" : "☆"}
                  </button>
                </td>
                <td className="py-3 px-2 text-[#d4c49a] font-semibold">{i + 1}</td>
                <td className="py-3 px-2">
                  <div className="flex items-center gap-2 group/token">
                    {token.imageUrl && (
                      <Image
                        src={token.imageUrl}
                        alt={token.symbol}
                        width={26}
                        height={26}
                        className="w-[26px] h-[26px] rounded-full border border-[#6b4427]"
                        unoptimized
                      />
                    )}
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-[#faf0da]">{token.symbol}</span>
                        <span className="text-[#a8923e] text-xs font-medium">{token.name}</span>
                        {token.hasTiktok && <span className="badge-tiktok">TikTok</span>}
                        {token.isGithub && <span className="badge-github">GitHub</span>}
                        {token.isReversal && <span className="badge-reversal">REV</span>}
                        {token.isAlert && <span className="badge-alert">ALERT</span>}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5 opacity-0 group-hover/token:opacity-100 transition-opacity">
                        <span className="text-[10px] text-[#6b4427] font-mono">
                          {token.address.slice(0, 6)}...{token.address.slice(-4)}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(token.address);
                          }}
                          className="text-[10px] text-[#6b4427] hover:text-[#dbb85c] transition-colors"
                          title="Copy address"
                        >
                          [copy]
                        </button>
                      </div>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-2 text-right font-mono font-bold text-[#faf0da]">
                  {formatUsd(token.priceUsd)}
                </td>
                <td className="py-3 px-2 text-right">
                  <PriceChangeCell value={token.priceChange1h} />
                </td>
                <td className="py-3 px-2 text-right">
                  <PriceChangeCell value={token.priceChange6h} />
                </td>
                <td className="py-3 px-2 text-right">
                  <PriceChangeCell value={token.priceChange24h} />
                </td>
                <td className="py-3 px-2 text-right font-mono font-semibold text-[#f0dfc0]">
                  {formatUsd(token.volume24h)}
                </td>
                <td className="py-3 px-2 text-right font-mono font-semibold text-[#f0dfc0]">
                  {formatUsd(token.liquidity)}
                </td>
                <td className="py-3 px-2 text-right font-mono font-bold text-[#dbb85c]">
                  {formatUsd(token.marketCap)}
                </td>
                <td className="py-3 px-2 text-right font-semibold">
                  <span className="text-[#5ea872]">{formatNumber(token.buys1h)}</span>
                  <span className="text-[#6b4427] mx-1">/</span>
                  <span className="text-[#e05555]">{formatNumber(token.sells1h)}</span>
                </td>
                <td className="py-3 px-2 text-right text-[#d4c49a] font-medium">
                  {token.pairCreatedAt ? timeAgo(token.pairCreatedAt) : "\u2014"}
                </td>
                <td className="py-3 px-2 text-right text-xs font-semibold">
                  <SafetyBadge token={token} />
                </td>
                {showAlerts && (
                  <td className="py-3 px-2 text-right text-xs font-semibold">
                    {token.alertReason ? (
                      <span className="text-[#dbb85c]">{token.alertReason}</span>
                    ) : token.isReversal ? (
                      <span className="text-[#5ea872]">Reversal detected</span>
                    ) : (
                      <span className="text-[#6b4427]">&mdash;</span>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
