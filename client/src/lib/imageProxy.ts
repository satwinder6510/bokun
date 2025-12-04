export function getProxiedImageUrl(url: string | null | undefined): string {
  const fallbackImage = "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&q=80";
  
  if (!url) {
    return fallbackImage;
  }

  // Local uploads don't need proxy
  if (url.startsWith('/uploads/') || url.startsWith('/objects/')) {
    return url;
  }

  // External images that need CORS proxy
  if (url.includes('admin.citiesandbeaches.com') || url.includes('citiesandbeaches.com')) {
    return `/api/image-proxy?url=${encodeURIComponent(url)}`;
  }

  // Other external images (Unsplash, Bokun S3) typically have proper CORS
  return url;
}
