import { Ssim } from './ssim.js';

export interface FrameStats {
  numFrozenFrames: number;
  numBlackFrames: number;
  numFrames: number;
}

export class VideoFrameChecker {
  frameStats: FrameStats = { numFrozenFrames: 0, numBlackFrames: 0, numFrames: 0 };

  private running = true;
  private readonly nonBlackPixelLumaThreshold = 20;
  private previousFrame: ArrayLike<number> = [];
  private readonly identicalFrameSsimThreshold = 0.985;
  private readonly frameComparator = new Ssim();
  private readonly canvas: HTMLCanvasElement;
  private readonly videoElement: HTMLVideoElement;
  private readonly listener: () => void;

  constructor(videoElement: HTMLVideoElement) {
    this.canvas = document.createElement('canvas');
    this.videoElement = videoElement;
    this.listener = this.checkVideoFrame.bind(this);
    this.videoElement.addEventListener('play', this.listener, false);
  }

  stop(): void {
    this.videoElement.removeEventListener('play', this.listener);
    this.running = false;
  }

  private getCurrentImageData(): ImageData {
    this.canvas.width = this.videoElement.width;
    this.canvas.height = this.videoElement.height;
    const context = this.canvas.getContext('2d', { willReadFrequently: true })!;
    context.drawImage(this.videoElement, 0, 0, this.canvas.width, this.canvas.height);
    return context.getImageData(0, 0, this.canvas.width, this.canvas.height);
  }

  private checkVideoFrame(): void {
    if (!this.running || this.videoElement.ended) return;

    const imageData = this.getCurrentImageData();

    if (this.isBlackFrame(imageData.data, imageData.data.length)) {
      this.frameStats.numBlackFrames++;
    }

    if (this.frameComparator.calculate(this.previousFrame, imageData.data) > this.identicalFrameSsimThreshold) {
      this.frameStats.numFrozenFrames++;
    }
    this.previousFrame = imageData.data;
    this.frameStats.numFrames++;
    setTimeout(this.checkVideoFrame.bind(this), 20);
  }

  private isBlackFrame(data: Uint8ClampedArray, length: number): boolean {
    const thresh = this.nonBlackPixelLumaThreshold;
    let accuLuma = 0;
    for (let i = 4; i < length; i += 4) {
      accuLuma += 0.21 * data[i] + 0.72 * data[i + 1] + 0.07 * data[i + 2];
      if (accuLuma > thresh * i / 4) return false;
    }
    return true;
  }
}
