/**
 * Turns whatever a rider typed, pasted or scanned into a canonical ride code
 * ("RH-7K29XB"). Accepts:
 *   - the bare code, any case, with stray spaces / dashes:  "rh 7k29xb", "RH7K29XB"
 *   - just the 6 characters:                                "7k29xb"
 *   - a full share link:                                    "https://host/join/RH-7K29XB"
 * Returns null when nothing code-shaped can be found.
 */
export function parseRideCode(input: string): string | null {
  if (!input) return null;
  let text = input.trim();

  // Pull the code out of a share link if one was pasted/scanned.
  const fromUrl = text.match(/\/join\/([^/?#\s]+)/i);
  if (fromUrl) text = decodeURIComponent(fromUrl[1]);

  const compact = text.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (compact.startsWith('RH') && compact.length === 8) return `RH-${compact.slice(2)}`;
  if (compact.length === 6) return `RH-${compact}`;
  return null;
}
