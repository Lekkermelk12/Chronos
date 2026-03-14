"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { TokenData } from "@/types/token";
import { formatUsd, formatPercent } from "@/lib/format";

interface TrendingTickerProps {
  onTokenClick?: (token: TokenData) => void;
}

export default function TrendingTicker({ onTokenClick }: TrendingTickerProps) {
  const [tokens, setTokens] = useState<TokenData[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    async function fetchTrending() {
      try {
        const res = await fetch("/api/tokens/trending");
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data)) setTokens(data);
      } catch {
        // silent
      }
    }
    fetchTrending();
    const interval = setInterval(fetchTrending, 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || tokens.length === 0) return;

    let animFrame: number;
    let scrollPos = 0;
    const speed = 0.8;

    function animate() {
      if (!isPaused && el) {
        scrollPos += speed;
        if (scrollPos >= el.scrollWidth / 2) {
          scrollPos = 0;
        }
        el.scrollLeft = scrollPos;
      }
      animFrame = requestAnimationFrame(animate);
    }

    animFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrame);
  }, [tokens, isPaused]);

  if (tokens.length === 0) return null;

  // Duplicate tokens for infinite scroll effect
  const displayTokens = [...tokens, ...tokens];

  return (
    <div
      className="trending-ticker"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div ref={scrollRef} className="trending-ticker-scroll">
        <div className="trending-ticker-track">
          {displayTokens.map((token, i) => {
            const change = token.priceChange24h;
            const isUp = change >= 0;
            return (
              <button
                key={`${token.address}-${i}`}
                className="trending-ticker-item"
                onClick={() => onTokenClick?.(token)}
              >
                <span className="text-[#8b7635] text-xs font-bold mr-1">
                  #{(i % tokens.length) + 1}
                </span>
                {token.imageUrl && (
                  <Image
                    src={token.imageUrl}
                    alt={token.symbol}
                    width={18}
                    height={18}
                    className="w-[18px] h-[18px] rounded-full"
                    unoptimized
                  />
                )}
                <span className="font-bold text-[#f5e6c8] text-xs uppercase">
                  {token.symbol}
                </span>
                <span className="text-[#c9a84c] text-xs">
                  ⚡{formatUsd(token.marketCap).replace("$", "")}
                </span>
                <span
                  className={`text-xs font-mono ${
                    isUp ? "text-[#4a7c59]" : "text-[#8b3a3a]"
                  }`}
                >
                  {isUp ? "▲" : "▼"}
                  {formatPercent(change).replace("+", "").replace("-", "")}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
