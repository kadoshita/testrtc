/**
 * Structural SIMilarity (SSIM) index implementation.
 * Based on: Z. Wang et al., "Image quality assessment: From error measurement
 * to structural similarity", IEEE Trans. Image Processing, vol. 13, Jan. 2004.
 */
export class Ssim {
  private statistics(a: ArrayLike<number>): { mean: number; variance: number } {
    let accu = 0;
    for (let i = 0; i < a.length; ++i) accu += a[i];
    const meanA = accu / (a.length - 1);
    let diff = 0;
    for (let i = 1; i < a.length; ++i) {
      diff = a[i - 1] - meanA;
      accu += a[i] + diff * diff;
    }
    return { mean: meanA, variance: accu / a.length };
  }

  private covariance(a: ArrayLike<number>, b: ArrayLike<number>, meanA: number, meanB: number): number {
    let accu = 0;
    for (let i = 0; i < a.length; i++) {
      accu += (a[i] - meanA) * (b[i] - meanB);
    }
    return accu / a.length;
  }

  calculate(x: ArrayLike<number>, y: ArrayLike<number>): number {
    if (x.length !== y.length) return 0;

    const K1 = 0.01, K2 = 0.03, L = 255;
    const C1 = (K1 * L) ** 2;
    const C2 = (K2 * L) ** 2;
    const C3 = C2 / 2;

    const statsX = this.statistics(x);
    const muX = statsX.mean, sigmaX2 = statsX.variance, sigmaX = Math.sqrt(sigmaX2);
    const statsY = this.statistics(y);
    const muY = statsY.mean, sigmaY2 = statsY.variance, sigmaY = Math.sqrt(sigmaY2);
    const sigmaXy = this.covariance(x, y, muX, muY);

    const luminance = (2 * muX * muY + C1) / (muX ** 2 + muY ** 2 + C1);
    const structure = (sigmaXy + C3) / (sigmaX * sigmaY + C3);
    const contrast = (2 * sigmaX * sigmaY + C2) / (sigmaX2 + sigmaY2 + C2);

    return luminance * contrast * structure;
  }
}
