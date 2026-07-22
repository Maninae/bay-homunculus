/**
 * Binary-heap Dijkstra over CSR adjacency with per-edge weights.
 *
 * - Lazy-deletion heap (duplicates pushed, stale entries skipped on pop):
 *   simpler than decrease-key and fast enough at this graph size.
 * - Optional early exit once a given target set is fully settled, which is
 *   the common case here (we only need anchor-to-anchor times).
 * - Optional parent tracking for route extraction (sample trips).
 */

export interface WeightedCsr {
  offsets: Int32Array;
  targets: Int32Array;
  /** Travel seconds per CSR slot (parallel to `targets`). */
  weightsSeconds: Float64Array;
}

/** Build CSR with weights from parallel edge arrays. */
export function buildWeightedCsr(
  nodeCount: number,
  edgeFrom: Int32Array,
  edgeTo: Int32Array,
  edgeWeightSeconds: Float64Array,
): WeightedCsr {
  const offsets = new Int32Array(nodeCount + 1);
  for (let e = 0; e < edgeFrom.length; e++) offsets[edgeFrom[e] + 1]++;
  for (let i = 0; i < nodeCount; i++) offsets[i + 1] += offsets[i];
  const targets = new Int32Array(edgeFrom.length);
  const weightsSeconds = new Float64Array(edgeFrom.length);
  const cursor = offsets.slice(0, nodeCount);
  for (let e = 0; e < edgeFrom.length; e++) {
    const slot = cursor[edgeFrom[e]]++;
    targets[slot] = edgeTo[e];
    weightsSeconds[slot] = edgeWeightSeconds[e];
  }
  return { offsets, targets, weightsSeconds };
}

export interface DijkstraOptions {
  /** Stop once every node in this set has been settled. */
  earlyExitTargets?: Int32Array;
  /** Filled with the predecessor of each settled node (-1 for source/unreached). */
  parents?: Int32Array;
}

/** Shortest travel time in seconds from `source` to all nodes (Infinity if unreached). */
export function dijkstraSeconds(
  csr: WeightedCsr,
  nodeCount: number,
  source: number,
  options: DijkstraOptions = {},
): Float64Array {
  const dist = new Float64Array(nodeCount).fill(Infinity);
  const settled = new Uint8Array(nodeCount);
  const parents = options.parents;
  if (parents) parents.fill(-1);

  let remainingTargets = 0;
  const isTarget = options.earlyExitTargets ? new Uint8Array(nodeCount) : null;
  if (isTarget && options.earlyExitTargets) {
    for (const t of options.earlyExitTargets) {
      if (!isTarget[t]) { isTarget[t] = 1; remainingTargets++; }
    }
  }

  // Lazy binary heap on parallel arrays.
  let heapSize = 0;
  let heapNodes = new Int32Array(1024);
  let heapDists = new Float64Array(1024);
  const push = (node: number, d: number) => {
    if (heapSize === heapNodes.length) {
      const grownNodes = new Int32Array(heapSize * 2); grownNodes.set(heapNodes); heapNodes = grownNodes;
      const grownDists = new Float64Array(heapSize * 2); grownDists.set(heapDists); heapDists = grownDists;
    }
    let i = heapSize++;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (heapDists[parent] <= d) break;
      heapNodes[i] = heapNodes[parent]; heapDists[i] = heapDists[parent];
      i = parent;
    }
    heapNodes[i] = node; heapDists[i] = d;
  };
  const pop = (): number => {
    const topNode = heapNodes[0];
    const lastNode = heapNodes[--heapSize];
    const lastDist = heapDists[heapSize];
    let i = 0;
    for (;;) {
      const left = 2 * i + 1;
      if (left >= heapSize) break;
      const right = left + 1;
      const smaller = right < heapSize && heapDists[right] < heapDists[left] ? right : left;
      if (heapDists[smaller] >= lastDist) break;
      heapNodes[i] = heapNodes[smaller]; heapDists[i] = heapDists[smaller];
      i = smaller;
    }
    heapNodes[i] = lastNode; heapDists[i] = lastDist;
    return topNode;
  };

  dist[source] = 0;
  push(source, 0);
  while (heapSize > 0) {
    const node = pop();
    if (settled[node]) continue;
    settled[node] = 1;
    if (isTarget && isTarget[node] && --remainingTargets === 0) break;
    const nodeDist = dist[node];
    for (let c = csr.offsets[node]; c < csr.offsets[node + 1]; c++) {
      const next = csr.targets[c];
      const candidate = nodeDist + csr.weightsSeconds[c];
      if (candidate < dist[next]) {
        dist[next] = candidate;
        if (parents) parents[next] = node;
        push(next, candidate);
      }
    }
  }
  return dist;
}
