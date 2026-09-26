import type { CostSettings, LegKey, TollBooth } from "../types";

export const DEFAULT_COST_SETTINGS: CostSettings = {
  currency: "$",
  fuelEconomyKmPerL: 12,
  fuelPricePerL: 1.5,
  tollPer100Km: 3,
  tollPerBooth: 5,
  hotelPerNight: 60,
};

export interface LegCostInput {
  key: LegKey;
  label: string;
  distanceKm: number;
  nights: number;
  /** null = toll booths not detected for this leg yet — falls back to the flat per-100km rate. */
  tollBooths: TollBooth[] | null;
  detectingTolls: boolean;
  tollError: string | null;
}

export interface CostBreakdown {
  label: string;
  fuel: number;
  tolls: number;
  hotel: number;
  total: number;
  tollBoothCount: number | null;
}

export function computeCosts(
  legs: LegCostInput[],
  settings: CostSettings,
): { perLeg: CostBreakdown[]; grandTotal: number } {
  const perLeg = legs.map((leg) => {
    const fuel =
      settings.fuelEconomyKmPerL > 0
        ? (leg.distanceKm / settings.fuelEconomyKmPerL) * settings.fuelPricePerL
        : 0;

    const tollBoothCount = leg.tollBooths?.length ?? null;
    const tolls =
      tollBoothCount !== null
        ? tollBoothCount * settings.tollPerBooth
        : (leg.distanceKm / 100) * settings.tollPer100Km;

    const hotel = leg.nights * settings.hotelPerNight;
    return {
      label: leg.label,
      fuel,
      tolls,
      hotel,
      total: fuel + tolls + hotel,
      tollBoothCount,
    };
  });

  const grandTotal = perLeg.reduce((sum, l) => sum + l.total, 0);
  return { perLeg, grandTotal };
}
