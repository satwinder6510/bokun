import { processImage } from './mediaService';
import type { InsertMediaTag, MediaAsset, MediaVariant } from '@shared/schema';

const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;
const PEXELS_API_KEY = process.env.PEXELS_API_KEY;

export interface StockImageResult {
  id: string;
  provider: 'unsplash' | 'pexels';
  previewUrl: string;
  fullUrl: string;
  photographer: string;
  photographerUrl: string;
  description: string | null;
  width: number;
  height: number;
  license: string;
  licenseUrl: string;
}

export interface StockSearchOptions {
  query: string;
  perPage?: number;
  page?: number;
  orientation?: 'landscape' | 'portrait' | 'squarish';
}

export async function searchUnsplash(options: StockSearchOptions): Promise<StockImageResult[]> {
  if (!UNSPLASH_ACCESS_KEY) {
    console.warn('UNSPLASH_ACCESS_KEY not configured');
    return [];
  }

  const params = new URLSearchParams({
    query: options.query,
    per_page: String(options.perPage || 12),
    page: String(options.page || 1),
  });

  if (options.orientation) {
    params.append('orientation', options.orientation);
  }

  try {
    const response = await fetch(`https://api.unsplash.com/search/photos?${params}`, {
      headers: {
        'Authorization': `Client-ID ${UNSPLASH_ACCESS_KEY}`,
        'Accept-Version': 'v1',
      },
    });

    if (!response.ok) {
      console.error('Unsplash API error:', response.status, await response.text());
      return [];
    }

    const data = await response.json();

    return data.results.map((photo: any) => ({
      id: photo.id,
      provider: 'unsplash' as const,
      previewUrl: photo.urls.small,
      fullUrl: photo.urls.full,
      photographer: photo.user.name,
      photographerUrl: photo.user.links.html,
      description: photo.description || photo.alt_description,
      width: photo.width,
      height: photo.height,
      license: 'Unsplash License',
      licenseUrl: 'https://unsplash.com/license',
    }));
  } catch (error) {
    console.error('Error searching Unsplash:', error);
    return [];
  }
}

export async function searchPexels(options: StockSearchOptions): Promise<StockImageResult[]> {
  if (!PEXELS_API_KEY) {
    console.warn('PEXELS_API_KEY not configured');
    return [];
  }

  const params = new URLSearchParams({
    query: options.query,
    per_page: String(options.perPage || 12),
    page: String(options.page || 1),
  });

  if (options.orientation) {
    params.append('orientation', options.orientation);
  }

  try {
    const response = await fetch(`https://api.pexels.com/v1/search?${params}`, {
      headers: {
        'Authorization': PEXELS_API_KEY,
      },
    });

    if (!response.ok) {
      console.error('Pexels API error:', response.status, await response.text());
      return [];
    }

    const data = await response.json();

    return data.photos.map((photo: any) => ({
      id: String(photo.id),
      provider: 'pexels' as const,
      previewUrl: photo.src.medium,
      fullUrl: photo.src.original,
      photographer: photo.photographer,
      photographerUrl: photo.photographer_url,
      description: photo.alt || null,
      width: photo.width,
      height: photo.height,
      license: 'Pexels License',
      licenseUrl: 'https://www.pexels.com/license/',
    }));
  } catch (error) {
    console.error('Error searching Pexels:', error);
    return [];
  }
}

export async function searchStockImages(options: StockSearchOptions): Promise<{
  unsplash: StockImageResult[];
  pexels: StockImageResult[];
}> {
  const [unsplash, pexels] = await Promise.all([
    searchUnsplash(options),
    searchPexels(options),
  ]);

  return { unsplash, pexels };
}

export async function importStockImage(
  image: StockImageResult,
  tags?: { tagType: string; tagValue: string }[]
): Promise<{ asset: MediaAsset; variants: MediaVariant[] } | null> {
  try {
    const response = await fetch(image.fullUrl);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    
    const mediaTags: InsertMediaTag[] = (tags || []).map(t => ({
      assetId: 0,
      tagType: t.tagType,
      tagValue: t.tagValue,
      isPrimary: false,
    }));

    const result = await processImage(
      buffer,
      `${image.provider}-${image.id}.jpg`,
      {
        source: image.provider,
        externalId: image.id,
        photographer: image.photographer,
        license: image.license,
        licenseUrl: image.licenseUrl,
        tags: mediaTags,
      }
    );

    return result;
  } catch (error) {
    console.error('Error importing stock image:', error);
    return null;
  }
}

export async function searchAndImportForPrompt(
  prompt: string,
  options?: {
    count?: number;
    orientation?: 'landscape' | 'portrait' | 'squarish';
    preferProvider?: 'unsplash' | 'pexels';
    tags?: { tagType: string; tagValue: string }[];
  }
): Promise<{ asset: MediaAsset; variants: MediaVariant[] }[]> {
  const count = options?.count || 3;
  const searchOptions: StockSearchOptions = {
    query: prompt,
    perPage: count * 2,
    orientation: options?.orientation || 'landscape',
  };

  const results = await searchStockImages(searchOptions);
  
  let imagesToImport: StockImageResult[] = [];
  
  if (options?.preferProvider === 'pexels') {
    imagesToImport = [...results.pexels.slice(0, count)];
    if (imagesToImport.length < count) {
      imagesToImport.push(...results.unsplash.slice(0, count - imagesToImport.length));
    }
  } else {
    imagesToImport = [...results.unsplash.slice(0, count)];
    if (imagesToImport.length < count) {
      imagesToImport.push(...results.pexels.slice(0, count - imagesToImport.length));
    }
  }

  const imported: { asset: MediaAsset; variants: MediaVariant[] }[] = [];

  for (const image of imagesToImport) {
    const result = await importStockImage(image, options?.tags);
    if (result) {
      imported.push(result);
    }
  }

  return imported;
}

export function getConfigStatus(): {
  unsplash: boolean;
  pexels: boolean;
} {
  return {
    unsplash: !!UNSPLASH_ACCESS_KEY,
    pexels: !!PEXELS_API_KEY,
  };
}
