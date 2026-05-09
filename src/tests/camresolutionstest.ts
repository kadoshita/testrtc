import { addTest } from './registry.js';
import { testSuiteName } from './testsuitename.js';
import { testCaseName } from './testcasename.js';
import { Call } from '../core/call.js';
import { VideoFrameChecker } from '../core/videoframechecker.js';
import { arrayAverage, arrayMin, arrayMax } from '../core/util.js';
import { report } from '../core/report.js';
import type { TestInterface, StatsObject } from '../types/index.js';

addTest(testSuiteName.CAMERA, testCaseName.CHECKRESOLUTION240, (test) => {
  new CamResolutionsTest(test, [[320, 240]]).run();
});

addTest(testSuiteName.CAMERA, testCaseName.CHECKRESOLUTION480, (test) => {
  new CamResolutionsTest(test, [[640, 480]]).run();
});

addTest(testSuiteName.CAMERA, testCaseName.CHECKRESOLUTION720, (test) => {
  new CamResolutionsTest(test, [[1280, 720]]).run();
});

addTest(testSuiteName.CAMERA, testCaseName.CHECKSUPPORTEDRESOLUTIONS, (test) => {
  const resolutionArray: [number, number][] = [
    [160, 120], [320, 180], [320, 240], [640, 360], [640, 480], [768, 576],
    [1024, 576], [1280, 720], [1280, 768], [1280, 800], [1920, 1080],
    [1920, 1200], [3840, 2160], [4096, 2160],
  ];
  new CamResolutionsTest(test, resolutionArray).run();
});

interface StatsReport {
  cameraName: string | number;
  actualVideoWidth: number;
  actualVideoHeight: number;
  mandatoryWidth: number;
  mandatoryHeight: number;
  encodeSetupTimeMs: string | number;
  avgEncodeTimeMs: number;
  minEncodeTimeMs: number;
  maxEncodeTimeMs: number;
  avgInputFps: number;
  minInputFps: number;
  maxInputFps: number;
  avgSentFps: number;
  minSentFps: number;
  maxSentFps: number;
  isMuted: boolean;
  testedFrames: number;
  blackFrames: number;
  frozenFrames: number;
}

class CamResolutionsTest {
  private test: TestInterface;
  private resolutions: [number, number][];
  private currentResolution = 0;
  private isMuted = false;
  private isShuttingDown = false;

  constructor(test: TestInterface, resolutions: [number, number][]) {
    this.test = test;
    this.resolutions = resolutions;
  }

  run(): void {
    this.startGetUserMedia(this.resolutions[this.currentResolution]);
  }

  private startGetUserMedia(resolution: [number, number]): void {
    const constraints: MediaStreamConstraints = {
      audio: false,
      video: { width: { exact: resolution[0] }, height: { exact: resolution[1] } },
    };

    navigator.mediaDevices.getUserMedia(constraints)
      .then((stream) => {
        if (this.resolutions.length > 1) {
          this.test.reportSuccess(`Supported: ${resolution[0]}x${resolution[1]}`);
          stream.getTracks().forEach((t) => t.stop());
          this.maybeContinueGetUserMedia();
        } else {
          this.collectAndAnalyzeStats(stream, resolution);
        }
      })
      .catch((error: unknown) => {
        if (this.resolutions.length > 1) {
          this.test.reportInfo(`${resolution[0]}x${resolution[1]} not supported`);
        } else {
          this.test.reportError('getUserMedia failed with error: ' + String(error));
        }
        this.maybeContinueGetUserMedia();
      });
  }

  private maybeContinueGetUserMedia(): void {
    if (this.currentResolution === this.resolutions.length) {
      this.test.done();
      return;
    }
    this.startGetUserMedia(this.resolutions[this.currentResolution++]);
  }

  private collectAndAnalyzeStats(stream: MediaStream, resolution: [number, number]): void {
    const tracks = stream.getVideoTracks();
    if (tracks.length < 1) {
      this.test.reportError('No video track in returned stream.');
      this.maybeContinueGetUserMedia();
      return;
    }

    const videoTrack = tracks[0];
    videoTrack.addEventListener('ended', () => {
      if (!this.isShuttingDown) this.test.reportError('Video track ended, camera stopped working');
    });
    videoTrack.addEventListener('mute', () => {
      if (!this.isShuttingDown) {
        this.test.reportWarning('Your camera reported itself as muted.');
        this.isMuted = true;
      }
    });
    videoTrack.addEventListener('unmute', () => {
      if (!this.isShuttingDown) {
        this.test.reportInfo('Your camera reported itself as unmuted.');
        this.isMuted = false;
      }
    });

    const video = document.createElement('video');
    video.setAttribute('autoplay', '');
    video.setAttribute('muted', '');
    video.width = resolution[0];
    video.height = resolution[1];
    video.srcObject = stream;

    const frameChecker = new VideoFrameChecker(video);
    const call = new Call(null, this.test);
    stream.getTracks().forEach((t) => call.pc1.addTrack(t, stream));
    call.establishConnection();
    call.gatherStats(
      call.pc1, null, stream,
      (stats, statsTime) => this.onCallEnded(resolution, video, stream, frameChecker, stats, statsTime)
    );

    setTimeoutWithProgressBar(() => this.endCall(call, stream), 8000, this.test);
  }

  private onCallEnded(
    resolution: [number, number],
    videoElement: HTMLVideoElement,
    stream: MediaStream,
    frameChecker: VideoFrameChecker,
    stats: StatsObject[],
    statsTime: number[]
  ): void {
    this.analyzeStats(resolution, videoElement, stream, frameChecker, stats, statsTime);
    frameChecker.stop();
    this.test.done();
  }

  private analyzeStats(
    resolution: [number, number],
    videoElement: HTMLVideoElement,
    stream: MediaStream,
    frameChecker: VideoFrameChecker,
    _stats: StatsObject[],
    _statsTime: number[]
  ): void {
    const frameStats = frameChecker.frameStats;
    const statsReport: StatsReport = {
      cameraName: stream.getVideoTracks()[0]?.label || NaN,
      actualVideoWidth: videoElement.videoWidth,
      actualVideoHeight: videoElement.videoHeight,
      mandatoryWidth: resolution[0],
      mandatoryHeight: resolution[1],
      encodeSetupTimeMs: NaN,
      avgEncodeTimeMs: NaN,
      minEncodeTimeMs: NaN,
      maxEncodeTimeMs: NaN,
      avgInputFps: NaN,
      minInputFps: NaN,
      maxInputFps: NaN,
      avgSentFps: NaN,
      minSentFps: NaN,
      maxSentFps: NaN,
      isMuted: this.isMuted,
      testedFrames: frameStats.numFrames,
      blackFrames: frameStats.numBlackFrames,
      frozenFrames: frameStats.numFrozenFrames,
    };

    report.traceEventInstant('video-stats', statsReport);
    this.testExpectations(statsReport);
  }

  private endCall(callObject: Call, stream: MediaStream): void {
    this.isShuttingDown = true;
    stream.getTracks().forEach((t) => t.stop());
    callObject.close();
  }

  private resolutionMatchesIndependentOfRotationOrCrop(
    aWidth: number, aHeight: number, bWidth: number, bHeight: number
  ): boolean {
    const minRes = Math.min(bWidth, bHeight);
    return (
      (aWidth === bWidth && aHeight === bHeight) ||
      (aWidth === bHeight && aHeight === bWidth) ||
      (aWidth === minRes && bHeight === minRes)
    );
  }

  private testExpectations(info: StatsReport): void {
    const notAvailableStats: string[] = [];
    for (const key of Object.keys(info) as (keyof StatsReport)[]) {
      const val = info[key];
      if (typeof val === 'number' && isNaN(val)) {
        notAvailableStats.push(key);
      } else {
        this.test.reportInfo(`${key}: ${val}`);
      }
    }
    if (notAvailableStats.length !== 0) {
      this.test.reportInfo('Not available: ' + notAvailableStats.join(', '));
    }

    if (isNaN(info.avgSentFps)) {
      this.test.reportInfo('Cannot verify sent FPS.');
    } else if (info.avgSentFps < 5) {
      this.test.reportError('Low average sent FPS: ' + info.avgSentFps);
    } else {
      this.test.reportSuccess('Average FPS above threshold');
    }

    if (!this.resolutionMatchesIndependentOfRotationOrCrop(
      info.actualVideoWidth, info.actualVideoHeight,
      info.mandatoryWidth, info.mandatoryHeight
    )) {
      this.test.reportError('Incorrect captured resolution.');
    } else {
      this.test.reportSuccess('Captured video using expected resolution.');
    }

    if (info.testedFrames === 0) {
      this.test.reportError('Could not analyze any video frame.');
    } else {
      if (info.blackFrames > info.testedFrames / 3) {
        this.test.reportError('Camera delivering lots of black frames.');
      }
      if (info.frozenFrames > info.testedFrames / 3) {
        this.test.reportError('Camera delivering lots of frozen frames.');
      }
    }
  }
}

function setTimeoutWithProgressBar(
  timeoutCallback: () => void,
  timeoutMs: number,
  test: TestInterface
): () => void {
  const start = window.performance.now();
  const updateProgressBar = setInterval(() => {
    test.setProgress((window.performance.now() - start) * 100 / timeoutMs);
  }, 100);
  const timeoutTask = () => {
    clearInterval(updateProgressBar);
    test.setProgress(100);
    timeoutCallback();
  };
  const timer = setTimeout(timeoutTask, timeoutMs);
  return () => {
    clearTimeout(timer);
    timeoutTask();
  };
}

// Silence unused import warnings
void arrayAverage;
void arrayMin;
void arrayMax;
