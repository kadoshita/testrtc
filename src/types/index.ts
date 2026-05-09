// Shared TypeScript type definitions for testrtc

export type TestState = 'unknown' | 'running' | 'success' | 'warning' | 'failure' | 'disabled';
export type SuiteState = 'pending' | 'running' | 'success' | 'warning' | 'failure';

export interface TestInterface {
  name: string;
  reportSuccess(str: string): void;
  reportError(str: string): void;
  reportWarning(str: string): void;
  reportInfo(str: string): void;
  reportFatal(str: string): void;
  setProgress(value: number | null): void;
  done(): void;
  successCount: number;
  warningCount: number;
  errorCount: number;
  settings: AppSettings;
  createLineChart(): LineChartInterface;
  expectEquals(expected: unknown, actual: unknown, failMsg: string, okMsg?: string): void;
}

export interface LineChartInterface {
  addDatapoint(timestamp: number, value: number): void;
}

export interface AppSettings {
  turnURI?: string;
  turnUsername?: string;
  turnCredential?: string;
  stunURI?: string;
  test_filter?: string;
  [key: string]: string | undefined;
}

export interface TraceEvent {
  ts: number;
  name: string;
  id?: number;
  args: unknown;
}

export interface SystemInfo {
  browserName: string;
  browserVersion: string;
  platform: string;
}

export interface ICECandidateInfo {
  type: string;
  protocol: string;
  address: string;
}

export interface StatsObject {
  audio: {
    local: AudioLocalStats;
    remote: AudioRemoteStats;
  };
  video: {
    local: VideoLocalStats;
    remote: VideoRemoteStats;
  };
  connection: ConnectionStats;
}

export interface AudioLocalStats {
  audioLevel: number;
  bytesSent: number;
  clockRate: number;
  codecId: string;
  mimeType: string;
  packetsSent: number;
  payloadType: number;
  timestamp: number;
  trackId: string;
  transportId: string;
}

export interface AudioRemoteStats {
  audioLevel: number;
  bytesReceived: number;
  clockRate: number;
  codecId: string;
  fractionLost: number;
  jitter: number;
  mimeType: string;
  packetsLost: number;
  packetsReceived: number;
  payloadType: number;
  timestamp: number;
  trackId: string;
  transportId: string;
}

export interface VideoLocalStats {
  bytesSent: number;
  clockRate: number;
  codecId: string;
  firCount: number;
  framesEncoded: number;
  frameHeight: number;
  framesSent: number;
  frameWidth: number;
  mimeType: string;
  nackCount: number;
  packetsSent: number;
  payloadType: number;
  pliCount: number;
  qpSum: number;
  timestamp: number;
  trackId: string;
  transportId: string;
}

export interface VideoRemoteStats {
  bytesReceived: number;
  clockRate: number;
  codecId: string;
  firCount: number;
  fractionLost: number;
  frameHeight: number;
  framesDecoded: number;
  framesDropped: number;
  framesReceived: number;
  frameWidth: number;
  mimeType: string;
  nackCount: number;
  packetsLost: number;
  packetsReceived: number;
  payloadType: number;
  pliCount: number;
  qpSum: number;
  timestamp: number;
  trackId: string;
  transportId: string;
}

export interface ConnectionStats {
  availableOutgoingBitrate: number;
  bytesReceived: number;
  bytesSent: number;
  consentRequestsSent: number;
  currentRoundTripTime: number;
  localCandidateId: string;
  localCandidateType: string;
  localIp: string;
  localPort: number;
  localPriority: number;
  localProtocol: string;
  remoteCandidateId: string;
  remoteCandidateType: string;
  remoteIp: string;
  remotePort: number;
  remotePriority: number;
  remoteProtocol: string;
  requestsReceived: number;
  requestsSent: number;
  responsesReceived: number;
  responsesSent: number;
  timestamp: number;
  totalRoundTripTime: number;
}

export interface GatherStatsResult {
  stats: RTCStatsReport[];
  statsCollectTime: number[];
  stats2: RTCStatsReport[];
  statsCollectTime2: number[];
}
