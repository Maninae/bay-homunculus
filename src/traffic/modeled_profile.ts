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

/** Chokepoint corridors. Patterns run against "ref name" (OSM bridge names include unicode dashes, so match fragments). */
const CORRIDOR_OVERRIDES: { pattern: RegExp; multiplier: number; label: string }[] = [
  { pattern: /Bay Bridge/i, multiplier: 2.4, label: "SF-Oakland Bay Bridge" },
  { pattern: /San Rafael Bridge/i, multiplier: 1.8, label: "Richmond-San Rafael Bridge" },
  { pattern: /San Mateo.{0,3}Hayward Bridge|San Mateo Bridge/i, multiplier: 2.0, label: "San Mateo-Hayward Bridge" },
  { pattern: /Dumbarton Bridge/i, multiplier: 1.9, label: "Dumbarton Bridge" },
  { pattern: /Golden Gate Bridge/i, multiplier: 1.7, label: "Golden Gate Bridge" },
  { pattern: /\bI 80\b/, multiplier: 2.2, label: "I-80 Eastshore / MacArthur Maze" },
  { pattern: /\bUS 101\b/, multiplier: 1.9, label: "US-101" },
  { pattern: /\bI 880\b/, multiplier: 1.9, label: "I-880 Nimitz" },
  { pattern: /\bI 238\b/, multiplier: 1.8, label: "I-238 connector" },
  { pattern: /\bI 580\b/, multiplier: 1.7, label: "I-580" },
  { pattern: /\bCA 24\b/, multiplier: 1.6, label: "CA-24 Caldecott approach" },
  { pattern: /19th Avenue/i, multiplier: 1.8, label: "19th Ave (CA-1)" },
  { pattern: /\bI 280\b/, multiplier: 1.5, label: "I-280" },
];

/** Friday-5pm slowdown multiplier for one way (>= 1, capped). */
export function fridayEveningMultiplier(way: TrafficWayInfo): number {
  let multiplier = BASE_MULTIPLIER_BY_CLASS[way.cls] ?? 1.1;
  const matchText = `${way.ref ?? ""} ${way.name ?? ""}`;
  for (const corridor of CORRIDOR_OVERRIDES) {
    if (corridor.multiplier > multiplier && corridor.pattern.test(matchText)) {
      multiplier = corridor.multiplier;
    }
  }
  return Math.min(multiplier, CONGESTION_MULTIPLIER_CAP);
}
