/**
 * Strongly connected components via iterative Kosaraju on CSR adjacency.
 *
 * Routing must happen inside one SCC: a node outside it can reach (or be
 * reached by) the rest of the network in only one direction, which poisons
 * the travel-time matrix with infinities.
 */

export interface SccResult {
  componentOfNode: Int32Array;
  largestComponentId: number;
  largestComponentSize: number;
}

/** Build CSR (offsets + targets) from an edge list, for `nodeCount` nodes. */
export function buildCsr(
  nodeCount: number,
  edgeFrom: Int32Array,
  edgeTo: Int32Array,
): { offsets: Int32Array; targets: Int32Array } {
  const offsets = new Int32Array(nodeCount + 1);
  for (let e = 0; e < edgeFrom.length; e++) offsets[edgeFrom[e] + 1]++;
  for (let i = 0; i < nodeCount; i++) offsets[i + 1] += offsets[i];
  const targets = new Int32Array(edgeFrom.length);
  const cursor = offsets.slice(0, nodeCount);
  for (let e = 0; e < edgeFrom.length; e++) {
    targets[cursor[edgeFrom[e]]++] = edgeTo[e];
  }
  return { offsets, targets };
}

export function stronglyConnectedComponents(
  nodeCount: number,
  edgeFrom: Int32Array,
  edgeTo: Int32Array,
): SccResult {
  const forward = buildCsr(nodeCount, edgeFrom, edgeTo);
  const reverse = buildCsr(nodeCount, edgeTo, edgeFrom);

  // Pass 1: DFS finishing order on the forward graph (iterative, explicit stack).
  const visited = new Uint8Array(nodeCount);
  const finishOrder = new Int32Array(nodeCount);
  let finishCount = 0;
  const nodeStack = new Int32Array(nodeCount);
  const edgeCursorStack = new Int32Array(nodeCount);
  for (let start = 0; start < nodeCount; start++) {
    if (visited[start]) continue;
    let top = 0;
    nodeStack[0] = start;
    edgeCursorStack[0] = forward.offsets[start];
    visited[start] = 1;
    while (top >= 0) {
      const node = nodeStack[top];
      const cursor = edgeCursorStack[top];
      if (cursor < forward.offsets[node + 1]) {
        edgeCursorStack[top] = cursor + 1;
        const next = forward.targets[cursor];
        if (!visited[next]) {
          visited[next] = 1;
          top++;
          nodeStack[top] = next;
          edgeCursorStack[top] = forward.offsets[next];
        }
      } else {
        finishOrder[finishCount++] = node;
        top--;
      }
    }
  }

  // Pass 2: DFS on the reverse graph in reverse finishing order labels components.
  const componentOfNode = new Int32Array(nodeCount).fill(-1);
  let componentCount = 0;
  let largestComponentId = -1;
  let largestComponentSize = 0;
  for (let i = nodeCount - 1; i >= 0; i--) {
    const start = finishOrder[i];
    if (componentOfNode[start] !== -1) continue;
    const componentId = componentCount++;
    let size = 0;
    let top = 0;
    nodeStack[0] = start;
    componentOfNode[start] = componentId;
    while (top >= 0) {
      const node = nodeStack[top--];
      size++;
      for (let c = reverse.offsets[node]; c < reverse.offsets[node + 1]; c++) {
        const next = reverse.targets[c];
        if (componentOfNode[next] === -1) {
          componentOfNode[next] = componentId;
          nodeStack[++top] = next;
        }
      }
    }
    if (size > largestComponentSize) {
      largestComponentSize = size;
      largestComponentId = componentId;
    }
  }
  return { componentOfNode, largestComponentId, largestComponentSize };
}
