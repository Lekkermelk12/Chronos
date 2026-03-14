"use client";

import { useState, useEffect, useCallback } from "react";
import { TokenData } from "@/types/token";
import TokenTable from "@/components/TokenTable";
import ClockLogo from "@/components/ClockLogo";
import SearchBar from "@/components/SearchBar";

type Tab = "trending" | "tiktok" | "old" | "reversals";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "trending", label: "Trending", icon: "\uD83D\uDD25" },
  { key: "tiktok", label: "TikTok Coins", icon: "\u266B" },
  { key: "old", label: "Old Raydium", icon: "\u231B" },
  { key: "reversals", label: "Reversals", icon: "\u26A1" },
];

const TAB_ENDPOINTS: Record<Tab, string> = {
  trending: "/api/tokens/trending",
  tiktok: "/api/tokens/tiktok",
  old: "/api/tokens/old",
  reversals: "/api/tokens/reversals",
};

export default function Home() {
  const [tokens, setTokens] = useState<TokenData[]>([]);
  const [searchResults, setSearchResults] = useState<TokenData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("trending");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [alertCount, setAlertCount] = useState(0);

  const fetchTab = useCallback(async (tab: Tab) => {
    setLoading(true);
    setShowSearch(false);
    try {
      const res = await fetch(TAB_ENDPOINTS[tab]);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      const tokens = Array.isArray(data) ? data : [];
      setTokens(tokens);
      setLastUpdated(new Date());

      if (tab === "reversals") {
        setAlertCount(tokens.filter((t: TokenData) => t.isAlert).length);
      }
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
      setSearchResults(Array.isArray(data) ? data : []);
      setLastUpdated(new Date());
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

  return (
    <div className="min-h-screen wood-bg">
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
      <main className="max-w-[1400px] mx-auto px-4 py-6">
        {/* Search */}
        <div className="mb-5">
          <SearchBar onSearch={handleSearch} loading={loading} />
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-5">
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
        <div className="mb-4 text-xs text-[#8b7635] italic animate-fade-in-up">
          {!showSearch && activeTab === "trending" && (
            <span>Top trending coins on DexScreener &middot; Boosted &amp; most active</span>
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
        </div>

        {/* Token Table */}
        <div className="ornate-border rounded-xl overflow-hidden bg-[#1a0f07]/80">
          <TokenTable
            tokens={showSearch ? searchResults : tokens}
            loading={loading}
            showAlerts={activeTab === "reversals" && !showSearch}
          />
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-xs text-[#5c3a21]">
          <div className="flex items-center justify-center gap-2">
            <span style={{ color: "#8b7635" }}>&#9776;</span>
            <span>Data sourced from DexScreener API</span>
            <span style={{ color: "#8b7635" }}>&#9776;</span>
          </div>
          <div className="mt-1 text-[#3d2517]">
            Auto-refreshes every 45s &middot; Chronos v0.2.0
          </div>
        </div>
      </main>
    </div>
  );
}
