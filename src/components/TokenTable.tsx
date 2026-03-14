"use client";

import Image from "next/image";
import { TokenData } from "@/types/token";
import { formatUsd, formatNumber, formatPercent, timeAgo } from "@/lib/format";

interface TokenTableProps {
  tokens: TokenData[];
  loading?: boolean;
  showAlerts?: boolean;
}

function PriceChangeCell({ value }: { value: number }) {
  const color =
    value >= 0 ? "text-[#4a7c59]" : "text-[#8b3a3a]";
  return <span className={`font-mono ${color}`}>{formatPercent(value)}</span>;
}

export default function TokenTable({ tokens, loading, showAlerts }: TokenTableProps) {
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
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#5c3a21] text-[#c9a84c] text-left">
            <th className="py-3 px-2 font-medium">#</th>
            <th className="py-3 px-2 font-medium">Token</th>
            <th className="py-3 px-2 font-medium text-right">Price</th>
            <th className="py-3 px-2 font-medium text-right">5m</th>
            <th className="py-3 px-2 font-medium text-right">1h</th>
            <th className="py-3 px-2 font-medium text-right">6h</th>
            <th className="py-3 px-2 font-medium text-right">24h</th>
            <th className="py-3 px-2 font-medium text-right">Vol 24h</th>
            <th className="py-3 px-2 font-medium text-right">Liq</th>
            <th className="py-3 px-2 font-medium text-right">MCap</th>
            <th className="py-3 px-2 font-medium text-right">Txns 1h</th>
            <th className="py-3 px-2 font-medium text-right">Age</th>
            {showAlerts && (
              <th className="py-3 px-2 font-medium text-right">Signal</th>
            )}
          </tr>
        </thead>
        <tbody>
          {tokens.map((token, i) => (
            <tr
              key={`${token.pairAddress}-${i}`}
              className={`border-b border-[#3d2517]/50 table-row-hover transition-colors token-row ${
                token.isAlert ? "alert-row" : ""
              }`}
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              <td className="py-3 px-2 text-[#bfa97a]">{i + 1}</td>
              <td className="py-3 px-2">
                <a
                  href={token.dexUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 hover:text-[#c9a84c] transition-colors"
                >
                  {token.imageUrl && (
                    <Image
                      src={token.imageUrl}
                      alt={token.symbol}
                      width={24}
                      height={24}
                      className="w-6 h-6 rounded-full border border-[#5c3a21]"
                      unoptimized
                    />
                  )}
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-[#f5e6c8]">{token.symbol}</span>
                    <span className="text-[#8b7635] text-xs">{token.name}</span>
                    {token.hasTiktok && <span className="badge-tiktok">TikTok</span>}
                    {token.isReversal && <span className="badge-reversal">REV</span>}
                    {token.isAlert && <span className="badge-alert">ALERT</span>}
                  </div>
                </a>
              </td>
              <td className="py-3 px-2 text-right font-mono text-[#f5e6c8]">
                {formatUsd(token.priceUsd)}
              </td>
              <td className="py-3 px-2 text-right">
                <PriceChangeCell value={token.priceChange5m} />
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
              <td className="py-3 px-2 text-right font-mono text-[#e8d5b0]">
                {formatUsd(token.volume24h)}
              </td>
              <td className="py-3 px-2 text-right font-mono text-[#e8d5b0]">
                {formatUsd(token.liquidity)}
              </td>
              <td className="py-3 px-2 text-right font-mono text-[#e8d5b0]">
                {formatUsd(token.marketCap)}
              </td>
              <td className="py-3 px-2 text-right">
                <span className="text-[#4a7c59]">{formatNumber(token.buys1h)}</span>
                <span className="text-[#5c3a21] mx-1">/</span>
                <span className="text-[#8b3a3a]">{formatNumber(token.sells1h)}</span>
              </td>
              <td className="py-3 px-2 text-right text-[#bfa97a]">
                {token.pairCreatedAt ? timeAgo(token.pairCreatedAt) : "\u2014"}
              </td>
              {showAlerts && (
                <td className="py-3 px-2 text-right text-xs">
                  {token.alertReason ? (
                    <span className="text-[#c9a84c] italic">{token.alertReason}</span>
                  ) : token.isReversal ? (
                    <span className="text-[#4a7c59]">Reversal detected</span>
                  ) : (
                    <span className="text-[#5c3a21]">&mdash;</span>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
