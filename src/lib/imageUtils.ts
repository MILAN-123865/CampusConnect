/**
 * Given a full Supabase storage URL (e.g., from the 'events' bucket),
 * returns the corresponding tiny thumbnail URL from the 'thumbnails' bucket.
 * 
 * E.g.
 * Original: https://xyz.supabase.co/storage/v1/object/public/events/banners/image.png
 * Thumb:    https://xyz.supabase.co/storage/v1/object/public/thumbnails/banners/image.webp
 */
export function getThumbnailUrl(originalUrl: string): string | undefined {
  if (!originalUrl) return undefined;

  try {
    const urlObj = new URL(originalUrl);
    
    // We expect paths like: /storage/v1/object/public/events/banners/xyz.png
    // We need to replace /public/events/ with /public/thumbnails/
    if (urlObj.pathname.includes("/public/events/")) {
      urlObj.pathname = urlObj.pathname.replace("/public/events/", "/public/thumbnails/");
      
      // Also, the edge function generates thumbnails as .webp (or .jpg fallback),
      // we'll try .webp since the edge function prefers it.
      urlObj.pathname = urlObj.pathname.replace(/(\.[^.]+)$/, ".webp");
      return urlObj.toString();
    }
  } catch (err) {
    console.error("Failed to parse image URL", err);
  }

  return undefined;
}
