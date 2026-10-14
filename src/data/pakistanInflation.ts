/**
 * Official Pakistan Inflation Reference Data
 * 
 * Source: Pakistan Bureau of Statistics (PBS), Government of Pakistan
 * Document: Press Release - September 2026 (Base Year 2015-16=100)
 * Document URL: https://www.pbs.gov.pk/wp-content/uploads/2020/07/Press-Release-September-2026.pdf
 * Reference Period: September 2026
 * 
 * Verified values from Page 1 summary:
 * - National CPI General Year-on-Year (YoY): 10.26%
 * - Month-on-Month (MoM): 1.27%
 * - Official Publication Date: Unavailable (not stated in document; not inferred from PDF metadata)
 * - Date Source Checked: October 14, 2026
 * 
 * Customer-facing display: "Prices were about 10.3% higher in September 2026 than a year earlier."
 * Precise source values (10.26% YoY, 1.27% MoM) are preserved internally.
 * 
 * NOTE: This is NOT a live feed. It is a source-verified historical observation.
 * Future inflation in user plans is an assumed modeling parameter, not a prediction.
 */

export interface OfficialInflationObservation {
  indicator: string;
  geographicCoverage: string;
  referenceMonth: string;
  referenceYear: number;
  referencePeriod: string;
  publishedPercentage: number; // Customer-facing rounded: 10.3%
  exactYoYPercentage: number;  // Exact source value: 10.26%
  monthOnMonthPercentage: number; // Exact source value: 1.27%
  officialSourceUrl: string;
  officialDocumentUrl: string;
  publicationTitle: string;
  publisher: string;
  publicationDate: string; // 'Unavailable' - not stated on document
  dateChecked: string;
  isLiveFeed: false;
}

export const LATEST_OFFICIAL_INFLATION: OfficialInflationObservation = {
  indicator: 'National Headline Consumer Price Index (CPI General, 2015-16=100) Year-on-Year',
  geographicCoverage: 'Pakistan (National: 68 urban markets in 35 cities, 27 rural centers)',
  referenceMonth: 'September',
  referenceYear: 2026,
  referencePeriod: 'September 2026',
  publishedPercentage: 10.3,
  exactYoYPercentage: 10.26,
  monthOnMonthPercentage: 1.27,
  officialSourceUrl: 'https://www.pbs.gov.pk/price-statistics/',
  officialDocumentUrl: 'https://www.pbs.gov.pk/wp-content/uploads/2020/07/Press-Release-September-2026.pdf',
  publicationTitle: 'Press Release - Price Indices September 2026',
  publisher: 'Pakistan Bureau of Statistics (PBS), Government of Pakistan',
  publicationDate: 'Unavailable',
  dateChecked: 'October 14, 2026',
  isLiveFeed: false,
};
