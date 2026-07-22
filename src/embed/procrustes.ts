/**
 * Orthogonal Procrustes with uniform scale: rotate (and possibly mirror) the
 * settled SMACOF layout onto geographic coordinates so north stays up.
 *
 * MDS layouts emerge at an arbitrary angle and chirality. The closed-form 2D
 * best rotation is theta = atan2(sum cross, sum dot); we evaluate it for both
 * chirality options and keep whichever leaves less residual. Rotation, mirror,
 * uniform scale, and translation all preserve relative distortion, so the
 * time-space warp survives intact.
 */

export interface ProcrustesTransform {
  apply: (layout: Float64Array) => Float64Array;
}

/** Fit layout -> target (both flat n x 2) and return the aligned layout. */
export function procrustesAlign(layout: Float64Array, target: Float64Array, n: number): Float64Array {
  const layoutMean = [0, 0];
  const targetMean = [0, 0];
  for (let i = 0; i < n; i++) {
    layoutMean[0] += layout[i * 2] / n;
    layoutMean[1] += layout[i * 2 + 1] / n;
    targetMean[0] += target[i * 2] / n;
    targetMean[1] += target[i * 2 + 1] / n;
  }

  const alignWithChirality = (mirror: boolean): { residual: number; aligned: Float64Array } => {
    // Optionally mirror the layout's x axis before finding the best rotation.
    let sumCross = 0;
    let sumDot = 0;
    let layoutNorm = 0;
    for (let i = 0; i < n; i++) {
      const lx = (mirror ? -1 : 1) * (layout[i * 2] - layoutMean[0]);
      const ly = layout[i * 2 + 1] - layoutMean[1];
      const tx = target[i * 2] - targetMean[0];
      const ty = target[i * 2 + 1] - targetMean[1];
      sumDot += lx * tx + ly * ty;
      sumCross += lx * ty - ly * tx;
      layoutNorm += lx * lx + ly * ly;
    }
    const theta = Math.atan2(sumCross, sumDot);
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    // Uniform scale that minimizes residual given the rotation.
    const scale = (cos * sumDot + sin * sumCross) / layoutNorm;

    const aligned = new Float64Array(n * 2);
    let residual = 0;
    for (let i = 0; i < n; i++) {
      const lx = (mirror ? -1 : 1) * (layout[i * 2] - layoutMean[0]);
      const ly = layout[i * 2 + 1] - layoutMean[1];
      const rx = scale * (cos * lx - sin * ly) + targetMean[0];
      const ry = scale * (sin * lx + cos * ly) + targetMean[1];
      aligned[i * 2] = rx;
      aligned[i * 2 + 1] = ry;
      residual += (rx - target[i * 2]) ** 2 + (ry - target[i * 2 + 1]) ** 2;
    }
    return { residual, aligned };
  };

  const straight = alignWithChirality(false);
  const mirrored = alignWithChirality(true);
  return straight.residual <= mirrored.residual ? straight.aligned : mirrored.aligned;
}
