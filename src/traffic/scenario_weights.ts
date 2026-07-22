/**
 * Per-edge travel seconds for a scenario: the one place edge weights are
 * computed, shared by the matrix stage and the trip-route extraction.
 */

import { fridayEveningMultiplier } from "./modeled_profile.ts";

const MPH_TO_METERS_PER_SECOND = 0.44704;

export interface WeightableGraph {
  edgeLengthM: number[];
  edgeWay: number[];
  ways: { cls: string; mph: number; name?: string; ref?: string }[];
}

export type ScenarioKey = "freeflow" | "friday";

export function computeScenarioWeightsSeconds(graph: WeightableGraph, scenario: ScenarioKey): Float64Array {
  const weights = new Float64Array(graph.edgeLengthM.length);
  for (let e = 0; e < weights.length; e++) {
    const way = graph.ways[graph.edgeWay[e]];
    const multiplier = scenario === "freeflow" ? 1 : fridayEveningMultiplier(way);
    const speedMps = (way.mph * MPH_TO_METERS_PER_SECOND) / multiplier;
    weights[e] = graph.edgeLengthM[e] / speedMps;
  }
  return weights;
}
