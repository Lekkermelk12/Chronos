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
        className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors"
      />
      <button
        type="submit"
        disabled={loading || !query.trim()}
        className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:text-gray-500 text-white px-6 py-2.5 rounded-lg font-medium transition-colors"
      >
        {loading ? "Searching..." : "Search"}
      </button>
    </form>
  );
}
