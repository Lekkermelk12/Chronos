"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { TokenData } from "@/types/token";
import TokenTable from "@/components/TokenTable";
import ClockLogo from "@/components/ClockLogo";
import SearchBar, { addSearchToHistory } from "@/components/SearchBar";
import TrendingTicker from "@/components/TrendingTicker";
import WatchlistSidebar from "@/components/WatchlistSidebar";

type Tab = "reversals" | "tiktok" | "old" | "github";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "reversals", label: "Reversals", icon: "\u26A1" },
  { key: "tiktok", label: "TikTok Coins", icon: "\u266B" },
  { key: "old", label: "Old Raydium", icon: "\u231B" },
  { key: "github", label: "GitHub Coins", icon: "\uD83D\uDCBB" },
];

const TAB_ENDPOINTS: Record<Tab, string> = {
  reversals: "/api/tokens/reversals",
  tiktok: "/api/tokens/tiktok",
  old: "/api/tokens/old",
  github: "/api/tokens/github",
};

export default function Home() {
  const router = useRouter();
  const [tokens, setTokens] = useState<TokenData[]>([]);
  const [searchResults, setSearchResults] = useState<TokenData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("reversals");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [alertCount, setAlertCount] = useState(0);

  const fetchTab = useCallback(async (tab: Tab) => {
    setLoading(true);
    setShowSearch(false);
    try {
      const url = TAB_ENDPOINTS[tab];
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      const tokens = Array.isArray(data) ? data : [];
      setTokens(tokens);

      if (tab === "reversals") {
        setAlertCount(tokens.filter((t: TokenData) => t.isAlert).length);
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
      <header className="border-b border-[#6b4427] bg-[#1a0f07]/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-[1400px] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ClockLogo />
            <div>
              <h1
                className="text-2xl font-extrabold tracking-wide"
                style={{
                  color: "#dbb85c",
                  textShadow: "0 0 20px rgba(219, 184, 92, 0.35)",
                  letterSpacing: "0.15em",
                }}
              >
                CHRONOS
              </h1>
              <p className="text-[11px] text-[#a8923e] tracking-[0.3em] uppercase -mt-0.5 font-semibold">
                Solana Time Machine
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm text-[#d4c49a]">
            {alertCount > 0 && activeTab === "reversals" && (
              <span className="animate-glow text-xs font-bold bg-[#c45050]/25 text-[#dbb85c] px-2.5 py-1 rounded-full border border-[#dbb85c]/40">
                {alertCount} Alert{alertCount > 1 ? "s" : ""}
              </span>
            )}
            {lastUpdated && (
              <span className="text-xs text-[#a8923e] font-medium">
                {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={() => fetchTab(activeTab)}
              disabled={loading}
              className="text-[#d4c49a] hover:text-[#dbb85c] transition-colors disabled:opacity-50 text-xs font-semibold border border-[#6b4427] px-3 py-1.5 rounded hover:border-[#dbb85c]/60"
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
              className={`px-5 py-2.5 rounded-lg text-sm transition-all duration-300 ${
                activeTab === tab.key && !showSearch
                  ? "tab-active"
                  : "tab-inactive"
              }`}
            >
              <span className="mr-1.5">{tab.icon}</span>
              {tab.label}
              {tab.key === "reversals" && alertCount > 0 && (
                <span className="ml-2 bg-[#c45050] text-[#ffe0e0] text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {alertCount}
                </span>
              )}
            </button>
          ))}
          {showSearch && (
            <button className="px-5 py-2.5 rounded-lg text-sm font-bold tab-active animate-slide-in">
              Search Results
            </button>
          )}
        </div>

        {/* Tab description */}
        <div className="mb-3 text-xs text-[#a8923e] font-medium animate-fade-in-up">
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

        {/* Footer */}
        <div className="mt-6 text-center text-xs text-[#6b4427]">
          <div className="flex items-center justify-center gap-2">
            <span style={{ color: "#a8923e" }}>&#9776;</span>
            <span className="font-medium">Data sourced from DexScreener API</span>
            <span style={{ color: "#a8923e" }}>&#9776;</span>
          </div>
          <div className="mt-1 text-[#5c3a21] font-medium">
            Auto-refreshes every 45s &middot; Chronos v0.3.0
          </div>
        </div>
      </main>
    </div>
  );
}
