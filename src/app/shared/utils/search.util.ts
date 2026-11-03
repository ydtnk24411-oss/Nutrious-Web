/**
 * Vietnamese diacritics removal and search normalization
 */
export function removeVietnameseTones(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .trim();
}

function escapeHtml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export interface SearchableProduct {
  _id?: string;
  id?: string;
  name: string;
  slug?: string;
  price?: string;
  priceNumber?: number;
  image?: string;
  categoryId?: string;
  category?: string;
  categoryVi?: string;
  description?: string;
  type?: string;
  weight?: string;
  quantity?: string;
  packSize?: string;
  [key: string]: any;
}

/**
 * Calculate relevance score of a product against a search query.
 * Returns 0 if product does not match. Higher score = more relevant.
 */
export function scoreProduct(
  p: SearchableProduct,
  rawQuery: string,
  normQuery: string
): number {
  if (!rawQuery || !normQuery) return 0;

  const rawName = (p.name || '').toLowerCase();
  const normName = removeVietnameseTones(p.name || '');

  const rawCat = `${p.categoryVi || ''} ${p.category || ''}`.toLowerCase();
  const normCat = removeVietnameseTones(rawCat);

  const rawDesc = (p.description || '').toLowerCase();
  const normDesc = removeVietnameseTones(p.description || '');

  const rawType = (p.type || '').toLowerCase();
  const normType = removeVietnameseTones(p.type || '');

  const queryTokens = normQuery.split(/\s+/).filter(Boolean);
  const rawTokens = rawQuery.split(/\s+/).filter(Boolean);
  const isShort = normQuery.length <= 3;
  const isAccented = rawQuery !== normQuery;

  let score = 0;
  let matchedInName = false;
  let matchedInCat = false;
  let matchedInType = false;

  // 1. Direct / Exact Name matches (highest priority)
  if (rawName === rawQuery) {
    score += 3000;
    matchedInName = true;
  } else if (normName === normQuery) {
    score += isAccented ? 600 : 2500;
    matchedInName = true;
  }

  // Name prefix
  const rawNameStartsWithWord = new RegExp('^' + rawQuery + '([\\s,.-]|$)', 'i').test(rawName);
  const normNameStartsWithWord = new RegExp('^' + normQuery + '([\\s,.-]|$)', 'i').test(normName);

  if (rawNameStartsWithWord) {
    score += 2000;
    matchedInName = true;
  } else if (normNameStartsWithWord) {
    score += isAccented ? 80 : 1600;
    matchedInName = true;
  } else if (!isShort && normName.startsWith(normQuery)) {
    score += isAccented ? 60 : 1200;
    matchedInName = true;
  }

  // Word match in Name (e.g. "bò" in "Thịt Bò", "cá" in "Lẩu Cá")
  const wordExactRegexRaw = new RegExp('(^|[\\s,.-])' + rawQuery + '([\\s,.-]|$)', 'i');
  const wordExactRegexNorm = new RegExp('(^|[\\s,.-])' + normQuery + '([\\s,.-]|$)', 'i');

  if (wordExactRegexRaw.test(rawName)) {
    score += 1500;
    matchedInName = true;
  } else if (wordExactRegexNorm.test(normName)) {
    score += isAccented ? 70 : 1000;
    matchedInName = true;
  } else if (!isShort) {
    const wordPrefixRegex = new RegExp('(^|[\\s,.-])' + normQuery, 'i');
    if (wordPrefixRegex.test(normName)) {
      score += isAccented ? 50 : 400;
      matchedInName = true;
    }
  }

  // Multiple tokens in Name
  if (queryTokens.length > 1) {
    const allTokensMatchWords = queryTokens.every((tok, idx) => {
      if (idx === queryTokens.length - 1 && tok.length < 3) {
        return new RegExp('(^|[\\s,.-])' + tok, 'i').test(normName);
      }
      return new RegExp('(^|[\\s,.-])' + tok + '([\\s,.-]|$)', 'i').test(normName);
    });

    if (allTokensMatchWords) {
      score += 1200;
      matchedInName = true;
      if (rawTokens.every(tok => rawName.includes(tok))) {
        score += 400;
      }
    }
  }

  // 2. Category matching
  const catExactRegexRaw = new RegExp('(^|[\\s,.-])' + rawQuery + '([\\s,.-]|$)', 'i');
  const catExactRegexNorm = new RegExp('(^|[\\s,.-])' + normQuery + '([\\s,.-]|$)', 'i');

  if (catExactRegexRaw.test(rawCat)) {
    score += 600;
    matchedInCat = true;
  } else if (catExactRegexNorm.test(normCat)) {
    score += isAccented ? 100 : 450;
    matchedInCat = true;
  } else if (queryTokens.length > 1 && queryTokens.every(tok => new RegExp('(^|[\\s,.-])' + tok + '([\\s,.-]|$)', 'i').test(normCat))) {
    score += 300;
    matchedInCat = true;
  }

  // 3. Product Type / Attributes
  if (normType === normQuery || new RegExp('(^|[\\s,.-])' + normQuery + '([\\s,.-]|$)', 'i').test(normType)) {
    score += 200;
    matchedInType = true;
  }

  // 4. Description matching
  if (!isShort) {
    const descExactRegexNorm = new RegExp('(^|[\\s,.-])' + normQuery + '([\\s,.-]|$)', 'i');
    if (descExactRegexNorm.test(normDesc)) {
      score += 40;
    } else if (queryTokens.length > 1 && queryTokens.every(tok => new RegExp('(^|[\\s,.-])' + tok + '([\\s,.-]|$)', 'i').test(normDesc))) {
      score += 30;
    }
  }

  // If query only matched in description and not in Name/Cat/Type,
  // we give it a low score so it ranks way below true relevant products.
  if (!matchedInName && !matchedInCat && !matchedInType && score > 0) {
    score = Math.min(score, 50);
  }

  return score;
}

/**
 * Filter and sort products by relevance to query
 */
export function searchProducts<T extends SearchableProduct>(
  products: T[],
  query: string,
  limit = 8
): T[] {
  const rawQ = (query || '').toLowerCase().trim();
  const normQ = removeVietnameseTones(query);
  if (!normQ) return [];

  const scored: { product: T; score: number }[] = [];

  for (const product of products) {
    const s = scoreProduct(product, rawQ, normQ);
    if (s > 0) {
      scored.push({ product, score: s });
    }
  }

  // Sort descending by score
  scored.sort((a, b) => b.score - a.score);

  // If we have strong matches (score >= 150), filter out pure description noise (score <= 50)
  const strongMatches = scored.filter(item => item.score >= 150);
  const candidates = strongMatches.length >= 2 ? strongMatches : scored;

  return candidates.slice(0, limit).map(item => item.product);
}

/**
 * Highlight matched substring in text for HTML display
 */
export function highlightMatch(text: string, query: string): string {
  if (!query || !query.trim() || !text) return escapeHtml(text || '');

  const normQuery = removeVietnameseTones(query);
  const normText = removeVietnameseTones(text);

  const idx = normText.indexOf(normQuery);
  if (idx !== -1) {
    const matchLen = Math.min(query.length, text.length - idx);
    const before = escapeHtml(text.substring(0, idx));
    const matched = escapeHtml(text.substring(idx, idx + matchLen));
    const after = escapeHtml(text.substring(idx + matchLen));
    return `${before}<mark class="xl-search-highlight">${matched}</mark>${after}`;
  }

  return escapeHtml(text);
}