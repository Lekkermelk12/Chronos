"use client";

import { useState, useEffect, useCallback } from "react";
import { TokenData } from "@/types/token";
import TokenTable from "@/components/TokenTable";
import SearchBar from "@/components/SearchBar";

type Tab = "trending" | "search";

export default function Home() {
  const [tokens, setTokens] = useState<TokenData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("trending");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchTrending = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tokens/trending");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setTokens(data);
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Failed to fetch trending tokens:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = useCallback(async (query: string) => {
    setLoading(true);
    setActiveTab("search");
    try {
      const res = await fetch(`/api/tokens/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error("Failed to search");
      const data = await res.json();
      setTokens(data);
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Failed to search tokens:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrending();
  }, [fetchTrending]);

  // Auto-refresh every 30 seconds when on trending tab
  useEffect(() => {
    if (activeTab !== "trending") return;
    const interval = setInterval(fetchTrending, 30_000);
    return () => clearInterval(interval);
  }, [activeTab, fetchTrending]);

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <header className="border-b border-gray-800 bg-[#0a0a0a]/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-[1400px] mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white tracking-tight">
              Chronos
            </h1>
            <span className="text-xs bg-purple-600/20 text-purple-400 px-2 py-0.5 rounded-full">
              Solana
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            {lastUpdated && (
              <span>Updated: {lastUpdated.toLocaleTimeString()}</span>
            )}
            <button
              onClick={fetchTrending}
              disabled={loading}
              className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
            >
              Refresh
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-[1400px] mx-auto px-4 py-6">
        {/* Search */}
        <div className="mb-6">
          <SearchBar onSearch={handleSearch} loading={loading} />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4">
          <button
            onClick={() => {
              setActiveTab("trending");
              fetchTrending();
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "trending"
                ? "bg-purple-600/20 text-purple-400"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            Trending
          </button>
          {activeTab === "search" && (
            <button
              className="px-4 py-2 rounded-lg text-sm font-medium bg-purple-600/20 text-purple-400"
            >
              Search Results
            </button>
          )}
        </div>

        {/* Token Table */}
        <div className="bg-gray-900/50 rounded-xl border border-gray-800 overflow-hidden">
          <TokenTable tokens={tokens} loading={loading} />
        </div>

        {/* Footer info */}
        <div className="mt-4 text-center text-xs text-gray-600">
          Data from DexScreener API &middot; Auto-refreshes every 30s on trending tab
        </div>
      </main>
    </div>
  );
}
