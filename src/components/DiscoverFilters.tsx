"use client";

import { useState } from "react";

export interface DiscoverFilterState {
  launchpads: string[];
  poolTypes: string[];
  categories: string[];
  minMc: string;
  maxMc: string;
  agePreset: string;
  sortBy: string;
  sortDir: "asc" | "desc";
}

interface Props {
  onApply: (filters: DiscoverFilterState) => void;
  loading?: boolean;
}

export const DEFAULT_DISCOVER_FILTERS: DiscoverFilterState = {
  launchpads: [],
  poolTypes: [],
  categories: [],
  minMc: "",
  maxMc: "",
  agePreset: "any",
  sortBy: "marketcap",
  sortDir: "desc",
};

const LAUNCHPAD_OPTIONS = [
  { id: "pump.fun", label: "Pump.fun", emoji: "🚀" },
  { id: "bags.fm", label: "Bags.fm", emoji: "💼" },
  { id: "moonshot", label: "Moonshot", emoji: "🌕" },
  { id: "letsbonk", label: "LetsBonk", emoji: "🐶" },
];

const POOL_OPTIONS = [
  { id: "raydium", label: "Raydium", emoji: "⚡" },
  { id: "pumpswap", label: "PumpSwap", emoji: "🔄" },
];

const CATEGORY_OPTIONS = [
  { id: "tiktok-meme", label: "TikTok", emoji: "♫" },
  { id: "github", label: "GitHub", emoji: "💻" },
  { id: "bonk", label: "Bonk", emoji: "🐶" },
  { id: "bags", label: "Bags", emoji: "💼" },
  { id: "ai", label: "AI", emoji: "🤖" },
  { id: "migrated", label: "Migrated", emoji: "🔀" },
];

const AGE_OPTIONS = [
  { id: "any", label: "Any Age" },
  { id: "1h", label: "< 1h" },
  { id: "6h", label: "< 6h" },
  { id: "24h", label: "< 24h" },
  { id: "gt1d", label: "> 1 day" },
  { id: "gt7d", label: "> 7 days" },
];

const SORT_OPTIONS = [
  { id: "marketcap", label: "Market Cap" },
  { id: "volume", label: "Volume" },
  { id: "swaps", label: "Activity" },
  { id: "open_timestamp", label: "Newest" },
  { id: "holder_count", label: "Holders" },
];

function toggleItem(arr: string[], id: string): string[] {
  return arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];
}

function ChipRow({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: { id: string; label: string; emoji?: string }[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[10px] text-[#a8923e] uppercase tracking-widest font-bold w-20 shrink-0">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const active = selected.includes(opt.id);
          return (
            <button
              key={opt.id}
              onClick={() => onToggle(opt.id)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all duration-200 ${
                active
                  ? "bg-[#dbb85c]/20 border-[#dbb85c] text-[#dbb85c]"
                  : "bg-[#1a0f07]/60 border-[#6b4427]/60 text-[#a8923e] hover:border-[#a8923e] hover:text-[#d4c49a]"
              }`}
            >
              {opt.emoji && <span className="mr-1">{opt.emoji}</span>}
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function DiscoverFilters({ onApply, loading }: Props) {
  const [filters, setFilters] = useState<DiscoverFilterState>(DEFAULT_DISCOVER_FILTERS);

  const update = (patch: Partial<DiscoverFilterState>) =>
    setFilters((prev) => ({ ...prev, ...patch }));

  const hasFilters =
    filters.launchpads.length > 0 ||
    filters.poolTypes.length > 0 ||
    filters.categories.length > 0 ||
    filters.minMc !== "" ||
    filters.maxMc !== "" ||
    filters.agePreset !== "any";

  const reset = () => setFilters(DEFAULT_DISCOVER_FILTERS);

  return (
    <div className="ornate-border rounded-xl bg-[#1a0f07]/80 p-4 mb-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-[#dbb85c] tracking-wide">
          🔭 Discover Filters
        </h3>
        {hasFilters && (
          <button
            onClick={reset}
            className="text-xs text-[#6b4427] hover:text-[#a8923e] transition-colors font-medium"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Launchpad */}
      <ChipRow
        label="Launchpad"
        options={LAUNCHPAD_OPTIONS}
        selected={filters.launchpads}
        onToggle={(id) => update({ launchpads: toggleItem(filters.launchpads, id) })}
      />

      {/* Pool / DEX */}
      <ChipRow
        label="DEX"
        options={POOL_OPTIONS}
        selected={filters.poolTypes}
        onToggle={(id) => update({ poolTypes: toggleItem(filters.poolTypes, id) })}
      />

      {/* Category */}
      <ChipRow
        label="Category"
        options={CATEGORY_OPTIONS}
        selected={filters.categories}
        onToggle={(id) => update({ categories: toggleItem(filters.categories, id) })}
      />

      {/* Market Cap + Age row */}
      <div className="flex flex-wrap items-center gap-4">
        {/* MC Range */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[#a8923e] uppercase tracking-widest font-bold w-20 shrink-0">
            Market Cap
          </span>
          <input
            type="number"
            placeholder="Min $"
            value={filters.minMc}
            onChange={(e) => update({ minMc: e.target.value })}
            className="w-24 px-2 py-1 text-xs bg-[#1a0f07] border border-[#6b4427]/60 rounded text-[#d4c49a] placeholder-[#6b4427] focus:outline-none focus:border-[#a8923e]"
          />
          <span className="text-[#6b4427] text-xs">—</span>
          <input
            type="number"
            placeholder="Max $"
            value={filters.maxMc}
            onChange={(e) => update({ maxMc: e.target.value })}
            className="w-24 px-2 py-1 text-xs bg-[#1a0f07] border border-[#6b4427]/60 rounded text-[#d4c49a] placeholder-[#6b4427] focus:outline-none focus:border-[#a8923e]"
          />
        </div>
      </div>

      {/* Age */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] text-[#a8923e] uppercase tracking-widest font-bold w-20 shrink-0">
          Age
        </span>
        <div className="flex flex-wrap gap-1.5">
          {AGE_OPTIONS.map((opt) => {
            const active = filters.agePreset === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => update({ agePreset: opt.id })}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all duration-200 ${
                  active
                    ? "bg-[#dbb85c]/20 border-[#dbb85c] text-[#dbb85c]"
                    : "bg-[#1a0f07]/60 border-[#6b4427]/60 text-[#a8923e] hover:border-[#a8923e] hover:text-[#d4c49a]"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sort */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] text-[#a8923e] uppercase tracking-widest font-bold w-20 shrink-0">
          Sort By
        </span>
        <div className="flex flex-wrap gap-1.5">
          {SORT_OPTIONS.map((opt) => {
            const active = filters.sortBy === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => update({ sortBy: opt.id })}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all duration-200 ${
                  active
                    ? "bg-[#dbb85c]/20 border-[#dbb85c] text-[#dbb85c]"
                    : "bg-[#1a0f07]/60 border-[#6b4427]/60 text-[#a8923e] hover:border-[#a8923e] hover:text-[#d4c49a]"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
          {/* Direction toggle */}
          <button
            onClick={() =>
              update({ sortDir: filters.sortDir === "desc" ? "asc" : "desc" })
            }
            className="px-3 py-1 rounded-full text-xs font-semibold border border-[#6b4427]/60 text-[#a8923e] hover:border-[#a8923e] hover:text-[#d4c49a] transition-all duration-200 bg-[#1a0f07]/60"
          >
            {filters.sortDir === "desc" ? "↓ Desc" : "↑ Asc"}
          </button>
        </div>
      </div>

      {/* Apply button */}
      <div className="pt-1">
        <button
          onClick={() => onApply(filters)}
          disabled={loading}
          className="px-6 py-2 rounded-lg text-sm font-bold transition-all duration-200 disabled:opacity-50 tab-active"
        >
          {loading ? "Searching…" : "🔍 Search"}
        </button>
      </div>
    </div>
  );
}
