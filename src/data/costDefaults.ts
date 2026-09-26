import type { CostSettings } from "../types";

export const DEFAULT_COST_SETTINGS: CostSettings = {
  currency: "$",
  fuelEconomyKmPerL: 12,
  fuelPricePerL: 1.5,
  tollPer100Km: 3,
  hotelPerNight: 60,
};

export interface LegCostInput {
  label: string;
  distanceKm: number;
  nights: number;
}

export interface CostBreakdown {
  label: string;
  fuel: number;
  tolls: number;
  hotel: number;
  total: number;
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
    const tolls = (leg.distanceKm / 100) * settings.tollPer100Km;
    const hotel = leg.nights * settings.hotelPerNight;
    return { label: leg.label, fuel, tolls, hotel, total: fuel + tolls + hotel };
  });

  const grandTotal = perLeg.reduce((sum, l) => sum + l.total, 0);
  return { perLeg, grandTotal };
}
