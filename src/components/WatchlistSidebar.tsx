"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { TokenData } from "@/types/token";
import { formatUsd, formatPercent } from "@/lib/format";

interface WatchlistSidebarProps {
  onTokenClick?: (token: TokenData) => void;
}

const WATCHLIST_KEY = "chronos_watchlist";

// ---------------------------------------------------------------------------
// Local helpers — keep localStorage in sync as a fast local cache
// ---------------------------------------------------------------------------

export function getWatchlist(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(WATCHLIST_KEY) || "[]");
  } catch {
    return [];
  }
}

function setLocalWatchlist(addresses: string[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(WATCHLIST_KEY, JSON.stringify(addresses));
}

export function isInWatchlist(address: string): boolean {
  return getWatchlist().includes(address);
}

// Server-synced add/remove — updates local cache and persists to server
export async function toggleWatchlist(address: string): Promise<boolean> {
  const list = getWatchlist();
  const idx = list.indexOf(address);

  if (idx >= 0) {
    list.splice(idx, 1);
    setLocalWatchlist(list);
    await fetch("/api/watchlist", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address }),
    }).catch(() => {}); // fire-and-forget; local state already updated
    return false; // removed
  } else {
    list.unshift(address);
    setLocalWatchlist(list);
    await fetch("/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address }),
    }).catch(() => {});
    return true; // added
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function WatchlistSidebar({ onTokenClick }: WatchlistSidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [addresses, setAddresses] = useState<string[]>([]);
  const [tokens, setTokens] = useState<TokenData[]>([]);
  const [loading, setLoading] = useState(false);

  // Sync addresses from server on mount, then keep local cache warm
  const syncAddresses = useCallback(async () => {
    try {
      const res = await fetch("/api/watchlist");
      if (res.ok) {
        const data = await res.json();
        const serverAddresses: string[] = data.addresses ?? [];
        setAddresses(serverAddresses);
        setLocalWatchlist(serverAddresses); // keep localStorage in sync
      } else {
        // Fallback to localStorage if server is unreachable
        setAddresses(getWatchlist());
      }
    } catch {
      setAddresses(getWatchlist());
    }
  }, []);

  useEffect(() => {
    syncAddresses();
    // Listen for watchlist changes from other components (e.g. TokenTable star click)
    const handler = () => syncAddresses();
    window.addEventListener("watchlist-updated", handler);
    return () => window.removeEventListener("watchlist-updated", handler);
  }, [syncAddresses]);

  // Fetch token data for watchlist addresses when sidebar opens
  useEffect(() => {
    if (!isOpen || addresses.length === 0) {
      setTokens([]);
      return;
    }

    let cancelled = false;

    async function fetchTokens() {
      setLoading(true);
      try {
        const results: TokenData[] = [];
        for (let i = 0; i < addresses.length; i += 5) {
          const batch = addresses.slice(i, i + 5);
          const promises = batch.map(async (addr) => {
            const res = await fetch(`/api/tokens/search?q=${encodeURIComponent(addr)}`);
            if (!res.ok) return null;
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
              return data.find((t: TokenData) => t.address === addr) ?? data[0];
            }
            return null;
          });
          const batchResults = await Promise.all(promises);
          for (const r of batchResults) {
            if (r && !cancelled) results.push(r);
          }
        }
        if (!cancelled) setTokens(results);
      } catch {
        /* silent */
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchTokens();
    return () => { cancelled = true; };
  }, [isOpen, addresses]);

  const removeFromWatchlist = (e: React.MouseEvent, address: string) => {
    e.stopPropagation();
    toggleWatchlist(address).then(() => {
      syncAddresses();
      window.dispatchEvent(new Event("watchlist-updated"));
    });
  };

  return (
    <>
      {/* Toggle Button — fixed on left side */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) syncAddresses();
        }}
        className="watchlist-toggle-btn"
        title="Toggle Watchlist"
      >
        <span className="text-lg">★</span>
        <span className="text-[11px] tracking-wider uppercase mt-0.5 font-bold">Watch</span>
        {addresses.length > 0 && (
          <span className="watchlist-badge">{addresses.length}</span>
        )}
      </button>

      {/* Sidebar Panel */}
      <div className={`watchlist-sidebar ${isOpen ? "watchlist-sidebar-open" : ""}`}>
        <div className="flex items-center justify-between p-3 border-b border-[#6b4427]">
          <div className="flex items-center gap-2">
            <span className="text-[#dbb85c]">★</span>
            <h3 className="text-sm font-extrabold text-[#dbb85c] tracking-wider uppercase">
              Watchlist
            </h3>
            <span className="text-[11px] text-[#a8923e] font-bold bg-[#2d1a0e] px-1.5 py-0.5 rounded">
              {addresses.length}
            </span>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="text-[#a8923e] hover:text-[#dbb85c] transition-colors text-lg"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <span className="text-xs text-[#a8923e] font-medium animate-pulse">
                Loading watchlist…
              </span>
            </div>
          )}

          {!loading && addresses.length === 0 && (
            <div className="text-center py-8 px-4">
              <span className="text-2xl block mb-2">★</span>
              <p className="text-xs text-[#a8923e] font-medium">
                Your watchlist is empty. Click the star on any token to add it here.
              </p>
              <p className="text-[10px] text-[#6b4427] mt-2">Saved to your session</p>
            </div>
          )}

          {!loading &&
            tokens.map((token) => (
              <button
                key={token.address}
                onClick={() => onTokenClick?.(token)}
                className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-[#2d1a0e] transition-colors text-left group border-b border-[#3d2517]/30"
              >
                {token.imageUrl && (
                  <Image
                    src={token.imageUrl}
                    alt={token.symbol}
                    width={24}
                    height={24}
                    className="w-6 h-6 rounded-full border border-[#6b4427]"
                    unoptimized
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-extrabold text-[#faf0da] truncate">
                    {token.symbol}
                  </div>
                  <div className="text-[11px] text-[#a8923e] truncate font-medium">
                    {token.name}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-[#f0dfc0] font-mono font-bold">
                    {formatUsd(token.marketCap)}
                  </div>
                  <div
                    className={`text-[11px] font-mono font-bold ${
                      token.priceChange24h >= 0 ? "text-[#5ea872]" : "text-[#e05555]"
                    }`}
                  >
                    {formatPercent(token.priceChange24h)}
                  </div>
                </div>
                <span
                  onClick={(e) => removeFromWatchlist(e, token.address)}
                  className="text-[#6b4427] hover:text-[#e05555] opacity-0 group-hover:opacity-100 transition-opacity text-xs cursor-pointer ml-1"
                >
                  ✕
                </span>
              </button>
            ))}

          {/* Show addresses that haven't loaded data yet */}
          {!loading &&
            addresses
              .filter((a) => !tokens.find((t) => t.address === a))
              .map((addr) => (
                <div
                  key={addr}
                  className="flex items-center gap-2 px-3 py-2.5 border-b border-[#3d2517]/30 group"
                >
                  <div className="w-6 h-6 rounded-full bg-[#3d2517] flex items-center justify-center text-[11px] text-[#a8923e] font-bold">
                    ?
                  </div>
                  <span className="text-[11px] text-[#a8923e] font-mono truncate flex-1 font-medium">
                    {addr.slice(0, 8)}…{addr.slice(-4)}
                  </span>
                  <span
                    onClick={(e) => removeFromWatchlist(e, addr)}
                    className="text-[#6b4427] hover:text-[#e05555] opacity-0 group-hover:opacity-100 transition-opacity text-xs cursor-pointer"
                  >
                    ✕
                  </span>
                </div>
              ))}
        </div>
      </div>

      {/* Overlay when sidebar is open */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
