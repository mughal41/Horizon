/**
 * Contextual labels and educational references for Horizon Pakistan.
 * No hardcoded return or inflation rates are treated as facts or recommendations.
 */

export const MARKET_BENCHMARKS = {
  // Common wealth categories tracked separately from equity projections
  nonProjectedCategories: [
    { id: 'emergency_cash', label: 'Cash Kept Aside / Emergency Reserve', hint: 'Liquid cash preserved for emergencies, not invested' },
    { id: 'gold', label: 'Gold / Jewelry (Tolas)', hint: 'Physical gold tracked as separate wealth' },
    { id: 'kameti', label: 'Committee (Kameti)', hint: 'Informal pooled savings; not a market investment' },
    { id: 'property', label: 'Property / Land / Plot', hint: 'Real estate tracked separately from equity portfolio' },
    { id: 'other', label: 'Other Asset', hint: 'Any other asset tracked for net worth' },
  ] as const,

  // Common goals (for user labeling only)
  goals: [
    { id: 'wealth_growth', title: 'Long-Term Wealth Building', defaultYears: 10 },
    { id: 'children_future', title: 'Children’s Education', defaultYears: 12 },
    { id: 'future_home', title: 'Future Home or Land', defaultYears: 7 },
    { id: 'later_years', title: 'Later Years Peace of Mind', defaultYears: 15 },
  ] as const,
};
