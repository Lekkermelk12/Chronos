"use client";

import { TokenData } from "@/types/token";
import { formatUsd, formatNumber, formatPercent, timeAgo } from "@/lib/format";

interface TokenTableProps {
  tokens: TokenData[];
  loading?: boolean;
}

function PriceChangeCell({ value }: { value: number }) {
  const color = value >= 0 ? "text-green-400" : "text-red-400";
  return <span className={color}>{formatPercent(value)}</span>;
}

export default function TokenTable({ tokens, loading }: TokenTableProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
      </div>
    );
  }

  if (tokens.length === 0) {
    return (
      <div className="text-center py-20 text-gray-500">
        No tokens found. Search for a token or wait for trending data to load.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800 text-gray-400 text-left">
            <th className="py-3 px-2 font-medium">#</th>
            <th className="py-3 px-2 font-medium">Token</th>
            <th className="py-3 px-2 font-medium text-right">Price</th>
            <th className="py-3 px-2 font-medium text-right">5m</th>
            <th className="py-3 px-2 font-medium text-right">1h</th>
            <th className="py-3 px-2 font-medium text-right">6h</th>
            <th className="py-3 px-2 font-medium text-right">24h</th>
            <th className="py-3 px-2 font-medium text-right">Vol 24h</th>
            <th className="py-3 px-2 font-medium text-right">Liquidity</th>
            <th className="py-3 px-2 font-medium text-right">MCap</th>
            <th className="py-3 px-2 font-medium text-right">Txns 1h</th>
            <th className="py-3 px-2 font-medium text-right">Age</th>
          </tr>
        </thead>
        <tbody>
          {tokens.map((token, i) => (
            <tr
              key={`${token.pairAddress}-${i}`}
              className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
            >
              <td className="py-3 px-2 text-gray-500">{i + 1}</td>
              <td className="py-3 px-2">
                <a
                  href={token.dexUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 hover:text-purple-400 transition-colors"
                >
                  {token.imageUrl && (
                    <img
                      src={token.imageUrl}
                      alt={token.symbol}
                      className="w-6 h-6 rounded-full"
                    />
                  )}
                  <div>
                    <span className="font-medium text-white">{token.symbol}</span>
                    <span className="text-gray-500 ml-1 text-xs">{token.name}</span>
                  </div>
                </a>
              </td>
              <td className="py-3 px-2 text-right font-mono text-white">
                {formatUsd(token.priceUsd)}
              </td>
              <td className="py-3 px-2 text-right font-mono">
                <PriceChangeCell value={token.priceChange5m} />
              </td>
              <td className="py-3 px-2 text-right font-mono">
                <PriceChangeCell value={token.priceChange1h} />
              </td>
              <td className="py-3 px-2 text-right font-mono">
                <PriceChangeCell value={token.priceChange6h} />
              </td>
              <td className="py-3 px-2 text-right font-mono">
                <PriceChangeCell value={token.priceChange24h} />
              </td>
              <td className="py-3 px-2 text-right font-mono text-gray-300">
                {formatUsd(token.volume24h)}
              </td>
              <td className="py-3 px-2 text-right font-mono text-gray-300">
                {formatUsd(token.liquidity)}
              </td>
              <td className="py-3 px-2 text-right font-mono text-gray-300">
                {formatUsd(token.marketCap)}
              </td>
              <td className="py-3 px-2 text-right">
                <span className="text-green-400">{formatNumber(token.buys1h)}</span>
                <span className="text-gray-600 mx-1">/</span>
                <span className="text-red-400">{formatNumber(token.sells1h)}</span>
              </td>
              <td className="py-3 px-2 text-right text-gray-400">
                {token.pairCreatedAt ? timeAgo(token.pairCreatedAt) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
