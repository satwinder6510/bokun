import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Strip HTML tags and inline styles, returning clean text
export function stripHtmlToText(html: string): string {
  if (!html) return '';
  
  // First, try to extract text from HTML using a temporary element
  const temp = document.createElement('div');
  temp.innerHTML = html;
  let text = temp.textContent || temp.innerText || '';
  
  // Clean up any remaining style fragments that might appear as text
  // These patterns match orphaned CSS property fragments
  text = text
    .replace(/style=["'][^"']*["']/gi, '')
    .replace(/\b(font-size|line-height|color|margin-top|margin-bottom|margin|padding|background|border):\s*[^;>]+;?/gi, '')
    .replace(/rgb\s*\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)/gi, '')
    .replace(/\d+(\.\d+)?(px|em|rem|%)/gi, '')
    .replace(/size:\s*\d+px;?/gi, '')
    .replace(/height:\s*[\d.]+;?/gi, '')
    .replace(/top:\s*[\d.]+em;?/gi, '')
    .replace(/bottom:\s*[\d.]+em;?/gi, '')
    .replace(/<\/?[^>]+(>|$)/g, '') // Remove any remaining HTML tags
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
  
  return text;
}

// Clean fragmented HTML array that was incorrectly split during import
// This joins fragments, parses as HTML, and extracts clean list items
export function cleanFragmentedHtmlArray(items: string[]): string[] {
  if (!items || items.length === 0) return [];
  
  // Check if this looks like fragmented HTML (contains style fragments)
  const isFragmented = items.some(item => 
    /^(size:|height:|top:|bottom:|font|color:rgb|margin)/.test(item) ||
    item.includes('style="') ||
    /^\d+(\.\d+)?(px|em|rem|%)/.test(item)
  );
  
  if (!isFragmented) {
    // Not fragmented, just clean each item
    return items.map(item => stripHtmlToText(item)).filter(item => item.length > 0);
  }
  
  // Join all fragments back together
  const combined = items.join('');
  
  // Parse as HTML
  const temp = document.createElement('div');
  temp.innerHTML = combined;
  
  // Extract meaningful list items and paragraphs
  const results: string[] = [];
  
  // Get all list items
  const listItems = temp.querySelectorAll('li');
  listItems.forEach(li => {
    const text = (li.textContent || '').trim();
    if (text.length > 0) {
      results.push(text);
    }
  });
  
  // If no list items found, try paragraphs with strong tags (headers)
  if (results.length === 0) {
    const paragraphs = temp.querySelectorAll('p');
    paragraphs.forEach(p => {
      const text = (p.textContent || '').trim();
      if (text.length > 0) {
        results.push(text);
      }
    });
  }
  
  // If still nothing, fall back to text content split by line breaks
  if (results.length === 0) {
    const text = (temp.textContent || '').trim();
    if (text.length > 0) {
      // Split by common delimiters and filter
      const lines = text.split(/[\n\r]+/).map(l => l.trim()).filter(l => l.length > 0);
      results.push(...lines);
    }
  }
  
  return results;
}
