/**
 * Classical multidimensional scaling: a one-shot 2D layout from a distance
 * matrix, used to initialize SMACOF far from bad local minima.
 *
 * B = -0.5 * J D2 J (double-centered squared distances) is symmetric PSD-ish;
 * its top-2 eigenpairs give coordinates X = [sqrt(l1) v1, sqrt(l2) v2].
 * Eigenpairs come from power iteration with deflation: at n ~ 1000 each
 * iteration is a cheap n^2 multiply and 200 iterations converge plenty.
 */

const POWER_ITERATIONS = 300;

/** Multiply symmetric matrix (flat row-major n*n) by vector. */
function multiplySymmetric(matrix: Float64Array, n: number, vector: Float64Array, out: Float64Array): void {
  for (let i = 0; i < n; i++) {
    let sum = 0;
    const rowOffset = i * n;
    for (let j = 0; j < n; j++) sum += matrix[rowOffset + j] * vector[j];
    out[i] = sum;
  }
}

function normalize(vector: Float64Array): number {
  let norm = 0;
  for (let i = 0; i < vector.length; i++) norm += vector[i] * vector[i];
  norm = Math.sqrt(norm);
  if (norm > 0) for (let i = 0; i < vector.length; i++) vector[i] /= norm;
  return norm;
}

/** Top eigenpair of a symmetric matrix via power iteration, deflating `previous` pairs. */
function topEigenpair(
  matrix: Float64Array,
  n: number,
  previous: { value: number; vector: Float64Array }[],
): { value: number; vector: Float64Array } {
  let vector = new Float64Array(n);
  for (let i = 0; i < n; i++) vector[i] = Math.sin(i * 12.9898 + previous.length * 78.233); // deterministic seed
  let next = new Float64Array(n);
  for (let iter = 0; iter < POWER_ITERATIONS; iter++) {
    multiplySymmetric(matrix, n, vector, next);
    // Deflate: subtract projections onto already-found eigenvectors.
    for (const prev of previous) {
      let dot = 0;
      for (let i = 0; i < n; i++) dot += next[i] * prev.vector[i];
      for (let i = 0; i < n; i++) next[i] -= dot * prev.vector[i];
    }
    normalize(next);
    [vector, next] = [next, vector];
  }
  // Rayleigh quotient for the eigenvalue.
  multiplySymmetric(matrix, n, vector, next);
  let value = 0;
  for (let i = 0; i < n; i++) value += vector[i] * next[i];
  return { value, vector };
}

/** Classical MDS coordinates (n x 2, flat [x0,y0,x1,y1,…]) from distances (flat n*n). */
export function classicalMdsLayout(distances: Float64Array, n: number): Float64Array {
  // Double-centered squared-distance matrix.
  const b = new Float64Array(n * n);
  const rowMeans = new Float64Array(n);
  let grandMean = 0;
  for (let i = 0; i < n; i++) {
    let rowSum = 0;
    for (let j = 0; j < n; j++) {
      const squared = distances[i * n + j] ** 2;
      b[i * n + j] = squared;
      rowSum += squared;
    }
    rowMeans[i] = rowSum / n;
    grandMean += rowSum;
  }
  grandMean /= n * n;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      b[i * n + j] = -0.5 * (b[i * n + j] - rowMeans[i] - rowMeans[j] + grandMean);
    }
  }

  const first = topEigenpair(b, n, []);
  const second = topEigenpair(b, n, [first]);
  const layout = new Float64Array(n * 2);
  const scale1 = Math.sqrt(Math.max(first.value, 0));
  const scale2 = Math.sqrt(Math.max(second.value, 0));
  for (let i = 0; i < n; i++) {
    layout[i * 2] = scale1 * first.vector[i];
    layout[i * 2 + 1] = scale2 * second.vector[i];
  }
  return layout;
}
