/**
 * Stage 2: build the routing graph from fetched streets.
 *
 * - Junction nodes = way endpoints + nodes shared by 2+ ways. Degree-2 chains
 *   between junctions collapse into single weighted edges (contraction), which
 *   shrinks the graph ~5-10x and makes 1,000+ Dijkstra runs cheap.
 * - Directed edges respect oneway; lengths are haversine sums over the chain.
 * - Only the largest strongly connected component survives (see scc.ts).
 *
 * Input:  data/streets.json
 * Output: data/graph.json
 *   { nodeLat, nodeLon, edgeFrom, edgeTo, edgeLengthM, edgeWay,
 *     ways: [{ cls, mph, bridge, lat, lon, name?, ref? }] }
 *   (way lat/lon = first vertex, for bbox-scoped corridor overrides)
 */

import { readFileSync, writeFileSync } from "node:fs";
import { haversineMeters } from "../src/geo/haversine.ts";
import { stronglyConnectedComponents } from "../src/graph/scc.ts";

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

function main(): void {
  console.log("Loading streets…");
  const { ways } = JSON.parse(readFileSync("data/streets.json", "utf8")) as { ways: CompactWay[] };

  // Junction detection: count how many way-touches each OSM node gets.
  // Endpoints count twice so an isolated way's ends still become junctions.
  const touchCount = new Map<number, number>();
  for (const way of ways) {
    for (let i = 0; i < way.refs.length; i++) {
      const bump = i === 0 || i === way.refs.length - 1 ? 2 : 1;
      touchCount.set(way.refs[i], (touchCount.get(way.refs[i]) ?? 0) + bump);
    }
  }

  // Assign indices to junction nodes only.
  const junctionIndexByOsmId = new Map<number, number>();
  const junctionLat: number[] = [];
  const junctionLon: number[] = [];
  for (const way of ways) {
    for (let i = 0; i < way.refs.length; i++) {
      const osmId = way.refs[i];
      if ((touchCount.get(osmId) ?? 0) >= 2 && !junctionIndexByOsmId.has(osmId)) {
        junctionIndexByOsmId.set(osmId, junctionLat.length);
        junctionLat.push(way.lats[i]);
        junctionLon.push(way.lons[i]);
      }
    }
  }
  console.log(`Junction nodes: ${junctionLat.length} (of ${touchCount.size} OSM nodes)`);

  // Contract each way into junction-to-junction edges.
  const edgeFrom: number[] = [];
  const edgeTo: number[] = [];
  const edgeLengthM: number[] = [];
  const edgeWay: number[] = [];
  const wayTable: {
    cls: string; mph: number; bridge: boolean; lat: number; lon: number; name?: string; ref?: string;
  }[] = [];

  for (const way of ways) {
    const wayIdx = wayTable.length;
    wayTable.push({
      cls: way.cls, mph: way.mph, bridge: way.bridge,
      lat: way.lats[0], lon: way.lons[0],
      name: way.name, ref: way.ref,
    });
    let runStartIdx = 0;
    let runLengthM = 0;
    for (let i = 1; i < way.refs.length; i++) {
      runLengthM += haversineMeters(way.lats[i - 1], way.lons[i - 1], way.lats[i], way.lons[i]);
      if (!junctionIndexByOsmId.has(way.refs[i])) continue;
      const fromNode = junctionIndexByOsmId.get(way.refs[runStartIdx])!;
      const toNode = junctionIndexByOsmId.get(way.refs[i])!;
      // Sub-half-meter chains round to zero length and would traverse in zero time; drop them.
      if (fromNode !== toNode && runLengthM >= 0.5) {
        if (way.oneway >= 0) {
          edgeFrom.push(fromNode); edgeTo.push(toNode);
          edgeLengthM.push(runLengthM); edgeWay.push(wayIdx);
        }
        if (way.oneway <= 0) {
          edgeFrom.push(toNode); edgeTo.push(fromNode);
          edgeLengthM.push(runLengthM); edgeWay.push(wayIdx);
        }
      }
      runStartIdx = i;
      runLengthM = 0;
    }
  }
  console.log(`Contracted directed edges: ${edgeFrom.length}`);

  // Keep only the largest strongly connected component.
  const scc = stronglyConnectedComponents(
    junctionLat.length,
    Int32Array.from(edgeFrom),
    Int32Array.from(edgeTo),
  );
  const keep = scc.componentOfNode.map((c) => (c === scc.largestComponentId ? 1 : 0));
  const keptShare = ((100 * scc.largestComponentSize) / junctionLat.length).toFixed(1);
  console.log(`Largest SCC: ${scc.largestComponentSize} nodes (${keptShare}%)`);

  const newIndexOfNode = new Int32Array(junctionLat.length).fill(-1);
  let nextIndex = 0;
  for (let i = 0; i < junctionLat.length; i++) if (keep[i]) newIndexOfNode[i] = nextIndex++;

  const nodeLat: number[] = [];
  const nodeLon: number[] = [];
  for (let i = 0; i < junctionLat.length; i++) {
    if (keep[i]) { nodeLat.push(junctionLat[i]); nodeLon.push(junctionLon[i]); }
  }
  const finalFrom: number[] = [];
  const finalTo: number[] = [];
  const finalLength: number[] = [];
  const finalWay: number[] = [];
  for (let e = 0; e < edgeFrom.length; e++) {
    if (keep[edgeFrom[e]] && keep[edgeTo[e]]) {
      finalFrom.push(newIndexOfNode[edgeFrom[e]]);
      finalTo.push(newIndexOfNode[edgeTo[e]]);
      finalLength.push(Math.round(edgeLengthM[e]));
      finalWay.push(edgeWay[e]);
    }
  }

  writeFileSync(
    "data/graph.json",
    JSON.stringify({
      nodeLat, nodeLon,
      edgeFrom: finalFrom, edgeTo: finalTo, edgeLengthM: finalLength, edgeWay: finalWay,
      ways: wayTable,
    }),
  );
  console.log(`Wrote data/graph.json: ${nodeLat.length} nodes, ${finalFrom.length} directed edges`);
}

main();
