import { addTest, addExplicitTest } from './registry.js';
import { testSuiteName } from './testsuitename.js';
import { testCaseName } from './testcasename.js';
import { Call } from '../core/call.js';
import { StatisticsAggregate } from '../core/stats.js';
import { arrayAverage, arrayMax, arrayMin } from '../core/util.js';
import { report } from '../core/report.js';
import type { TestInterface, StatsObject } from '../types/index.js';

addTest(testSuiteName.THROUGHPUT, testCaseName.DATATHROUGHPUT, (test) => {
  new DataChannelThroughputTest(test).run();
});

class DataChannelThroughputTest {
  private test: TestInterface;
  private readonly testDurationSeconds = 5.0;
  private startTime: Date | null = null;
  private sentPayloadBytes = 0;
  private receivedPayloadBytes = 0;
  private stopSending = false;
  private readonly samplePacket = 'h'.repeat(1024);
  private readonly maxNumberOfPacketsToSend = 1;
  private readonly bytesToKeepBuffered: number;
  private lastBitrateMeasureTime: Date | null = null;
  private lastReceivedPayloadBytes = 0;
  private call: Call | null = null;
  private senderChannel: RTCDataChannel | null = null;
  private receiveChannel: RTCDataChannel | null = null;

  constructor(test: TestInterface) {
    this.test = test;
    this.bytesToKeepBuffered = 1024 * this.maxNumberOfPacketsToSend;
  }

  run(): void {
    Call.asyncCreateTurnConfig(
      this.test.settings,
      this.start.bind(this),
      this.test.reportFatal.bind(this.test)
    );
  }

  private start(config: RTCConfiguration): void {
    this.call = new Call(config, this.test);
    this.call.setIceCandidateFilter(Call.isRelay);
    this.senderChannel = this.call.pc1.createDataChannel('');
    this.senderChannel.addEventListener('open', this.sendingStep.bind(this));
    this.call.pc2.addEventListener('datachannel', this.onReceiverChannel.bind(this));
    this.call.establishConnection();
  }

  private onReceiverChannel(event: Event): void {
    this.receiveChannel = (event as RTCDataChannelEvent).channel;
    this.receiveChannel.addEventListener('message', this.onMessageReceived.bind(this));
  }

  private sendingStep(): void {
    const now = new Date();
    if (!this.startTime) {
      this.startTime = now;
      this.lastBitrateMeasureTime = now;
    }
    for (let i = 0; i < this.maxNumberOfPacketsToSend; ++i) {
      if (this.senderChannel!.bufferedAmount >= this.bytesToKeepBuffered) break;
      this.sentPayloadBytes += this.samplePacket.length;
      this.senderChannel!.send(this.samplePacket);
    }
    if (now.getTime() - this.startTime.getTime() >= 1000 * this.testDurationSeconds) {
      this.test.setProgress(100);
      this.stopSending = true;
    } else {
      this.test.setProgress(
        (now.getTime() - this.startTime.getTime()) / (10 * this.testDurationSeconds)
      );
      setTimeout(this.sendingStep.bind(this), 1);
    }
  }

  private onMessageReceived(event: Event): void {
    const e = event as MessageEvent;
    this.receivedPayloadBytes += (e.data as string).length;
    const now = new Date();
    if (now.getTime() - this.lastBitrateMeasureTime!.getTime() >= 1000) {
      const bitrate = Math.round(
        (this.receivedPayloadBytes - this.lastReceivedPayloadBytes) /
        (now.getTime() - this.lastBitrateMeasureTime!.getTime()) * 1000 * 8
      ) / 1000;
      this.test.reportSuccess('Transmitting at ' + bitrate + ' kbps.');
      this.lastReceivedPayloadBytes = this.receivedPayloadBytes;
      this.lastBitrateMeasureTime = now;
    }
    if (this.stopSending && this.sentPayloadBytes === this.receivedPayloadBytes) {
      this.call!.close();
      this.call = null;
      const elapsedTime = Math.round((now.getTime() - this.startTime!.getTime()) * 10) / 10000.0;
      const receivedKBits = this.receivedPayloadBytes * 8 / 1000;
      this.test.reportSuccess(
        `Total transmitted: ${receivedKBits} kilo-bits in ${elapsedTime} seconds.`
      );
      this.test.done();
    }
  }
}

addTest(testSuiteName.THROUGHPUT, testCaseName.VIDEOBANDWIDTH, (test) => {
  new VideoBandwidthTest(test).run();
});

class VideoBandwidthTest {
  private test: TestInterface;
  private readonly maxVideoBitrateKbps = 2000;
  private readonly durationMs = 40000;
  private readonly statStepMs = 100;
  private bweStats: StatisticsAggregate;
  private rttStats: StatisticsAggregate;
  private packetsLost = -1;
  private nackCount = -1;
  private pliCount = -1;
  private qpSum = -1;
  private packetsSent = -1;
  private packetsReceived = -1;
  private framesEncoded = -1;
  private framesDecoded = -1;
  private videoStats: (number | string)[] = [];
  private startTime: Date | null = null;
  private call: Call | null = null;
  private localStream: MediaStreamTrack | null = null;
  private readonly constraints = {
    audio: false,
    video: { width: { min: 1280 }, height: { min: 720 } },
  };

  constructor(test: TestInterface) {
    this.test = test;
    this.bweStats = new StatisticsAggregate(0.75 * this.maxVideoBitrateKbps * 1000);
    this.rttStats = new StatisticsAggregate(0);
  }

  run(): void {
    Call.asyncCreateTurnConfig(
      this.test.settings,
      this.start.bind(this),
      this.test.reportFatal.bind(this.test)
    );
  }

  private start(config: RTCConfiguration): void {
    this.call = new Call(config, this.test);
    this.call.setIceCandidateFilter(Call.isRelay);
    this.call.disableVideoFec();
    this.call.constrainVideoBitrate(this.maxVideoBitrateKbps);
    navigator.mediaDevices.getUserMedia(this.constraints)
      .then(this.gotStream.bind(this))
      .catch((err: unknown) => this.test.reportFatal('getUserMedia failed: ' + String(err)));
  }

  private gotStream(stream: MediaStream): void {
    stream.getTracks().forEach((track) => this.call!.pc1.addTrack(track, stream));
    this.call!.establishConnection();
    this.startTime = new Date();
    this.localStream = stream.getVideoTracks()[0];
    setTimeout(this.gatherStats.bind(this), this.statStepMs);
  }

  private gatherStats(): void {
    const now = new Date();
    if (now.getTime() - this.startTime!.getTime() > this.durationMs) {
      this.test.setProgress(100);
      this.hangup();
      return;
    }
    this.test.setProgress((now.getTime() - this.startTime!.getTime()) * 100 / this.durationMs);
    this.call!.gatherStats(
      this.call!.pc1,
      this.call!.pc2,
      new MediaStream([this.localStream!]),
      this.gotStats.bind(this)
    );
    setTimeout(this.gatherStats.bind(this), this.statStepMs);
  }

  private gotStats(
    response: StatsObject[],
    _time: number[],
    response2: StatsObject[],
    _time2: number[]
  ): void {
    for (let i = 0; i < response.length; i++) {
      const conn = response[i]?.connection;
      if (conn && typeof conn.availableOutgoingBitrate !== 'undefined') {
        this.bweStats.add(conn.timestamp, conn.availableOutgoingBitrate);
        this.rttStats.add(conn.timestamp, conn.currentRoundTripTime * 1000);
        this.videoStats[0] = response[i].video.local.frameWidth;
        this.videoStats[1] = response[i].video.local.frameHeight;
        this.nackCount = response[i].video.local.nackCount;
        this.pliCount = response[i].video.local.pliCount;
        this.packetsSent = response[i].video.local.packetsSent;
        this.framesEncoded = response[i].video.local.framesEncoded;
        if (response2[i]) {
          this.packetsLost = response2[i].video.remote.packetsLost;
          this.qpSum = response2[i].video.remote.qpSum;
          this.packetsReceived = response2[i].video.remote.packetsReceived;
          this.framesDecoded = response2[i].video.remote.framesDecoded;
        }
      }
    }
    this.completed();
  }

  private hangup(): void {
    this.call!.pc1.getSenders().forEach((sender) => sender.track?.stop());
    this.call!.close();
    this.call = null;
  }

  private completed(): void {
    if (Number(this.videoStats[0]) < 2 && Number(this.videoStats[1]) < 2) {
      this.test.reportError(
        `Camera failure: ${this.videoStats[0]}x${this.videoStats[1]}. Cannot test bandwidth without a working camera.`
      );
    } else {
      this.test.reportSuccess(`Video resolution: ${this.videoStats[0]}x${this.videoStats[1]}`);
      this.test.reportInfo('Send bandwidth estimate average: ' + Math.round(this.bweStats.getAverage() / 1000) + ' kbps');
      this.test.reportInfo('Send bandwidth estimate max: ' + this.bweStats.getMax() / 1000 + ' kbps');
      this.test.reportInfo('Send bandwidth ramp-up time: ' + this.bweStats.getRampUpTime() + ' ms');
      this.test.reportInfo('Packets sent: ' + this.packetsSent);
      this.test.reportInfo('Packets received: ' + this.packetsReceived);
      this.test.reportInfo('NACK count: ' + this.nackCount);
      this.test.reportInfo('Picture loss indications: ' + this.pliCount);
      this.test.reportInfo('Quality predictor sum: ' + this.qpSum);
      this.test.reportInfo('Frames encoded: ' + this.framesEncoded);
      this.test.reportInfo('Frames decoded: ' + this.framesDecoded);
    }
    this.test.reportInfo('RTT average: ' + this.rttStats.getAverage() + ' ms');
    this.test.reportInfo('RTT max: ' + this.rttStats.getMax() + ' ms');
    this.test.reportInfo('Packets lost: ' + this.packetsLost);
    this.test.done();
  }
}

addExplicitTest(testSuiteName.THROUGHPUT, testCaseName.NETWORKLATENCY, (test) => {
  new WiFiPeriodicScanTest(test, Call.isNotHostCandidate).run();
});

addExplicitTest(testSuiteName.THROUGHPUT, testCaseName.NETWORKLATENCYRELAY, (test) => {
  new WiFiPeriodicScanTest(test, Call.isRelay).run();
});

class WiFiPeriodicScanTest {
  private test: TestInterface;
  private candidateFilter: (c: { type: string; protocol: string; address: string }) => boolean;
  private readonly testDurationMs = 5 * 60 * 1000;
  private readonly sendIntervalMs = 100;
  private delays: number[] = [];
  private recvTimeStamps: number[] = [];
  private running = false;
  private call: Call | null = null;
  private senderChannel: RTCDataChannel | null = null;
  private receiveChannel: RTCDataChannel | null = null;
  private chart: import('../ui/line-chart.js').LineChart | null = null;

  constructor(
    test: TestInterface,
    candidateFilter: (c: { type: string; protocol: string; address: string }) => boolean
  ) {
    this.test = test;
    this.candidateFilter = candidateFilter;
  }

  run(): void {
    Call.asyncCreateTurnConfig(
      this.test.settings,
      this.start.bind(this),
      this.test.reportFatal.bind(this.test)
    );
  }

  private start(config: RTCConfiguration): void {
    this.running = true;
    this.call = new Call(config, this.test);
    this.chart = this.test.createLineChart() as import('../ui/line-chart.js').LineChart;
    this.call.setIceCandidateFilter(this.candidateFilter);
    this.senderChannel = this.call.pc1.createDataChannel('', { ordered: false, maxRetransmits: 0 });
    this.senderChannel.addEventListener('open', this.send.bind(this));
    this.call.pc2.addEventListener('datachannel', this.onReceiverChannel.bind(this));
    this.call.establishConnection();
    setTimeoutWithProgressBar(this.finishTest.bind(this), this.testDurationMs, this.test);
  }

  private onReceiverChannel(event: Event): void {
    this.receiveChannel = (event as RTCDataChannelEvent).channel;
    this.receiveChannel.addEventListener('message', this.receive.bind(this));
  }

  private send(): void {
    if (!this.running) return;
    this.senderChannel!.send(String(Date.now()));
    setTimeout(this.send.bind(this), this.sendIntervalMs);
  }

  private receive(event: Event): void {
    if (!this.running) return;
    const sendTime = parseInt((event as MessageEvent).data as string);
    const delay = Date.now() - sendTime;
    this.recvTimeStamps.push(sendTime);
    this.delays.push(delay);
    this.chart?.addDatapoint(sendTime + delay, delay);
  }

  private finishTest(): void {
    report.traceEventInstant('periodic-delay', {
      delays: this.delays,
      recvTimeStamps: this.recvTimeStamps,
    });
    this.running = false;
    this.call?.close();
    this.call = null;
    if (this.chart?.element?.parentElement) {
      this.chart.element.parentElement.removeChild(this.chart.element);
    }

    const avg = arrayAverage(this.delays);
    const max = arrayMax(this.delays);
    const min = arrayMin(this.delays);
    this.test.reportInfo('Average delay: ' + avg + ' ms.');
    this.test.reportInfo('Min delay: ' + min + ' ms.');
    this.test.reportInfo('Max delay: ' + max + ' ms.');

    if (this.delays.length < 0.8 * this.testDurationMs / this.sendIntervalMs) {
      this.test.reportError(
        'Not enough samples gathered. Keep the page on the foreground while the test is running.'
      );
    } else {
      this.test.reportSuccess('Collected ' + this.delays.length + ' delay samples.');
    }

    if (max > (min + 100) * 2) {
      this.test.reportError(
        'There is a big difference between the min and max delay of packets. Your network appears unstable.'
      );
    }
    this.test.done();
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
