interface SearchableItem {
  id: number | string;
  type: 'package' | 'tour';
  title: string;
  description?: string;
  excerpt?: string;
  category?: string;
  countries?: string[];
  tags?: string[];
  price?: number;
  duration?: string;
  image?: string;
  slug?: string;
}

interface SearchResult extends SearchableItem {
  score: number;
  matchedFields: string[];
}

interface SearchOptions {
  fuzzyThreshold?: number;
  maxResults?: number;
  minScore?: number;
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

function fuzzyMatch(text: string, query: string, threshold: number = 0.3): { matches: boolean; score: number } {
  const textLower = text.toLowerCase();
  const queryLower = query.toLowerCase();
  
  if (textLower.includes(queryLower)) {
    const position = textLower.indexOf(queryLower);
    const positionBonus = position === 0 ? 0.2 : 0;
    return { matches: true, score: 1 + positionBonus };
  }
  
  const words = textLower.split(/\s+/);
  for (const word of words) {
    if (word.startsWith(queryLower)) {
      return { matches: true, score: 0.9 };
    }
  }
  
  if (query.length >= 4) {
    const distance = levenshteinDistance(textLower, queryLower);
    const maxLength = Math.max(textLower.length, queryLower.length);
    const similarity = 1 - (distance / maxLength);
    
    if (similarity >= (1 - threshold)) {
      return { matches: true, score: similarity * 0.7 };
    }
    
    for (const word of words) {
      if (word.length >= 3) {
        const wordDistance = levenshteinDistance(word, queryLower);
        const wordMaxLength = Math.max(word.length, queryLower.length);
        const wordSimilarity = 1 - (wordDistance / wordMaxLength);
        
        if (wordSimilarity >= (1 - threshold)) {
          return { matches: true, score: wordSimilarity * 0.6 };
        }
      }
    }
  }
  
  return { matches: false, score: 0 };
}

const FIELD_WEIGHTS = {
  title: 5,
  category: 3,
  countries: 3,
  tags: 2.5,
  excerpt: 1.5,
  description: 1,
};

export function searchItems(
  items: SearchableItem[],
  query: string,
  options: SearchOptions = {}
): SearchResult[] {
  const {
    fuzzyThreshold = 0.3,
    maxResults = 20,
    minScore = 0.1,
  } = options;

  if (!query.trim()) {
    return [];
  }

  const queryTerms = query.toLowerCase().trim().split(/\s+/).filter(t => t.length > 0);
  
  const results: SearchResult[] = [];

  for (const item of items) {
    let totalScore = 0;
    const matchedFields: string[] = [];

    for (const term of queryTerms) {
      let termScore = 0;

      if (item.title) {
        const { matches, score } = fuzzyMatch(item.title, term, fuzzyThreshold);
        if (matches) {
          termScore += score * FIELD_WEIGHTS.title;
          if (!matchedFields.includes('title')) matchedFields.push('title');
        }
      }

      if (item.category) {
        const { matches, score } = fuzzyMatch(item.category, term, fuzzyThreshold);
        if (matches) {
          termScore += score * FIELD_WEIGHTS.category;
          if (!matchedFields.includes('category')) matchedFields.push('category');
        }
      }

      if (item.countries && item.countries.length > 0) {
        for (const country of item.countries) {
          const { matches, score } = fuzzyMatch(country, term, fuzzyThreshold);
          if (matches) {
            termScore += score * FIELD_WEIGHTS.countries;
            if (!matchedFields.includes('countries')) matchedFields.push('countries');
            break;
          }
        }
      }

      if (item.tags && item.tags.length > 0) {
        for (const tag of item.tags) {
          const { matches, score } = fuzzyMatch(tag, term, fuzzyThreshold);
          if (matches) {
            termScore += score * FIELD_WEIGHTS.tags;
            if (!matchedFields.includes('tags')) matchedFields.push('tags');
            break;
          }
        }
      }

      if (item.excerpt) {
        const { matches, score } = fuzzyMatch(item.excerpt, term, fuzzyThreshold);
        if (matches) {
          termScore += score * FIELD_WEIGHTS.excerpt;
          if (!matchedFields.includes('excerpt')) matchedFields.push('excerpt');
        }
      }

      if (item.description) {
        const { matches, score } = fuzzyMatch(item.description, term, fuzzyThreshold);
        if (matches) {
          termScore += score * FIELD_WEIGHTS.description;
          if (!matchedFields.includes('description')) matchedFields.push('description');
        }
      }

      totalScore += termScore;
    }

    if (queryTerms.length > 1) {
      totalScore = totalScore / queryTerms.length;
    }

    if (totalScore >= minScore) {
      results.push({
        ...item,
        score: totalScore,
        matchedFields,
      });
    }
  }

  results.sort((a, b) => b.score - a.score);

  return results.slice(0, maxResults);
}

export function highlightMatch(text: string, query: string): string {
  if (!query.trim() || !text) return text;
  
  const terms = query.toLowerCase().trim().split(/\s+/);
  let result = text;
  
  for (const term of terms) {
    const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    result = result.replace(regex, '<mark>$1</mark>');
  }
  
  return result;
}

export function getSearchSuggestions(
  items: SearchableItem[],
  query: string,
  maxSuggestions: number = 5
): string[] {
  if (!query.trim() || query.length < 2) return [];
  
  const suggestions = new Set<string>();
  const queryLower = query.toLowerCase();
  
  for (const item of items) {
    if (suggestions.size >= maxSuggestions) break;
    
    if (item.title?.toLowerCase().includes(queryLower)) {
      suggestions.add(item.title);
    }
    
    if (item.category?.toLowerCase().includes(queryLower)) {
      suggestions.add(item.category);
    }
    
    item.countries?.forEach(country => {
      if (country.toLowerCase().includes(queryLower) && suggestions.size < maxSuggestions) {
        suggestions.add(country);
      }
    });
    
    item.tags?.forEach(tag => {
      if (tag.toLowerCase().includes(queryLower) && suggestions.size < maxSuggestions) {
        suggestions.add(tag);
      }
    });
  }
  
  return Array.from(suggestions).slice(0, maxSuggestions);
}

export type { SearchableItem, SearchResult, SearchOptions };
