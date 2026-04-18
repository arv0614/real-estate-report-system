/**
 * e-Stat API: Population trend data by municipality.
 * Implemented in Task 2-2. This file is a stub for Task 2-1 builds.
 */

export interface PopulationPoint {
  year: number;
  population: number;
}

export interface PopulationData {
  cityCode: string;
  cityName: string;
  history: PopulationPoint[];
  /** Annual growth rate, e.g. -0.015 = -1.5%/year */
  trend: number;
  proj5: number | null;
  proj10: number | null;
  source: string;
}

export async function fetchPopulationTrend(
  _cityCode: string,
  _apiKey: string
): Promise<PopulationData | null> {
  // Full implementation in Task 2-2
  return null;
}
