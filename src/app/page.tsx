"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { TokenData } from "@/types/token";
import TokenTable from "@/components/TokenTable";
import ClockLogo from "@/components/ClockLogo";
import SearchBar, { addSearchToHistory } from "@/components/SearchBar";
import TrendingTicker from "@/components/TrendingTicker";
import WatchlistSidebar from "@/components/WatchlistSidebar";

type Tab = "migrated" | "tiktok" | "old" | "reversals" | "github";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "migrated", label: "Migrated", icon: "\uD83D\uDE80" },
  { key: "tiktok", label: "TikTok Coins", icon: "\u266B" },
  { key: "old", label: "Old Raydium", icon: "\u231B" },
  { key: "reversals", label: "Reversals", icon: "\u26A1" },
  { key: "github", label: "GitHub Coins", icon: "\uD83D\uDCBB" },
];

const TAB_ENDPOINTS: Record<Tab, string> = {
  migrated: "/api/tokens/migrated",
  tiktok: "/api/tokens/tiktok",
  old: "/api/tokens/old",
  reversals: "/api/tokens/reversals",
  github: "/api/tokens/github",
};

export default function Home() {
  const router = useRouter();
  const [tokens, setTokens] = useState<TokenData[]>([]);
  const [searchResults, setSearchResults] = useState<TokenData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("migrated");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [alertCount, setAlertCount] = useState(0);
  const [migratedPage, setMigratedPage] = useState(1);
  const [migratedTotal, setMigratedTotal] = useState(0);
  const migratedPageSize = 50;

  const fetchTab = useCallback(async (tab: Tab, page?: number) => {
    setLoading(true);
    setShowSearch(false);
    try {
      let url = TAB_ENDPOINTS[tab];
      if (tab === "migrated") {
        const p = page ?? 1;
        url += `?page=${p}&pageSize=${migratedPageSize}`;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();

      if (tab === "migrated" && data.tokens) {
        setTokens(Array.isArray(data.tokens) ? data.tokens : []);
        setMigratedTotal(data.total ?? 0);
        setMigratedPage(data.page ?? 1);
      } else {
        const tokens = Array.isArray(data) ? data : [];
        setTokens(tokens);

        if (tab === "reversals") {
          setAlertCount(tokens.filter((t: TokenData) => t.isAlert).length);
        }
      }
      setLastUpdated(new Date());
    } catch (error) {
      console.error(`Failed to fetch ${tab} tokens:`, error);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = useCallback(async (query: string) => {
    setLoading(true);
    setShowSearch(true);
    try {
      const res = await fetch(`/api/tokens/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error("Failed to search");
      const data = await res.json();
      const results = Array.isArray(data) ? data : [];
      setSearchResults(results);
      setLastUpdated(new Date());

      // Save the top result info to search history
      if (results.length > 0) {
        const top = results[0];
        addSearchToHistory(query, {
          symbol: top.symbol,
          name: top.name,
          marketCap: top.marketCap,
          imageUrl: top.imageUrl,
        });
      }
    } catch (error) {
      console.error("Failed to search tokens:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTab(activeTab);
  }, [activeTab, fetchTab]);

  // Auto-refresh every 45 seconds
  useEffect(() => {
    const interval = setInterval(() => fetchTab(activeTab), 45_000);
    return () => clearInterval(interval);
  }, [activeTab, fetchTab]);

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setShowSearch(false);
  };

  const handleTokenClick = (token: TokenData) => {
    router.push(`/token/${token.address}`);
  };

  return (
    <div className="min-h-screen wood-bg">
      {/* Watchlist Sidebar */}
      <WatchlistSidebar onTokenClick={handleTokenClick} />

      {/* Header */}
      <header className="border-b border-[#5c3a21] bg-[#1a0f07]/90 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-[1400px] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ClockLogo />
            <div>
              <h1
                className="text-2xl font-bold tracking-wide"
                style={{
                  color: "#c9a84c",
                  textShadow: "0 0 20px rgba(201, 168, 76, 0.3)",
                  fontFamily: "'Georgia', serif",
                  letterSpacing: "0.15em",
                }}
              >
                CHRONOS
              </h1>
              <p className="text-[10px] text-[#8b7635] tracking-[0.3em] uppercase -mt-0.5">
                Solana Time Machine
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm text-[#bfa97a]">
            {alertCount > 0 && activeTab === "reversals" && (
              <span className="animate-glow text-xs bg-[#8b3a3a]/30 text-[#c9a84c] px-2.5 py-1 rounded-full border border-[#c9a84c]/30">
                {alertCount} Alert{alertCount > 1 ? "s" : ""}
              </span>
            )}
            {lastUpdated && (
              <span className="text-xs text-[#8b7635]">
                {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={() => fetchTab(activeTab)}
              disabled={loading}
              className="text-[#bfa97a] hover:text-[#c9a84c] transition-colors disabled:opacity-50 text-xs border border-[#5c3a21] px-3 py-1 rounded hover:border-[#c9a84c]/50"
            >
              Refresh
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-[1400px] mx-auto px-4 py-4">
        {/* Search */}
        <div className="mb-3">
          <SearchBar onSearch={handleSearch} loading={loading} />
        </div>

        {/* Trending Ticker - horizontal bar under search */}
        <div className="mb-4">
          <TrendingTicker onTokenClick={handleTokenClick} />
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 ${
                activeTab === tab.key && !showSearch
                  ? "tab-active"
                  : "tab-inactive"
              }`}
            >
              <span className="mr-1.5">{tab.icon}</span>
              {tab.label}
              {tab.key === "reversals" && alertCount > 0 && (
                <span className="ml-2 bg-[#8b3a3a] text-[#ff9999] text-[10px] px-1.5 py-0.5 rounded-full">
                  {alertCount}
                </span>
              )}
            </button>
          ))}
          {showSearch && (
            <button className="px-5 py-2.5 rounded-lg text-sm font-medium tab-active animate-slide-in">
              Search Results
            </button>
          )}
        </div>

        {/* Tab description */}
        <div className="mb-3 text-xs text-[#8b7635] italic animate-fade-in-up">
          {!showSearch && activeTab === "migrated" && (
            <span>
              Pump.fun graduated coins on Raydium/PumpSwap &middot; {migratedTotal.toLocaleString()} alive coins in DB
              {migratedTotal > 0 && ` \u00B7 Page ${migratedPage} of ${Math.ceil(migratedTotal / migratedPageSize)}`}
            </span>
          )}
          {!showSearch && activeTab === "tiktok" && (
            <span>Coins with TikTok links on DexScreener &middot; Sorted by market cap</span>
          )}
          {!showSearch && activeTab === "old" && (
            <span>Raydium &amp; PumpSwap coins over 1 day old with 6K+ market cap</span>
          )}
          {!showSearch && activeTab === "reversals" && (
            <span>Coins showing reversal patterns &middot; Volume spikes &amp; MC breakouts</span>
          )}
          {!showSearch && activeTab === "github" && (
            <span>PumpFun coins with GitHub-linked creators &middot; Devs can claim creator rewards</span>
          )}
        </div>

        {/* Token Table */}
        <div className="ornate-border rounded-xl overflow-hidden bg-[#1a0f07]/80">
          <TokenTable
            tokens={showSearch ? searchResults : tokens}
            loading={loading}
            showAlerts={activeTab === "reversals" && !showSearch}
            onTokenClick={handleTokenClick}
          />
        </div>

        {/* Pagination for migrated tab */}
        {activeTab === "migrated" && !showSearch && migratedTotal > migratedPageSize && (
          <div className="flex items-center justify-center gap-3 mt-4">
            <button
              onClick={() => fetchTab("migrated", migratedPage - 1)}
              disabled={loading || migratedPage <= 1}
              className="text-[#bfa97a] hover:text-[#c9a84c] disabled:opacity-30 text-sm border border-[#5c3a21] px-4 py-1.5 rounded hover:border-[#c9a84c]/50 transition-colors"
            >
              &larr; Prev
            </button>
            <span className="text-xs text-[#8b7635]">
              {migratedPage} / {Math.ceil(migratedTotal / migratedPageSize)}
            </span>
            <button
              onClick={() => fetchTab("migrated", migratedPage + 1)}
              disabled={loading || migratedPage >= Math.ceil(migratedTotal / migratedPageSize)}
              className="text-[#bfa97a] hover:text-[#c9a84c] disabled:opacity-30 text-sm border border-[#5c3a21] px-4 py-1.5 rounded hover:border-[#c9a84c]/50 transition-colors"
            >
              Next &rarr;
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 text-center text-xs text-[#5c3a21]">
          <div className="flex items-center justify-center gap-2">
            <span style={{ color: "#8b7635" }}>&#9776;</span>
            <span>Data sourced from DexScreener API</span>
            <span style={{ color: "#8b7635" }}>&#9776;</span>
          </div>
          <div className="mt-1 text-[#3d2517]">
            Auto-refreshes every 45s &middot; Chronos v0.3.0
          </div>
        </div>
      </main>
    </div>
  );
}
