"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { formatUsd } from "@/lib/format";

interface SearchHistoryItem {
  query: string;
  symbol?: string;
  name?: string;
  marketCap?: number;
  imageUrl?: string;
  timestamp: number;
}

interface SearchBarProps {
  onSearch: (query: string) => void;
  loading?: boolean;
}

const HISTORY_KEY = "chronos_search_history";
const MAX_HISTORY = 15;

function getHistory(): SearchHistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveHistory(items: SearchHistoryItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, MAX_HISTORY)));
}

export function addSearchToHistory(
  query: string,
  result?: { symbol?: string; name?: string; marketCap?: number; imageUrl?: string }
) {
  const history = getHistory();
  const filtered = history.filter(
    (h) => h.query.toLowerCase() !== query.toLowerCase()
  );
  filtered.unshift({
    query,
    symbol: result?.symbol,
    name: result?.name,
    marketCap: result?.marketCap,
    imageUrl: result?.imageUrl,
    timestamp: Date.now(),
  });
  saveHistory(filtered);
}

export default function SearchBar({ onSearch, loading }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHistory(getHistory());
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowHistory(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (query.trim()) {
        onSearch(query.trim());
        addSearchToHistory(query.trim());
        setHistory(getHistory());
        setShowHistory(false);
      }
    },
    [query, onSearch]
  );

  const handleHistoryClick = (item: SearchHistoryItem) => {
    setQuery(item.query);
    onSearch(item.query);
    setShowHistory(false);
  };

  const clearHistory = () => {
    localStorage.removeItem(HISTORY_KEY);
    setHistory([]);
  };

  const removeItem = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    const updated = [...history];
    updated.splice(index, 1);
    saveHistory(updated);
    setHistory(updated);
  };

  const timeAgoShort = (ts: number) => {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return "now";
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    const d = Math.floor(h / 24);
    return `${d}d`;
  };

  return (
    <div ref={wrapperRef} className="relative">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            setHistory(getHistory());
            setShowHistory(true);
          }}
          placeholder="Search token name, symbol, or address..."
          className="flex-1 bg-[#2d1a0e] border border-[#5c3a21] rounded-lg px-4 py-2.5 text-[#f5e6c8] placeholder-[#8b7635] focus:outline-none focus:border-[#c9a84c] focus:ring-1 focus:ring-[#c9a84c]/50 transition-colors font-serif"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="bg-[#5c3a21] hover:bg-[#8b6914] disabled:bg-[#2d1a0e] disabled:text-[#5c3a21] text-[#f5e6c8] px-6 py-2.5 rounded-lg font-medium transition-colors border border-[#8b6914]/50 hover:border-[#c9a84c]"
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </form>

      {/* Search History Dropdown */}
      {showHistory && history.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a0f07] border border-[#5c3a21] rounded-lg shadow-xl z-50 max-h-[320px] overflow-y-auto search-history-dropdown">
          <div className="flex items-center justify-between px-3 py-2 border-b border-[#3d2517]">
            <span className="text-[10px] text-[#8b7635] uppercase tracking-wider">
              Recent Searches
            </span>
            <button
              onClick={clearHistory}
              className="text-[10px] text-[#8b3a3a] hover:text-[#ff9999] transition-colors"
            >
              Clear All
            </button>
          </div>
          {history.map((item, i) => (
            <button
              key={`${item.query}-${i}`}
              onClick={() => handleHistoryClick(item)}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#2d1a0e] transition-colors text-left group"
            >
              <span className="text-[#5c3a21] text-xs">🕐</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[#f5e6c8] truncate font-medium">
                    {item.symbol || item.query}
                  </span>
                  {item.name && item.name !== item.query && (
                    <span className="text-xs text-[#8b7635] truncate">
                      {item.name}
                    </span>
                  )}
                </div>
              </div>
              {item.marketCap != null && item.marketCap > 0 && (
                <span className="text-xs text-[#c9a84c] font-mono whitespace-nowrap">
                  MC {formatUsd(item.marketCap)}
                </span>
              )}
              <span className="text-[10px] text-[#5c3a21] whitespace-nowrap">
                {timeAgoShort(item.timestamp)}
              </span>
              <span
                onClick={(e) => removeItem(e, i)}
                className="text-[#5c3a21] hover:text-[#8b3a3a] opacity-0 group-hover:opacity-100 transition-opacity text-xs cursor-pointer"
              >
                ✕
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
