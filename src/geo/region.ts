/**
 * The v1 region: SF + southern Marin + Peninsula down to Palo Alto + East Bay
 * from Richmond to Hayward. One rectangle in degrees; the land mask falls out
 * of road proximity later (the bay has no roads), so no water polygons needed.
 */

export interface BoundingBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

/** Covers every famous chokepoint: all five central bridges land inside it. */
export const REGION_BBOX: BoundingBox = {
  south: 37.38,
  west: -122.55,
  north: 37.99,
  east: -122.0,
};

/** Hex grid spacing in meters. ~1.5 km keeps land anchors near 1,000 (pairs grow as N²). */
export const HEX_GRID_SPACING_METERS = 1500;

/** A hex point becomes an anchor only if a drivable-graph junction sits within this radius. */
export const ANCHOR_MAX_SNAP_METERS = 500;

/** Local approximation scale: meters per degree at the region's center latitude. */
export const METERS_PER_DEG_LAT = 111_132;
export const REGION_CENTER_LAT = (REGION_BBOX.south + REGION_BBOX.north) / 2;
export const METERS_PER_DEG_LON =
  111_320 * Math.cos((REGION_CENTER_LAT * Math.PI) / 180);
