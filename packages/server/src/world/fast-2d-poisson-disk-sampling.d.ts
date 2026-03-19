declare module "fast-2d-poisson-disk-sampling" {
  interface PoissonDiskOptions {
    shape: [number, number];
    radius?: number;
    minDistance?: number;
    maxDistance?: number;
    tries?: number;
  }

  class FastPoissonDiskSampling {
    constructor(options: PoissonDiskOptions, rng?: () => number);
    fill(): [number, number][];
    next(): [number, number] | null;
    addRandomPoint(): [number, number];
    addPoint(point: [number, number]): [number, number] | null;
    getAllPoints(): [number, number][];
    reset(): void;
  }

  export default FastPoissonDiskSampling;
}
