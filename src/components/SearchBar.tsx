"use client";

import { useState, useCallback } from "react";

interface SearchBarProps {
  onSearch: (query: string) => void;
  loading?: boolean;
}

export default function SearchBar({ onSearch, loading }: SearchBarProps) {
  const [query, setQuery] = useState("");

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (query.trim()) {
        onSearch(query.trim());
      }
    },
    [query, onSearch]
  );

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
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
  );
}
