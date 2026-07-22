/**
 * Douglas-Peucker polyline simplification in local meter space, used to keep
 * the viewer bundle small without visibly changing road shapes.
 */

import { METERS_PER_DEG_LAT, METERS_PER_DEG_LON } from "./region.ts";

/** Perpendicular distance (meters) from a point to the segment a-b, all in lat/lon. */
function pointToSegmentMeters(
  plat: number, plon: number,
  alat: number, alon: number,
  blat: number, blon: number,
): number {
  const px = (plon - alon) * METERS_PER_DEG_LON;
  const py = (plat - alat) * METERS_PER_DEG_LAT;
  const bx = (blon - alon) * METERS_PER_DEG_LON;
  const by = (blat - alat) * METERS_PER_DEG_LAT;
  const segLengthSq = bx * bx + by * by;
  const t = segLengthSq === 0 ? 0 : Math.max(0, Math.min(1, (px * bx + py * by) / segLengthSq));
  return Math.hypot(px - t * bx, py - t * by);
}

/** Simplify lat/lon arrays with tolerance in meters; returns kept indices in order. */
export function simplifyPolylineIndices(lats: number[], lons: number[], toleranceMeters: number): number[] {
  const pointCount = lats.length;
  if (pointCount <= 2) return lats.map((_, i) => i);
  const keep = new Uint8Array(pointCount);
  keep[0] = 1;
  keep[pointCount - 1] = 1;
  const stack: [number, number][] = [[0, pointCount - 1]];
  while (stack.length > 0) {
    const [start, end] = stack.pop()!;
    let worstDist = 0;
    let worstIdx = -1;
    for (let i = start + 1; i < end; i++) {
      const d = pointToSegmentMeters(lats[i], lons[i], lats[start], lons[start], lats[end], lons[end]);
      if (d > worstDist) { worstDist = d; worstIdx = i; }
    }
    if (worstIdx !== -1 && worstDist > toleranceMeters) {
      keep[worstIdx] = 1;
      stack.push([start, worstIdx], [worstIdx, end]);
    }
  }
  const kept: number[] = [];
  for (let i = 0; i < pointCount; i++) if (keep[i]) kept.push(i);
  return kept;
}
