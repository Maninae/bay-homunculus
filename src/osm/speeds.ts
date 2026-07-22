/**
 * Free-flow speed assignment for OSM ways: parse `maxspeed` when present,
 * fall back to a per-class default. All speeds in mph internally.
 */

export const DEFAULT_SPEED_MPH_BY_CLASS: Record<string, number> = {
  motorway: 65,
  motorway_link: 40,
  trunk: 55,
  trunk_link: 35,
  primary: 35,
  primary_link: 30,
  secondary: 30,
  secondary_link: 25,
  tertiary: 28,
  tertiary_link: 25,
  unclassified: 25,
  residential: 25,
};

const KMH_TO_MPH = 0.621371;

/** Parse an OSM maxspeed tag to mph, or null when unparseable ("signals", "none", …). */
export function parseMaxspeedToMph(maxspeedTag: string | undefined): number | null {
  if (!maxspeedTag) return null;
  const mphMatch = maxspeedTag.match(/^(\d+(?:\.\d+)?)\s*mph$/i);
  if (mphMatch) return Number(mphMatch[1]);
  const bareNumberMatch = maxspeedTag.match(/^(\d+(?:\.\d+)?)$/);
  if (bareNumberMatch) return Number(bareNumberMatch[1]) * KMH_TO_MPH;
  return null;
}

/** Free-flow speed for a way: tagged maxspeed if sane, else the class default. */
export function freeFlowSpeedMph(highwayClass: string, maxspeedTag: string | undefined): number {
  const parsed = parseMaxspeedToMph(maxspeedTag);
  if (parsed !== null && parsed >= 5 && parsed <= 85) return parsed;
  return DEFAULT_SPEED_MPH_BY_CLASS[highwayClass] ?? 25;
}
