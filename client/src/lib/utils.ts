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
