import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Strip HTML tags and inline styles, returning clean text
export function stripHtmlToText(html: string): string {
  if (!html) return '';
  
  // Use DOMParser for safe HTML parsing (doesn't execute scripts or event handlers)
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  let text = doc.body.textContent || '';
  
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
  
  const results: string[] = [];
  
  // Process each item individually to preserve plain text items
  for (const item of items) {
    // Check if this specific item is plain text (no HTML tags)
    const isPlainText = !/<[^>]+>/.test(item);
    
    if (isPlainText) {
      // Plain text item - clean and add directly
      const cleaned = item.trim();
      if (cleaned.length > 0) {
        results.push(cleaned);
      }
      continue;
    }
    
    // Check if this looks like a fragmented CSS snippet (orphan style values)
    const isOrphanedCss = /^(size:|height:|top:|bottom:|font|color:rgb|margin)/.test(item) ||
      /^\d+(\.\d+)?(px|em|rem|%)/.test(item);
    
    if (isOrphanedCss) {
      // Skip orphaned CSS fragments
      continue;
    }
    
    // Parse HTML content safely using DOMParser
    const parser = new DOMParser();
    const doc = parser.parseFromString(item, 'text/html');
    const temp = doc.body;
    
    // Extract list items
    const listItems = temp.querySelectorAll('li');
    listItems.forEach(li => {
      const text = (li.textContent || '').trim();
      if (text.length > 0) {
        results.push(text);
      }
    });
    
    // If no list items, try paragraphs (but skip header-like paragraphs followed by lists)
    if (listItems.length === 0) {
      const paragraphs = temp.querySelectorAll('p');
      paragraphs.forEach(p => {
        const text = (p.textContent || '').trim();
        // Skip header-like entries that end with colon (these are section headers)
        if (text.length > 0 && !text.endsWith(':')) {
          results.push(text);
        }
      });
    }
  }
  
  return results;
}
