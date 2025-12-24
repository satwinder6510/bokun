import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface GlobalSearchProps {
  className?: string;
  placeholder?: string;
  onClose?: () => void;
  autoFocus?: boolean;
  variant?: "default" | "hero";
  initialValue?: string;
}

export function GlobalSearch({ 
  className, 
  placeholder = "Search destinations, tours...", 
  onClose, 
  autoFocus = false, 
  variant = "default",
  initialValue = ""
}: GlobalSearchProps) {
  const [, navigate] = useLocation();
  const [query, setQuery] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  const isHero = variant === "hero";

  useEffect(() => {
    setQuery(initialValue);
  }, [initialValue]);

  const handleSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    if (query.trim().length >= 2) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
      onClose?.();
    }
  }, [query, navigate, onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === "Escape") {
      setQuery("");
      onClose?.();
    }
  }, [handleSubmit, onClose]);

  const handleClear = useCallback(() => {
    setQuery("");
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  return (
    <form onSubmit={handleSubmit} className={cn("relative", className)}>
      <div className="relative flex items-center">
        <Search className={cn(
          "absolute top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none",
          isHero ? "left-4 h-5 w-5" : "left-3 h-4 w-4"
        )} />
        <Input
          ref={inputRef}
          type="search"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          className={cn(
            isHero 
              ? "pl-12 pr-24 h-12 md:h-14 text-base md:text-lg bg-stone-50 border-stone-200" 
              : "pl-10 pr-20 h-10"
          )}
          data-testid="input-global-search"
        />
        <div className={cn(
          "absolute top-1/2 -translate-y-1/2 flex items-center gap-1",
          isHero ? "right-2" : "right-1"
        )}>
          {query && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={isHero ? "h-10 w-10" : "h-8 w-8"}
              onClick={handleClear}
              data-testid="button-clear-search"
            >
              <X className={isHero ? "h-5 w-5" : "h-4 w-4"} />
            </Button>
          )}
          <Button
            type="submit"
            variant="default"
            size="icon"
            className={isHero ? "h-10 w-10" : "h-8 w-8"}
            disabled={query.trim().length < 2}
            data-testid="button-submit-search"
          >
            <Search className={isHero ? "h-5 w-5" : "h-4 w-4"} />
          </Button>
        </div>
      </div>
    </form>
  );
}

export function SearchButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      className="h-9 w-9"
      aria-label="Search"
      data-testid="button-open-search"
    >
      <Search className="h-5 w-5" />
    </Button>
  );
}
