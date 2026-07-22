/**
 * Modeled Friday-evening congestion profile: the no-API-key traffic source.
 *
 * Every multiplier here is a hand-tuned model of a typical Friday 5pm, not a
 * measurement. The viewer labels the mode "modeled" for exactly that reason.
 * When a TomTom key lands in .env, the TomTom provider replaces this with
 * probe-measured per-edge multipliers (see docs/DATA_SOURCES.md).
 *
 * Shape of the model:
 * - A base multiplier per road class (freeways degrade more than side streets
 *   at rush hour in absolute terms, and their queues are systemwide).
 * - Corridor overrides for the famous chokepoints, matched on OSM ref/name.
 *   A way takes the max of its class base and any corridor match, capped.
 */

export interface TrafficWayInfo {
  cls: string;
  name?: string;
  ref?: string;
  /** Representative point (first vertex), used by bbox-scoped corridor overrides. */
  lat?: number;
  lon?: number;
}

export const CONGESTION_MULTIPLIER_CAP = 4.0;

const BASE_MULTIPLIER_BY_CLASS: Record<string, number> = {
  motorway: 1.6,
  motorway_link: 1.5,
  trunk: 1.5,
  trunk_link: 1.4,
  primary: 1.45,
  primary_link: 1.4,
  secondary: 1.35,
  secondary_link: 1.3,
  tertiary: 1.25,
  tertiary_link: 1.2,
  unclassified: 1.15,
  residential: 1.15,
};

interface CorridorOverride {
  pattern: RegExp;
  multiplier: number;
  label: string;
  /** When set, the override only applies to ways whose representative point falls inside. */
  bbox?: { south: number; west: number; north: number; east: number };
}

/**
 * Chokepoint corridors. Patterns run against "ref name". The Bay Bridge is
 * matched by ref + bbox because its OSM ways are named "Route 80" and
 * "Dwight D. Eisenhower Highway", never "Bay Bridge". The Golden Gate Bridge
 * carries ref US 101, so the general US-101 multiplier below governs it.
 */
const CORRIDOR_OVERRIDES: CorridorOverride[] = [
  {
    pattern: /\bI 80\b/, multiplier: 2.4, label: "SF-Oakland Bay Bridge",
    bbox: { south: 37.78, west: -122.41, north: 37.84, east: -122.28 },
  },
  { pattern: /San Rafael Bridge/i, multiplier: 1.8, label: "Richmond-San Rafael Bridge" },
  { pattern: /San Mateo.{0,3}Hayward Bridge|San Mateo Bridge/i, multiplier: 2.0, label: "San Mateo-Hayward Bridge" },
  { pattern: /Dumbarton Bridge/i, multiplier: 1.9, label: "Dumbarton Bridge" },
  { pattern: /\bI 80\b/, multiplier: 2.2, label: "I-80 Eastshore / MacArthur Maze" },
  { pattern: /\bUS 101\b/, multiplier: 1.9, label: "US-101" },
  { pattern: /\bI 880\b/, multiplier: 1.9, label: "I-880 Nimitz" },
  { pattern: /\bI 238\b/, multiplier: 1.8, label: "I-238 connector" },
  { pattern: /\bI 580\b/, multiplier: 1.7, label: "I-580" },
  { pattern: /\bCA 24\b/, multiplier: 1.6, label: "CA-24 Caldecott approach" },
  { pattern: /19th Avenue/i, multiplier: 1.8, label: "19th Ave (CA-1)" },
  { pattern: /\bI 280\b/, multiplier: 1.5, label: "I-280" },
];

function wayInsideBbox(way: TrafficWayInfo, bbox: NonNullable<CorridorOverride["bbox"]>): boolean {
  if (way.lat === undefined || way.lon === undefined) return false;
  return way.lat >= bbox.south && way.lat <= bbox.north && way.lon >= bbox.west && way.lon <= bbox.east;
}

/** Friday-5pm slowdown multiplier for one way (>= 1, capped). */
export function fridayEveningMultiplier(way: TrafficWayInfo): number {
  let multiplier = BASE_MULTIPLIER_BY_CLASS[way.cls] ?? 1.1;
  const matchText = `${way.ref ?? ""} ${way.name ?? ""}`;
  for (const corridor of CORRIDOR_OVERRIDES) {
    if (corridor.multiplier <= multiplier) continue;
    if (corridor.bbox && !wayInsideBbox(way, corridor.bbox)) continue;
    if (corridor.pattern.test(matchText)) multiplier = corridor.multiplier;
  }
  return Math.min(multiplier, CONGESTION_MULTIPLIER_CAP);
}
