export class StatisticsAggregate {
  private startTime = 0;
  private sum = 0;
  private count = 0;
  private max = 0;
  private rampUpThreshold: number;
  private rampUpTime = Infinity;

  constructor(rampUpThreshold: number) {
    this.rampUpThreshold = rampUpThreshold;
  }

  add(time: number, datapoint: number): void {
    if (this.startTime === 0) this.startTime = time;
    this.sum += datapoint;
    this.max = Math.max(this.max, datapoint);
    if (this.rampUpTime === Infinity && datapoint > this.rampUpThreshold) {
      this.rampUpTime = time;
    }
    this.count++;
  }

  getAverage(): number {
    if (this.count === 0) return 0;
    return Math.round(this.sum / this.count);
  }

  getMax(): number {
    return this.max;
  }

  getRampUpTime(): number {
    return Math.round(this.rampUpTime - this.startTime);
  }
}
