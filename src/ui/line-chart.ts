export class LineChart {
  element: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private xData: number[] = [];
  private yData: number[] = [];
  private yScale: [number, number] = [0, 600];
  private yLabels = [0, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500];
  private xStart: number | null = null;
  private xOffset = 0;
  private lastSlowRender: number | null = null;

  constructor() {
    this.element = document.createElement('div');
    this.element.style.cssText = 'width:300px;margin:auto;';
    this.canvas = document.createElement('canvas');
    this.canvas.width = 240;
    this.canvas.height = 150;
    this.element.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
  }

  addDatapoint(timestamp: number, value: number): void {
    const startRender = window.performance.now();

    const index = this.xData.length;
    this.xData.push(timestamp / 100.0 * 2);
    this.yData.push(this.calculateY(value));

    const xCoord = this.xData[index] - (this.xStart ?? 0);
    if (this.xStart === null || xCoord > this.canvas.width) {
      this.setupChart();
      this.xStart = this.xData[index] - this.xOffset;
    } else {
      const oldXCoord = this.xData[index - 1] - this.xStart;
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.fillStyle = this.dotColor(this.yData[index - 1]);
      this.ctx.fillRect(oldXCoord - 1.5, this.yData[index - 1] - 1.5, 3, 3);
      this.ctx.moveTo(oldXCoord, this.yData[index - 1]);
      this.ctx.lineTo(xCoord, this.yData[index]);
      this.ctx.stroke();
      this.ctx.closePath();
      this.ctx.restore();
    }

    this.maybeAlertAboutRenderPerformance(window.performance.now() - startRender);
  }

  private maybeAlertAboutRenderPerformance(renderMs: number): void {
    if (renderMs < 5) return;
    const now = window.performance.now();
    if (this.lastSlowRender === null || now - this.lastSlowRender > 5000) {
      this.lastSlowRender = now;
      console.log(
        'Updating the graph was slow and might affect results. Graph update took ' + renderMs + ' ms'
      );
    }
  }

  private setupChart(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.lineWidth = window.devicePixelRatio;
    this.ctx.strokeStyle = 'lightgray';

    this.ctx.save();
    if (this.ctx.lineWidth % 2) this.ctx.translate(0.5, 0.5);
    this.ctx.textAlign = 'right';
    this.ctx.textBaseline = 'middle';

    this.ctx.beginPath();
    this.xOffset = 0;
    for (const label of this.yLabels) {
      const w = this.ctx.measureText(label + ' ms ').width;
      this.xOffset = Math.max(this.xOffset, w);
    }

    for (let index = 0; index < this.yLabels.length; index++) {
      const y = this.calculateY(this.yLabels[index]);
      this.ctx.moveTo(this.xOffset - 3, y);
      if (index % 2 === 1) {
        this.ctx.lineTo(this.xOffset + 3, y);
      } else {
        this.ctx.lineTo(this.canvas.width, y);
      }
    }

    const topY = this.calculateY(this.yLabels[this.yLabels.length - 1]);
    const bottomY = this.calculateY(0);
    this.ctx.moveTo(this.xOffset, topY);
    this.ctx.lineTo(this.xOffset, bottomY);
    this.ctx.lineTo(this.canvas.width - 1, bottomY);
    this.ctx.lineTo(this.canvas.width - 1, topY);
    this.ctx.stroke();
    this.ctx.closePath();

    for (let index = 0; index < this.yLabels.length; index++) {
      if (index % 2 === 0) {
        const y = this.calculateY(this.yLabels[index]);
        this.ctx.fillText(this.yLabels[index] + ' ms ', this.xOffset, y);
      }
    }

    this.ctx.restore();
  }

  private dotColor(value: number): string {
    return value < 300 ? 'green' : 'red';
  }

  private calculateY(value: number): number {
    if (value > this.yScale[1]) value = this.yScale[1] - 10;
    const y = (value - this.yScale[0]) / (this.yScale[1] - this.yScale[0]);
    return this.canvas.height * (1 - y) - 5;
  }
}
