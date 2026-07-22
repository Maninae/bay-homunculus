/**
 * SMACOF stress majorization: iteratively move points so pairwise layout
 * distances match target travel times.
 *
 * Uniform weights, so the Guttman transform reduces to
 *   X+_i = (1/n) * sum_j (delta_ij / d_ij(X)) * (X_i - X_j)
 * Each iteration monotonically decreases raw stress; we stop on max
 * iterations or when relative stress improvement stalls.
 */

const RELATIVE_IMPROVEMENT_FLOOR = 1e-7;

export interface SmacofResult {
  layout: Float64Array;
  stress1: number;
  perPointStress: Float64Array;
  iterationsRun: number;
}

/** Kruskal stress-1: sqrt( sum (d - delta)^2 / sum delta^2 ) over i<j pairs. */
export function kruskalStress1(layout: Float64Array, distances: Float64Array, n: number): number {
  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = layout[i * 2] - layout[j * 2];
      const dy = layout[i * 2 + 1] - layout[j * 2 + 1];
      const layoutDist = Math.hypot(dx, dy);
      const target = distances[i * n + j];
      numerator += (layoutDist - target) ** 2;
      denominator += target ** 2;
    }
  }
  return Math.sqrt(numerator / denominator);
}

/** Per-point stress-1 (same formula restricted to one row): where the map had to bend. */
export function perPointStress1(layout: Float64Array, distances: Float64Array, n: number): Float64Array {
  const stress = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let numerator = 0;
    let denominator = 0;
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const dx = layout[i * 2] - layout[j * 2];
      const dy = layout[i * 2 + 1] - layout[j * 2 + 1];
      const layoutDist = Math.hypot(dx, dy);
      const target = distances[i * n + j];
      numerator += (layoutDist - target) ** 2;
      denominator += target ** 2;
    }
    stress[i] = Math.sqrt(numerator / denominator);
  }
  return stress;
}

export function smacofRefine(
  initialLayout: Float64Array,
  distances: Float64Array,
  n: number,
  maxIterations: number,
): SmacofResult {
  let layout = Float64Array.from(initialLayout);
  let next = new Float64Array(n * 2);
  let previousStress = kruskalStress1(layout, distances, n);
  let iterationsRun = 0;

  for (let iter = 0; iter < maxIterations; iter++) {
    iterationsRun = iter + 1;
    for (let i = 0; i < n; i++) {
      let accX = 0;
      let accY = 0;
      const xi = layout[i * 2];
      const yi = layout[i * 2 + 1];
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        const dx = xi - layout[j * 2];
        const dy = yi - layout[j * 2 + 1];
        const layoutDist = Math.hypot(dx, dy);
        if (layoutDist === 0) continue; // coincident points contribute nothing this round
        const ratio = distances[i * n + j] / layoutDist;
        accX += ratio * dx;
        accY += ratio * dy;
      }
      next[i * 2] = accX / n;
      next[i * 2 + 1] = accY / n;
    }
    [layout, next] = [next, layout];

    if ((iter + 1) % 25 === 0 || iter === maxIterations - 1) {
      const stress = kruskalStress1(layout, distances, n);
      const relativeImprovement = (previousStress - stress) / previousStress;
      previousStress = stress;
      if (relativeImprovement >= 0 && relativeImprovement < RELATIVE_IMPROVEMENT_FLOOR) break;
    }
  }

  return {
    layout,
    stress1: kruskalStress1(layout, distances, n),
    perPointStress: perPointStress1(layout, distances, n),
    iterationsRun,
  };
}
