const IMPACT_SCORE_BY_KEYWORD: Array<{ keywords: string[]; score: number }> = [
  { keywords: ['muy alta', 'very high'], score: 95 },
  { keywords: ['media-alta', 'media alta', 'medium-high'], score: 75 },
  { keywords: ['alta', 'alto', 'high'], score: 80 },
  { keywords: ['media', 'medio', 'moderate'], score: 60 },
  { keywords: ['baja', 'bajo', 'low'], score: 35 },
  { keywords: ['muy baja', 'very low'], score: 15 },
  { keywords: ['pendiente', 'pending'], score: 0 },
];

export const normalizeImpactScore = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.min(100, Math.round(value)));
  }

  const normalizedValue = String(value ?? '').trim().toLowerCase();
  if (!normalizedValue) return 0;

  const numericMatch = normalizedValue.match(/-?\d+(?:[.,]\d+)?/);
  if (numericMatch) {
    const parsed = Number.parseFloat(numericMatch[0].replace(',', '.'));
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.min(100, Math.round(parsed)));
    }
  }

  const legacyMatch = IMPACT_SCORE_BY_KEYWORD.find(({ keywords }) =>
    keywords.some((keyword) => normalizedValue.includes(keyword))
  );

  return legacyMatch?.score ?? 0;
};

export const formatImpactScore = (value: unknown): string => `${normalizeImpactScore(value)}%`;

export const getImpactScoreTier = (value: unknown): 'high' | 'medium' | 'low' => {
  const score = normalizeImpactScore(value);
  if (score >= 75) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
};