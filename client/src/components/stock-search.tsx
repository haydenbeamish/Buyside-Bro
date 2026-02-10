import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";

interface StockSearchResult {
  symbol: string;
  name: string;
  exchange: string;
}

interface StockSearchProps {
  onSelect: (ticker: string, name: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  disabled?: boolean;
  value?: string;
  clearOnSelect?: boolean;
  onSubmit?: (ticker: string) => void;
  inputTestId?: string;
  optionIdPrefix?: string;
}

export function StockSearch({
  onSelect,
  placeholder = "Search stocks... (e.g., Apple, TSLA)",
  autoFocus = false,
  className,
  disabled = false,
  value = "",
  clearOnSelect = false,
  onSubmit,
  inputTestId = "input-stock-search",
  optionIdPrefix = "stock-option",
}: StockSearchProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<StockSearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const userTypedRef = useRef(false);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!userTypedRef.current) {
      return;
    }
    const searchStocks = async () => {
      if (query.length < 1) {
        setResults([]);
        return;
      }
      setIsLoading(true);
      try {
        const res = await fetch(`/api/stocks/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data);
        if (data.length > 0) setIsOpen(true);
      } catch (e) {
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    };

    const debounce = setTimeout(searchStocks, 300);
    return () => clearTimeout(debounce);
  }, [query]);

  const handleSelect = (stock: StockSearchResult) => {
    userTypedRef.current = false;
    if (clearOnSelect) {
      setQuery("");
    } else {
      setQuery(stock.symbol);
    }
    setResults([]);
    setIsOpen(false);
    setActiveIndex(-1);
    onSelect(stock.symbol, stock.name);
    if (onSubmit) {
      onSubmit(stock.symbol);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isOpen && results.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (i < results.length - 1 ? i + 1 : 0));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (i > 0 ? i - 1 : results.length - 1));
        return;
      }
      if (e.key === "Escape") {
        setIsOpen(false);
        setActiveIndex(-1);
        return;
      }
      if (e.key === "Enter" && activeIndex >= 0) {
        e.preventDefault();
        handleSelect(results[activeIndex]);
        return;
      }
    }
    if (e.key === "Enter" && query.trim() && onSubmit) {
      e.preventDefault();
      userTypedRef.current = false;
      setResults([]);
      setIsOpen(false);
      setActiveIndex(-1);
      onSubmit(query.toUpperCase().trim());
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className || ""}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
        <Input
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            const val = e.target.value.toUpperCase();
            userTypedRef.current = true;
            setQuery(val);
            onSelect(val, "");
            setActiveIndex(-1);
          }}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          className="bg-zinc-800 border-zinc-700 text-white font-mono uppercase pl-10"
          data-testid={inputTestId}
          role="combobox"
          aria-expanded={isOpen}
          aria-activedescendant={activeIndex >= 0 ? `${optionIdPrefix}-${activeIndex}` : undefined}
          autoFocus={autoFocus}
          disabled={disabled}
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-500 animate-spin" />
        )}
      </div>
      {isOpen && results.length > 0 && (
        <div
          className="absolute z-50 w-full mt-1 max-h-64 overflow-y-auto bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl"
          role="listbox"
        >
          {results.map((stock, idx) => (
            <button
              key={`${stock.symbol}-${idx}`}
              id={`${optionIdPrefix}-${idx}`}
              type="button"
              onClick={() => handleSelect(stock)}
              className={`w-full px-3 py-2.5 text-left hover:bg-zinc-700 flex items-center justify-between gap-2 border-b border-zinc-700/50 last:border-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-400 focus-visible:bg-zinc-700 ${idx === activeIndex ? "bg-zinc-700" : ""}`}
              data-testid={`stock-result-${stock.symbol}`}
              role="option"
              aria-selected={idx === activeIndex}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold text-amber-400">{stock.symbol}</span>
                  <span className="text-xs text-zinc-500 bg-zinc-700 px-1.5 py-0.5 rounded">{stock.exchange}</span>
                </div>
                <p className="text-sm text-zinc-400 truncate">{stock.name}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
