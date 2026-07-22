/**
 * Stage 1: fetch drivable streets for the region from Overpass (tiled, cached)
 * and write a compact ways file for the graph builder.
 *
 * Output: data/streets.json
 *   { ways: [{ id, cls, mph, oneway, bridge, name?, ref?, refs, lats, lons }] }
 *   - oneway: 1 forward-only, -1 backward-only, 0 both directions
 *   - name/ref kept only for secondary-and-up (corridor matching); saves ~30% file size
 */

import { writeFileSync } from "node:fs";
import { fetchDrivableWays } from "../src/osm/overpass.ts";
import { freeFlowSpeedMph } from "../src/osm/speeds.ts";
import { REGION_BBOX } from "../src/geo/region.ts";

const TILE_ROWS = 3;
const TILE_COLS = 3;
const NAMED_CLASSES = new Set(["motorway", "motorway_link", "trunk", "trunk_link", "primary", "secondary"]);

interface CompactWay {
  id: number;
  cls: string;
  mph: number;
  oneway: 0 | 1 | -1;
  bridge: boolean;
  name?: string;
  ref?: string;
  refs: number[];
  lats: number[];
  lons: number[];
}

function parseOneway(highwayClass: string, tags: Record<string, string>): 0 | 1 | -1 {
  const onewayTag = tags["oneway"];
  if (onewayTag === "yes" || onewayTag === "1" || onewayTag === "true") return 1;
  if (onewayTag === "-1") return -1;
  if (onewayTag === "no") return 0;
  if (tags["junction"] === "roundabout") return 1;
  // OSM convention: motorway carriageways are one-way unless tagged otherwise
  if (highwayClass === "motorway") return 1;
  return 0;
}

async function main(): Promise<void> {
  console.log("Fetching drivable ways from Overpass…");
  const rawWays = await fetchDrivableWays(REGION_BBOX, TILE_ROWS, TILE_COLS, "data/cache");

  const compactWays: CompactWay[] = [];
  for (const way of rawWays) {
    const tags = way.tags ?? {};
    const highwayClass = tags["highway"];
    if (!highwayClass || way.nodes.length < 2 || way.geometry.length !== way.nodes.length) continue;
    const compact: CompactWay = {
      id: way.id,
      cls: highwayClass,
      mph: freeFlowSpeedMph(highwayClass, tags["maxspeed"]),
      oneway: parseOneway(highwayClass, tags),
      bridge: tags["bridge"] === "yes" || tags["bridge"] === "viaduct",
      refs: way.nodes,
      lats: way.geometry.map((g) => Number(g.lat.toFixed(6))),
      lons: way.geometry.map((g) => Number(g.lon.toFixed(6))),
    };
    if (NAMED_CLASSES.has(highwayClass)) {
      if (tags["name"]) compact.name = tags["name"];
      if (tags["ref"]) compact.ref = tags["ref"];
    }
    compactWays.push(compact);
  }

  writeFileSync("data/streets.json", JSON.stringify({ ways: compactWays }));

  const classCounts = new Map<string, number>();
  for (const w of compactWays) classCounts.set(w.cls, (classCounts.get(w.cls) ?? 0) + 1);
  console.log(`\nWrote data/streets.json: ${compactWays.length} ways`);
  for (const [cls, count] of [...classCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cls.padEnd(16)} ${count}`);
  }
}

main();
