/**
 * Stage 3: hexagonal anchor grid over the region, land-masked by road proximity.
 *
 * A hex lattice point becomes an anchor only if a graph junction sits within
 * ANCHOR_MAX_SNAP_METERS. The bay, ocean, and roadless open space have no
 * junctions, so this one rule IS the land mask: no water polygons needed.
 * The anchor's geographic position is the snapped junction (times are measured
 * from that node, so using the raw hex center would add up to 500 m of lie).
 *
 * Input:  data/graph.json
 * Output: data/anchors.json  { anchors: [{ lat, lon, node }] }
 */

import { readFileSync, writeFileSync } from "node:fs";
import {
  REGION_BBOX, HEX_GRID_SPACING_METERS, ANCHOR_MAX_SNAP_METERS,
  METERS_PER_DEG_LAT, METERS_PER_DEG_LON,
} from "../src/geo/region.ts";
import { haversineMeters } from "../src/geo/haversine.ts";

function main(): void {
  const graph = JSON.parse(readFileSync("data/graph.json", "utf8")) as {
    nodeLat: number[]; nodeLon: number[];
  };
  const nodeCount = graph.nodeLat.length;

  // Spatial hash of junctions, cell size = snap radius, so a snap query only
  // inspects the 3x3 neighborhood of cells around the hex point.
  const cellSizeM = ANCHOR_MAX_SNAP_METERS;
  const cellsByKey = new Map<string, number[]>();
  const cellOf = (lat: number, lon: number): [number, number] => [
    Math.floor(((lat - REGION_BBOX.south) * METERS_PER_DEG_LAT) / cellSizeM),
    Math.floor(((lon - REGION_BBOX.west) * METERS_PER_DEG_LON) / cellSizeM),
  ];
  for (let i = 0; i < nodeCount; i++) {
    const [row, col] = cellOf(graph.nodeLat[i], graph.nodeLon[i]);
    const key = `${row},${col}`;
    let bucket = cellsByKey.get(key);
    if (!bucket) { bucket = []; cellsByKey.set(key, bucket); }
    bucket.push(i);
  }

  const nearestJunction = (lat: number, lon: number): { node: number; distM: number } => {
    const [row, col] = cellOf(lat, lon);
    let bestNode = -1;
    let bestDist = Infinity;
    for (let r = row - 1; r <= row + 1; r++) {
      for (let c = col - 1; c <= col + 1; c++) {
        const bucket = cellsByKey.get(`${r},${c}`);
        if (!bucket) continue;
        for (const node of bucket) {
          const d = haversineMeters(lat, lon, graph.nodeLat[node], graph.nodeLon[node]);
          if (d < bestDist) { bestDist = d; bestNode = node; }
        }
      }
    }
    return { node: bestNode, distM: bestDist };
  };

  // Hex lattice: rows spaced s*sqrt(3)/2 apart, odd rows offset by s/2.
  const rowSpacingM = (HEX_GRID_SPACING_METERS * Math.sqrt(3)) / 2;
  const heightM = (REGION_BBOX.north - REGION_BBOX.south) * METERS_PER_DEG_LAT;
  const widthM = (REGION_BBOX.east - REGION_BBOX.west) * METERS_PER_DEG_LON;
  const anchors: { lat: number; lon: number; node: number }[] = [];
  const usedNodes = new Set<number>();
  let latticePoints = 0;

  for (let row = 0; row * rowSpacingM <= heightM; row++) {
    const offsetM = row % 2 === 1 ? HEX_GRID_SPACING_METERS / 2 : 0;
    for (let col = 0; col * HEX_GRID_SPACING_METERS + offsetM <= widthM; col++) {
      latticePoints++;
      const lat = REGION_BBOX.south + (row * rowSpacingM) / METERS_PER_DEG_LAT;
      const lon = REGION_BBOX.west + (col * HEX_GRID_SPACING_METERS + offsetM) / METERS_PER_DEG_LON;
      const { node, distM } = nearestJunction(lat, lon);
      if (node === -1 || distM > ANCHOR_MAX_SNAP_METERS || usedNodes.has(node)) continue;
      usedNodes.add(node);
      anchors.push({
        lat: Number(graph.nodeLat[node].toFixed(6)),
        lon: Number(graph.nodeLon[node].toFixed(6)),
        node,
      });
    }
  }

  writeFileSync("data/anchors.json", JSON.stringify({ anchors }));
  console.log(`Hex lattice: ${latticePoints} points -> ${anchors.length} land anchors`);
  console.log(`Pairs to route: ${(anchors.length * (anchors.length - 1)) / 2}`);
}

main();
