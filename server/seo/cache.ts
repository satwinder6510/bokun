interface CacheEntry {
  html: string;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

export function getCached(path: string): string | null {
  const entry = cache.get(path);
  if (!entry) return null;
  
  if (Date.now() - entry.timestamp > DEFAULT_TTL) {
    cache.delete(path);
    return null;
  }
  
  return entry.html;
}

export function setCache(path: string, html: string): void {
  cache.set(path, {
    html,
    timestamp: Date.now()
  });
}

export function clearCache(): void {
  cache.clear();
}

export function getCacheStats(): { size: number; keys: string[] } {
  return {
    size: cache.size,
    keys: Array.from(cache.keys())
  };
}
