/**
 * Apparel Size Normalization & Ordering Utility
 * Handles standard apparel sizes and equivalences:
 * - 2XL / 2 XL / 2-XL = XXL
 * - 3XL / 3 XL / 3-XL = XXXL
 * - 4XL / 4 XL = XXXXL
 * - 5XL / 5 XL = XXXXXL
 * - 6XL / 6 XL = XXXXXXL
 * - 2XS = XXS, 3XS = XXXS
 */

const SIZE_TIERS: Record<string, number> = {
  // Extra Small Tiers
  '4xs': 1,
  'xxxxs': 1,
  '3xs': 2,
  'xxxs': 2,
  '2xs': 3,
  'xxs': 3,
  'xs': 4,
  'extra small': 4,

  // Standard Tiers
  's': 5,
  'small': 5,
  'm': 6,
  'medium': 6,
  'med': 6,
  'l': 7,
  'large': 7,
  'xl': 8,
  'extra large': 8,

  // 2XL / XXL (Equivalent)
  '2xl': 9,
  '2 xl': 9,
  '2-xl': 9,
  'xxl': 9,
  'double xl': 9,

  // 3XL / XXXL (Equivalent)
  '3xl': 10,
  '3 xl': 10,
  '3-xl': 10,
  'xxxl': 10,
  'triple xl': 10,

  // 4XL / XXXXL (Equivalent)
  '4xl': 11,
  '4 xl': 11,
  '4-xl': 11,
  'xxxxl': 11,

  // 5XL / XXXXXL (Equivalent)
  '5xl': 12,
  '5 xl': 12,
  '5-xl': 12,
  'xxxxxl': 12,

  // 6XL / XXXXXXL (Equivalent)
  '6xl': 13,
  '6 xl': 13,
  '6-xl': 13,
  'xxxxxxl': 13,
};

/**
 * Returns a canonical normalized key for a size string so that:
 * '2XL' === 'XXL' === '2 XL'
 * '3XL' === 'XXXL' === '3 XL'
 */
export function getCanonicalSizeKey(sizeStr?: string): string {
  if (!sizeStr) return '';
  const raw = sizeStr.toLowerCase().trim().replace(/[-_\s]+/g, '');

  // Base patterns
  if (raw === '2xl' || raw === 'xxl' || raw === '2x' || raw === 'doublexl') return '2xl';
  if (raw === '3xl' || raw === 'xxxl' || raw === '3x' || raw === 'triplexl') return '3xl';
  if (raw === '4xl' || raw === 'xxxxl' || raw === '4x') return '4xl';
  if (raw === '5xl' || raw === 'xxxxxl' || raw === '5x') return '5xl';
  if (raw === '6xl' || raw === 'xxxxxxl' || raw === '6x') return '6xl';
  if (raw === '2xs' || raw === 'xxs') return '2xs';
  if (raw === '3xs' || raw === 'xxxs') return '3xs';
  if (raw === '4xs' || raw === 'xxxxs') return '4xs';

  // Check prefix if there are suffixes like "2XL-PR" -> extract base "2xl"
  const matchWithSuffix = raw.match(/^(\d?x{1,6}l?|\d?s|\d?m|\d?l)(?:pr|pce|pcs|pair)?$/);
  if (matchWithSuffix && matchWithSuffix[1]) {
    const base = matchWithSuffix[1];
    if (base === '2xl' || base === 'xxl') return '2xl';
    if (base === '3xl' || base === 'xxxl') return '3xl';
    if (base === '4xl' || base === 'xxxxl') return '4xl';
    if (base === '5xl' || base === 'xxxxxl') return '5xl';
    if (base === '6xl' || base === 'xxxxxxl') return '6xl';
    if (base === '2xs' || base === 'xxs') return '2xs';
    if (base === '3xs' || base === 'xxxs') return '3xs';
    return base;
  }

  return raw;
}

/**
 * Extract size score rank for sorting
 */
export function getSizeTierRank(sizeStr?: string): number {
  if (!sizeStr) return 999;
  const clean = sizeStr.toLowerCase().trim();

  // Check direct lookup
  if (SIZE_TIERS[clean] !== undefined) {
    return SIZE_TIERS[clean];
  }

  // Strip spaces, dashes, punctuation
  const simplified = clean.replace(/[-_\s]+/g, '');
  if (SIZE_TIERS[simplified] !== undefined) {
    return SIZE_TIERS[simplified];
  }

  // Check canonical key
  const canonical = getCanonicalSizeKey(clean);
  if (SIZE_TIERS[canonical] !== undefined) {
    return SIZE_TIERS[canonical];
  }

  // Numeric sizes like "28", "30", "32" -> rank starting after letter sizes
  const numMatch = clean.match(/^(\d+(?:\.\d+)?)/);
  if (numMatch) {
    return 100 + parseFloat(numMatch[1]);
  }

  return 999;
}

/**
 * Compare two size strings in apparel hierarchy (XS -> S -> M -> L -> XL -> 2XL/XXL -> 3XL/XXXL -> ...)
 */
export function compareSizes(a?: string, b?: string): number {
  const cleanA = (a || '').toLowerCase().trim();
  const cleanB = (b || '').toLowerCase().trim();

  const rankA = getSizeTierRank(cleanA);
  const rankB = getSizeTierRank(cleanB);

  if (rankA !== rankB) {
    return rankA - rankB;
  }

  // If same rank (e.g. '2XL' vs 'XXL' or '3XL' vs 'XXXL'), maintain consistent alphanumeric order
  return cleanA.localeCompare(cleanB, undefined, { numeric: true, sensitivity: 'base' });
}
