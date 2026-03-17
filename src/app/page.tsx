"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { TokenData } from "@/types/token";
import TokenTable from "@/components/TokenTable";
import ClockLogo from "@/components/ClockLogo";
import SearchBar, { addSearchToHistory } from "@/components/SearchBar";
import DiscoverFilters, { DiscoverFilterState } from "@/components/DiscoverFilters";
import TrendingTicker from "@/components/TrendingTicker";
import WatchlistSidebar from "@/components/WatchlistSidebar";
import {
  getReversalCoins,
  getTiktokCoins,
  getOldCoins,
  getGithubCoins,
  getBonkCoins,
  getBagsCoins,
  searchTokens,
} from "@/lib/tokens-client";

type DataTab = "reversals" | "tiktok" | "old" | "github" | "bonk" | "bags";
type Tab = DataTab | "search" | "discover";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "reversals", label: "Reversals", icon: "\u26A1" },
  { key: "tiktok", label: "TikTok Coins", icon: "\u266B" },
  { key: "old", label: "Old Raydium", icon: "\u231B" },
  { key: "github", label: "GitHub Coins", icon: "\uD83D\uDCBB" },
  { key: "bonk", label: "Bonk Coins", icon: "\uD83D\uDC36" },
  { key: "bags", label: "BagsApp", icon: "\uD83D\uDCBC" },
  { key: "search", label: "Search", icon: "\uD83D\uDD0D" },
  { key: "discover", label: "Discover", icon: "\uD83D\uDD2D" },
];

const TAB_DESCRIPTIONS: Record<Tab, string> = {
  reversals: "Coins showing reversal patterns \u00B7 Volume spikes & MC breakouts",
  tiktok: "Coins with TikTok links \u00B7 Sorted by market cap",
  old: "Raydium & PumpSwap coins over 1 day old with 6K+ market cap",
  github: "PumpFun coins with GitHub fee sharing \u00B7 Creator fees fund open-source devs",
  bonk: "Bonk ecosystem coins \u00B7 All tokens with \u201CBonk\u201D in name or symbol",
  bags: "BagsApp coins \u00B7 Tokens launched on bags.fm launchpad",
  search: "Search by token name, symbol, or contract address",
  discover: "Filter by launchpad, DEX, category, market cap, age, and more",
};

// Client-side fetchers — GMGN is called directly from the browser via /api/proxy
const TAB_FETCHERS: Record<DataTab, () => Promise<TokenData[]>> = {
  reversals: getReversalCoins,
  tiktok: getTiktokCoins,
  old: getOldCoins,
  github: getGithubCoins,
  bonk: getBonkCoins,
  bags: getBagsCoins,
};

const REFRESH_INTERVAL_MS = 30_000; // 30s auto-refresh

export default function Home() {
  const router = useRouter();
  const [tokens, setTokens] = useState<TokenData[]>([]);
  const [searchResults, setSearchResults] = useState<TokenData[]>([]);
  const [discoverResults, setDiscoverResults] = useState<TokenData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("reversals");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [alertCount, setAlertCount] = useState(0);
  const [liveActive, setLiveActive] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchTab = useCallback(async (tab: DataTab, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const fetched = await TAB_FETCHERS[tab]();
      setTokens(fetched);
      if (tab === "reversals") {
        setAlertCount(fetched.filter((t) => t.isAlert).length);
      }
      setLastUpdated(new Date());
      setLiveActive(true);
    } catch (error) {
      console.error(`Failed to fetch ${tab} tokens:`, error);
      setLiveActive(false);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // Fetch immediately on tab change, then auto-refresh every 30s
  useEffect(() => {
    if (activeTab === "search" || activeTab === "discover") {
      setLiveActive(false);
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    const tab = activeTab as DataTab;
    setTokens([]);
    setLiveActive(false);
    fetchTab(tab);

    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => fetchTab(tab, true), REFRESH_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const handleSearch = useCallback(async (query: string) => {
    setLoading(true);
    try {
      const results = await searchTokens(query);
      setSearchResults(results);
      setLastUpdated(new Date());

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

  const handleDiscover = useCallback(async (filters: DiscoverFilterState) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      filters.launchpads.forEach((lp) => params.append("launchpad", lp));
      filters.poolTypes.forEach((pt) => params.append("pool", pt));
      filters.categories.forEach((cat) => params.append("category", cat));
      if (filters.minMc) params.set("minMc", filters.minMc);
      if (filters.maxMc) params.set("maxMc", filters.maxMc);

      const ageMap: Record<string, { minAge?: string; maxAge?: string }> = {
        "1h":   { maxAge: "1" },
        "6h":   { maxAge: "6" },
        "24h":  { maxAge: "24" },
        "gt1d": { minAge: "24" },
        "gt7d": { minAge: "168" },
      };
      const ageParts = ageMap[filters.agePreset];
      if (ageParts?.maxAge) params.set("maxAge", ageParts.maxAge);
      if (ageParts?.minAge) params.set("minAge", ageParts.minAge);

      params.set("sortBy", filters.sortBy);
      params.set("sortDir", filters.sortDir);

      const res = await fetch(`/api/tokens/discover?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to discover");
      const data = await res.json();
      setDiscoverResults(Array.isArray(data) ? data : []);
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Discover error:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
  };

  const handleTokenClick = (token: TokenData) => {
    router.push(`/token/${token.address}`);
  };

  const isSearchTab = activeTab === "search";
  const isDiscoverTab = activeTab === "discover";
  const displayTokens = isDiscoverTab ? discoverResults : isSearchTab ? searchResults : tokens;

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
          <div className="flex items-center gap-3 text-sm text-[#d4c49a]">
            {/* Live indicator */}
            {liveActive && !isSearchTab && !isDiscoverTab && (
              <div className="flex items-center gap-1.5">
                <span className="live-dot" />
                <span className="text-[10px] text-[#5ea872] font-bold tracking-wider uppercase">Live</span>
              </div>
            )}
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
            {!isSearchTab && !isDiscoverTab && (
              <button
                onClick={() => fetchTab(activeTab as DataTab, false)}
                disabled={loading}
                className="text-[#d4c49a] hover:text-[#dbb85c] transition-colors disabled:opacity-50 text-xs font-semibold border border-[#6b4427] px-3 py-1.5 rounded hover:border-[#dbb85c]/60"
              >
                Refresh
              </button>
            )}
            <span className="text-[10px] text-[#3d2517] font-mono font-bold border border-[#3d2517] px-1.5 py-0.5 rounded">
              v0.5.0
            </span>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-[1400px] mx-auto px-4 py-4">
        {/* Trending Ticker */}
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
                activeTab === tab.key ? "tab-active" : "tab-inactive"
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
        </div>

        {/* Tab description */}
        <div className="mb-3 text-xs text-[#a8923e] font-medium animate-fade-in-up">
          <span>{TAB_DESCRIPTIONS[activeTab]}</span>
        </div>

        {/* Search input (only shown on search tab) */}
        {isSearchTab && (
          <div className="mb-4">
            <SearchBar onSearch={handleSearch} loading={loading} />
            {!loading && searchResults.length === 0 && (
              <p className="mt-3 text-xs text-[#6b4427] text-center">
                Enter a token name, symbol, or contract address above to search.
              </p>
            )}
          </div>
        )}

        {/* Discover filters (only shown on discover tab) */}
        {isDiscoverTab && (
          <div className="mb-4">
            <DiscoverFilters onApply={handleDiscover} loading={loading} />
            {!loading && discoverResults.length === 0 && (
              <p className="mt-3 text-xs text-[#6b4427] text-center">
                Configure your filters above and click Search to find tokens.
              </p>
            )}
          </div>
        )}

        {/* Token Table */}
        <div className="ornate-border rounded-xl overflow-hidden bg-[#1a0f07]/80">
          <TokenTable
            tokens={displayTokens}
            loading={loading && !isSearchTab && !isDiscoverTab}
            showAlerts={activeTab === "reversals"}
            onTokenClick={handleTokenClick}
            tabKey={activeTab}
          />
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-xs text-[#6b4427]">
          <div className="flex items-center justify-center gap-2">
            <span style={{ color: "#a8923e" }}>&#9776;</span>
            <span className="font-medium">GMGN · DexScreener · pump.fun · Helius</span>
            <span style={{ color: "#a8923e" }}>&#9776;</span>
          </div>
          <div className="mt-1 text-[#5c3a21] font-medium">
            {liveActive ? "🟢 Live · auto-refresh 30s" : "Loading..."} &middot; Chronos v0.5.0
          </div>
        </div>
      </main>
    </div>
  );
}
