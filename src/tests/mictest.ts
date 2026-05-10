import { addTest } from './registry.js';
import { testSuiteName } from './testsuitename.js';
import { testCaseName } from './testcasename.js';
import type { TestInterface } from '../types/index.js';

interface AudioWorkletPayload {
  channels: Float32Array[];
  sampleRate: number;
}

addTest(testSuiteName.MICROPHONE, testCaseName.AUDIOCAPTURE, (test) => {
  const micTest = new MicTest(test);
  micTest.run();
});

class MicTest {
  private test: TestInterface;
  private readonly inputChannelCount = 6;
  private readonly outputChannelCount = 2;
  private readonly bufferSize = 0;
  private readonly constraints = { audio: { echoCancellation: false } };
  private readonly collectSeconds = 2.0;
  private readonly silentThreshold = 1.0 / 32767;
  private readonly lowVolumeThreshold = -60;
  private readonly monoDetectThreshold = 1.0 / 65536;
  private readonly clipCountThreshold = 6;
  private readonly clipThreshold = 1.0;

  private collectedAudio: Float32Array[][] = [];
  private collectedSampleCount = 0;
  private audioContext: AudioContext;
  private stream?: MediaStream;
  private audioSource?: MediaStreamAudioSourceNode;
  private workletNode?: AudioWorkletNode;
  private scriptNode?: ScriptProcessorNode;
  private stopCollectingAudio?: () => void;

  constructor(test: TestInterface) {
    this.test = test;
    for (let i = 0; i < this.inputChannelCount; ++i) {
      this.collectedAudio[i] = [];
    }
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.audioContext = new AudioContextClass();
  }

  run(): void {
    this.audioContext.resume()
      .then(() => {
        navigator.mediaDevices.getUserMedia(this.constraints)
          .then(this.gotStream.bind(this))
          .catch((error: unknown) => {
            this.test.reportError('WebAudio run failure: ' + String(error));
            this.test.done();
          });
      })
      .catch((error: unknown) => {
        this.test.reportError('WebAudio run failure: ' + String(error));
        this.test.done();
      });
  }

  private gotStream(stream: MediaStream): void {
    if (!this.checkAudioTracks(stream)) {
      this.test.done();
      return;
    }
    void this.createAudioBuffer(stream);
  }

  private checkAudioTracks(stream: MediaStream): boolean {
    this.stream = stream;
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length < 1) {
      this.test.reportError('No audio track in returned stream.');
      return false;
    }
    this.test.reportSuccess('Audio track created using device=' + audioTracks[0].label);
    return true;
  }

  private async createAudioBuffer(stream: MediaStream): Promise<void> {
    this.audioSource = this.audioContext.createMediaStreamSource(stream);
    if (typeof AudioWorkletNode !== 'undefined' && this.audioContext.audioWorklet) {
      try {
        await this.audioContext.audioWorklet.addModule(
          new URL('./audio-level-processor.js', import.meta.url).toString()
        );
        this.workletNode = new AudioWorkletNode(this.audioContext, 'testrtc-audio-level-processor', {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          outputChannelCount: [this.outputChannelCount],
        });
        this.workletNode.port.onmessage = (event: MessageEvent<AudioWorkletPayload>) => {
          this.collectAudioFromWorklet(event.data);
        };
        this.audioSource.connect(this.workletNode);
        this.workletNode.connect(this.audioContext.destination);
        this.stopCollectingAudio = setTimeoutWithProgressBar(
          this.onStopCollectingAudio.bind(this), 5000, this.test
        );
        return;
      } catch (error: unknown) {
        this.test.reportWarning(
          'AudioWorklet initialization failed. Falling back to ScriptProcessorNode: ' + String(error)
        );
      }
    }
    this.createScriptProcessorBuffer();
  }

  private createScriptProcessorBuffer(): void {
    const source = this.audioSource!;
    this.scriptNode = this.audioContext.createScriptProcessor(
      this.bufferSize, this.inputChannelCount, this.outputChannelCount
    );
    source.connect(this.scriptNode);
    this.scriptNode.connect(this.audioContext.destination);
    this.scriptNode.onaudioprocess = this.collectAudio.bind(this);
    this.stopCollectingAudio = setTimeoutWithProgressBar(
      this.onStopCollectingAudio.bind(this), 5000, this.test
    );
  }

  private collectAudioFromWorklet(payload: AudioWorkletPayload): void {
    const sampleCount = payload.channels[0]?.length ?? 0;
    if (sampleCount === 0) {
      return;
    }
    let allSilent = true;
    for (let c = 0; c < this.inputChannelCount; c++) {
      const data = payload.channels[c] ?? new Float32Array();
      let newBuffer: Float32Array;
      if (data.length > 0) {
        const first = Math.abs(data[0]);
        const last = Math.abs(data[sampleCount - 1]);
        if (first > this.silentThreshold || last > this.silentThreshold) {
          newBuffer = new Float32Array(sampleCount);
          newBuffer.set(data);
          allSilent = false;
        } else {
          newBuffer = new Float32Array();
        }
      } else {
        newBuffer = new Float32Array();
      }
      this.collectedAudio[c].push(newBuffer);
    }
    if (!allSilent) {
      this.collectedSampleCount += sampleCount;
      if (this.collectedSampleCount / payload.sampleRate >= this.collectSeconds) {
        this.stopCollectingAudio?.();
      }
    }
  }

  private collectAudio(event: AudioProcessingEvent): void {
    const sampleCount = event.inputBuffer.length;
    let allSilent = true;
    for (let c = 0; c < event.inputBuffer.numberOfChannels; c++) {
      const data = event.inputBuffer.getChannelData(c);
      const first = Math.abs(data[0]);
      const last = Math.abs(data[sampleCount - 1]);
      let newBuffer: Float32Array;
      if (first > this.silentThreshold || last > this.silentThreshold) {
        newBuffer = new Float32Array(sampleCount);
        newBuffer.set(data);
        allSilent = false;
      } else {
        newBuffer = new Float32Array();
      }
      this.collectedAudio[c].push(newBuffer);
    }
    if (!allSilent) {
      this.collectedSampleCount += sampleCount;
      if (this.collectedSampleCount / event.inputBuffer.sampleRate >= this.collectSeconds) {
        this.stopCollectingAudio?.();
      }
    }
  }

  private onStopCollectingAudio(): void {
    this.stream?.getAudioTracks()[0].stop();
    this.audioSource?.disconnect();
    if (this.scriptNode) {
      this.scriptNode.onaudioprocess = null;
      this.scriptNode.disconnect();
    }
    if (this.workletNode) {
      this.workletNode.port.onmessage = null;
      this.workletNode.disconnect();
    }
    this.analyzeAudio(this.collectedAudio);
    this.test.done();
  }

  private analyzeAudio(channels: Float32Array[][]): void {
    const activeChannels: number[] = [];
    for (let c = 0; c < channels.length; c++) {
      if (this.channelStats(c, channels[c])) {
        activeChannels.push(c);
      }
    }
    if (activeChannels.length === 0) {
      this.test.reportError(
        'No active input channels detected. Microphone is most likely muted or broken, ' +
        'please check if muted in the sound settings or physically on the device. Then rerun the test.'
      );
    } else {
      this.test.reportSuccess('Active audio input channels: ' + activeChannels.length);
    }
    if (activeChannels.length === 2) {
      this.detectMono(channels[activeChannels[0]], channels[activeChannels[1]]);
    }
  }

  private channelStats(channelNumber: number, buffers: Float32Array[]): boolean {
    let maxPeak = 0.0, maxRms = 0.0, clipCount = 0, maxClipCount = 0;
    for (const samples of buffers) {
      if (samples.length > 0) {
        let rms = 0.0;
        for (let i = 0; i < samples.length; i++) {
          const s = Math.abs(samples[i]);
          maxPeak = Math.max(maxPeak, s);
          rms += s * s;
          if (maxPeak >= this.clipThreshold) {
            clipCount++;
            maxClipCount = Math.max(maxClipCount, clipCount);
          } else {
            clipCount = 0;
          }
        }
        rms = Math.sqrt(rms / samples.length);
        maxRms = Math.max(maxRms, rms);
      }
    }
    if (maxPeak > this.silentThreshold) {
      const dBPeak = this.dBFS(maxPeak);
      const dBRms = this.dBFS(maxRms);
      this.test.reportInfo(
        `Channel ${channelNumber} levels: ${dBPeak.toFixed(1)} dB (peak), ${dBRms.toFixed(1)} dB (RMS)`
      );
      if (dBRms < this.lowVolumeThreshold) {
        this.test.reportError(
          'Microphone input level is low, increase input volume or move closer to the microphone.'
        );
      }
      if (maxClipCount > this.clipCountThreshold) {
        this.test.reportWarning(
          'Clipping detected! Microphone input level is high. Decrease input volume or move away from the microphone.'
        );
      }
      return true;
    }
    return false;
  }

  private detectMono(buffersL: Float32Array[], buffersR: Float32Array[]): void {
    let diffSamples = 0;
    for (let j = 0; j < buffersL.length; j++) {
      const l = buffersL[j], r = buffersR[j];
      if (l.length === r.length) {
        for (let i = 0; i < l.length; i++) {
          if (Math.abs(l[i] - r[i]) > this.monoDetectThreshold) diffSamples++;
        }
      } else {
        diffSamples++;
      }
    }
    this.test.reportInfo(diffSamples > 0 ? 'Stereo microphone detected.' : 'Mono microphone detected.');
  }

  private dBFS(gain: number): number {
    return Math.round(20 * Math.log(gain) / Math.log(10) * 10) / 10;
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
