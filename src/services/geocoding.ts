import type { LatLng, Place } from "../types";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse";

export async function searchPlaces(query: string): Promise<Place[]> {
  if (query.trim().length < 3) return [];

  const params = new URLSearchParams({
    q: query,
    format: "json",
    limit: "5",
    addressdetails: "1",
  });

  const res = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(`Geocoding failed: ${res.status}`);
  }

  const data = (await res.json()) as Array<{
    display_name: string;
    lat: string;
    lon: string;
  }>;

  return data.map((item) => ({
    label: item.display_name,
    lat: parseFloat(item.lat),
    lng: parseFloat(item.lon),
  }));
}

export interface ReverseGeoResult {
  countryCode: string;
  countryName: string;
  label: string;
}

export async function reverseGeocode(point: LatLng): Promise<ReverseGeoResult | null> {
  const params = new URLSearchParams({
    lat: String(point.lat),
    lon: String(point.lng),
    format: "json",
    zoom: "6",
    addressdetails: "1",
  });

  const res = await fetch(`${NOMINATIM_REVERSE_URL}?${params.toString()}`, {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(`Reverse geocoding failed: ${res.status}`);
  }

  const data = await res.json();

  if (!data.address?.country_code) return null;

  return {
    countryCode: (data.address.country_code as string).toUpperCase(),
    countryName: data.address.country ?? data.address.country_code.toUpperCase(),
    label: data.display_name ?? "",
  };
}
