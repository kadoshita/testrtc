// Utility functions for array statistics and WebRTC stats enumeration
import type { StatsObject } from '../types/index.js';

export function arrayAverage(array: number[]): number {
  const cnt = array.length;
  let tot = 0;
  for (let i = 0; i < cnt; i++) {
    tot += array[i];
  }
  return Math.floor(tot / cnt);
}

export function arrayMax(array: number[]): number {
  if (array.length === 0) return NaN;
  return Math.max(...array);
}

export function arrayMin(array: number[]): number {
  if (array.length === 0) return NaN;
  return Math.min(...array);
}

export function enumerateStats(
  stats: Map<string, RTCStats>,
  localTrackIds: { audio: string; video: string },
  remoteTrackIds: { audio: string; video: string }
): StatsObject {
  const statsObject: StatsObject = {
    audio: {
      local: {
        audioLevel: 0.0, bytesSent: 0, clockRate: 0, codecId: '', mimeType: '',
        packetsSent: 0, payloadType: 0, timestamp: 0.0, trackId: '', transportId: '',
      },
      remote: {
        audioLevel: 0.0, bytesReceived: 0, clockRate: 0, codecId: '', fractionLost: 0,
        jitter: 0, mimeType: '', packetsLost: -1, packetsReceived: 0, payloadType: 0,
        timestamp: 0.0, trackId: '', transportId: '',
      },
    },
    video: {
      local: {
        bytesSent: 0, clockRate: 0, codecId: '', firCount: 0, framesEncoded: 0,
        frameHeight: 0, framesSent: -1, frameWidth: 0, mimeType: '', nackCount: 0, packetsSent: -1,
        payloadType: 0, pliCount: 0, qpSum: 0, timestamp: 0.0, trackId: '', transportId: '',
      },
      remote: {
        bytesReceived: -1, clockRate: 0, codecId: '', firCount: -1, fractionLost: 0,
        frameHeight: 0, framesDecoded: 0, framesDropped: 0, framesReceived: 0,
        frameWidth: 0, mimeType: '', nackCount: -1, packetsLost: -1, packetsReceived: 0, payloadType: 0,
        pliCount: -1, qpSum: 0, timestamp: 0.0, trackId: '', transportId: '',
      },
    },
    connection: {
      availableOutgoingBitrate: 0, bytesReceived: 0, bytesSent: 0,
      consentRequestsSent: 0, currentRoundTripTime: 0.0, localCandidateId: '',
      localCandidateType: '', localIp: '', localPort: 0, localPriority: 0,
      localProtocol: '', remoteCandidateId: '', remoteCandidateType: '', remoteIp: '',
      remotePort: 0, remotePriority: 0, remoteProtocol: '', requestsReceived: 0,
      requestsSent: 0, responsesReceived: 0, responsesSent: 0, timestamp: 0.0,
      totalRoundTripTime: 0.0,
    },
  };

  if (!stats) return statsObject;

  // First pass: outbound-rtp, inbound-rtp, candidate-pair
  stats.forEach((report: RTCStats) => {
    const r = report as unknown as Record<string, unknown>;
    switch (report.type) {
      case 'outbound-rtp':
        if (typeof r['trackId'] === 'string') {
          if ((r['trackId'] as string).indexOf(localTrackIds.audio) !== 1 && localTrackIds.audio !== '') {
            statsObject.audio.local.bytesSent = (r['bytesSent'] as number) || 0;
            statsObject.audio.local.codecId = (r['codecId'] as string) || '';
            statsObject.audio.local.packetsSent = (r['packetsSent'] as number) || 0;
            statsObject.audio.local.timestamp = report.timestamp;
            statsObject.audio.local.trackId = (r['trackId'] as string) || '';
            statsObject.audio.local.transportId = (r['transportId'] as string) || '';
          } else if ((r['trackId'] as string).indexOf(localTrackIds.video) !== 1 && localTrackIds.video !== '') {
            statsObject.video.local.bytesSent = (r['bytesSent'] as number) || 0;
            statsObject.video.local.codecId = (r['codecId'] as string) || '';
            statsObject.video.local.firCount = (r['firCount'] as number) || 0;
            statsObject.video.local.framesEncoded = (r['framesEncoded'] as number) || 0;
            statsObject.video.local.framesSent = (r['framesSent'] as number) || 0;
            statsObject.video.local.packetsSent = (r['packetsSent'] as number) || 0;
            statsObject.video.local.pliCount = (r['pliCount'] as number) || 0;
            statsObject.video.local.qpSum = (r['qpSum'] as number) || 0;
            statsObject.video.local.timestamp = report.timestamp;
            statsObject.video.local.trackId = (r['trackId'] as string) || '';
            statsObject.video.local.transportId = (r['transportId'] as string) || '';
          }
        }
        break;
      case 'inbound-rtp':
        if (typeof r['trackId'] === 'string') {
          if ((r['trackId'] as string).indexOf(remoteTrackIds.audio) !== 1 && remoteTrackIds.audio !== '') {
            statsObject.audio.remote.bytesReceived = (r['bytesReceived'] as number) || 0;
            statsObject.audio.remote.codecId = (r['codecId'] as string) || '';
            statsObject.audio.remote.fractionLost = (r['fractionLost'] as number) || 0;
            statsObject.audio.remote.jitter = (r['jitter'] as number) || 0;
            statsObject.audio.remote.packetsLost = (r['packetsLost'] as number) || 0;
            statsObject.audio.remote.packetsReceived = (r['packetsReceived'] as number) || 0;
            statsObject.audio.remote.timestamp = report.timestamp;
            statsObject.audio.remote.trackId = (r['trackId'] as string) || '';
            statsObject.audio.remote.transportId = (r['transportId'] as string) || '';
          }
          if ((r['trackId'] as string).indexOf(remoteTrackIds.video) !== 1 && remoteTrackIds.video !== '') {
            statsObject.video.remote.bytesReceived = (r['bytesReceived'] as number) || 0;
            statsObject.video.remote.codecId = (r['codecId'] as string) || '';
            statsObject.video.remote.firCount = (r['firCount'] as number) || 0;
            statsObject.video.remote.fractionLost = (r['fractionLost'] as number) || 0;
            statsObject.video.remote.nackCount = (r['nackCount'] as number) || 0;
            statsObject.video.remote.packetsLost = (r['packetsLost'] as number) || 0;
            statsObject.video.remote.packetsReceived = (r['packetsReceived'] as number) || 0;
            statsObject.video.remote.pliCount = (r['pliCount'] as number) || 0;
            statsObject.video.remote.qpSum = (r['qpSum'] as number) || 0;
            statsObject.video.remote.timestamp = report.timestamp;
            statsObject.video.remote.trackId = (r['trackId'] as string) || '';
            statsObject.video.remote.transportId = (r['transportId'] as string) || '';
          }
        }
        break;
      case 'candidate-pair':
        if (typeof r['availableOutgoingBitrate'] !== 'undefined') {
          statsObject.connection.availableOutgoingBitrate = (r['availableOutgoingBitrate'] as number) || 0;
          statsObject.connection.bytesReceived = (r['bytesReceived'] as number) || 0;
          statsObject.connection.bytesSent = (r['bytesSent'] as number) || 0;
          statsObject.connection.consentRequestsSent = (r['consentRequestsSent'] as number) || 0;
          statsObject.connection.currentRoundTripTime = (r['currentRoundTripTime'] as number) || 0;
          statsObject.connection.localCandidateId = (r['localCandidateId'] as string) || '';
          statsObject.connection.remoteCandidateId = (r['remoteCandidateId'] as string) || '';
          statsObject.connection.requestsReceived = (r['requestsReceived'] as number) || 0;
          statsObject.connection.requestsSent = (r['requestsSent'] as number) || 0;
          statsObject.connection.responsesReceived = (r['responsesReceived'] as number) || 0;
          statsObject.connection.responsesSent = (r['responsesSent'] as number) || 0;
          statsObject.connection.timestamp = report.timestamp;
          statsObject.connection.totalRoundTripTime = (r['totalRoundTripTime'] as number) || 0;
        }
        break;
    }
  });

  // Second pass: track, codec, local-candidate, remote-candidate
  stats.forEach((report: RTCStats) => {
    const r = report as unknown as Record<string, unknown>;
    switch (report.type) {
      case 'track' as RTCStatsType:
        if (typeof r['trackIdentifier'] === 'string') {
          const tid = r['trackIdentifier'] as string;
          if (tid.indexOf(localTrackIds.video) !== 1 && localTrackIds.video !== '') {
            statsObject.video.local.frameHeight = (r['frameHeight'] as number) || 0;
            statsObject.video.local.framesSent = (r['framesSent'] as number) || 0;
            statsObject.video.local.frameWidth = (r['frameWidth'] as number) || 0;
          }
          if (tid.indexOf(remoteTrackIds.video) !== 1 && remoteTrackIds.video !== '') {
            statsObject.video.remote.frameHeight = (r['frameHeight'] as number) || 0;
            statsObject.video.remote.framesDecoded = (r['framesDecoded'] as number) || 0;
            statsObject.video.remote.framesDropped = (r['framesDropped'] as number) || 0;
            statsObject.video.remote.framesReceived = (r['framesReceived'] as number) || 0;
            statsObject.video.remote.frameWidth = (r['frameWidth'] as number) || 0;
          }
          if (tid.indexOf(localTrackIds.audio) !== 1 && localTrackIds.audio !== '') {
            statsObject.audio.local.audioLevel = (r['audioLevel'] as number) || 0;
          }
          if (tid.indexOf(remoteTrackIds.audio) !== 1 && remoteTrackIds.audio !== '') {
            statsObject.audio.remote.audioLevel = (r['audioLevel'] as number) || 0;
          }
        }
        break;
      case 'codec': {
        const id = (r['id'] as string) || '';
        if (id.indexOf(statsObject.audio.local.codecId) !== 1 && localTrackIds.audio !== '') {
          statsObject.audio.local.clockRate = (r['clockRate'] as number) || 0;
          statsObject.audio.local.mimeType = (r['mimeType'] as string) || '';
          statsObject.audio.local.payloadType = (r['payloadType'] as number) || 0;
        }
        if (id.indexOf(statsObject.audio.remote.codecId) !== 1 && remoteTrackIds.audio !== '') {
          statsObject.audio.remote.clockRate = (r['clockRate'] as number) || 0;
          statsObject.audio.remote.mimeType = (r['mimeType'] as string) || '';
          statsObject.audio.remote.payloadType = (r['payloadType'] as number) || 0;
        }
        if (id.indexOf(statsObject.video.local.codecId) !== 1 && localTrackIds.video !== '') {
          statsObject.video.local.clockRate = (r['clockRate'] as number) || 0;
          statsObject.video.local.mimeType = (r['mimeType'] as string) || '';
          statsObject.video.local.payloadType = (r['payloadType'] as number) || 0;
        }
        if (id.indexOf(statsObject.video.remote.codecId) !== 1 && remoteTrackIds.video !== '') {
          statsObject.video.remote.clockRate = (r['clockRate'] as number) || 0;
          statsObject.video.remote.mimeType = (r['mimeType'] as string) || '';
          statsObject.video.remote.payloadType = (r['payloadType'] as number) || 0;
        }
        break;
      }
      case 'local-candidate': {
        const id = (r['id'] as string) || '';
        if (id.indexOf(statsObject.connection.localCandidateId) !== -1) {
          statsObject.connection.localIp = (r['ip'] as string) || '';
          statsObject.connection.localPort = (r['port'] as number) || 0;
          statsObject.connection.localPriority = (r['priority'] as number) || 0;
          statsObject.connection.localProtocol = (r['protocol'] as string) || '';
          statsObject.connection.localCandidateType = (r['candidateType'] as string) || '';
        }
        break;
      }
      case 'remote-candidate': {
        const id = (r['id'] as string) || '';
        if (id.indexOf(statsObject.connection.remoteCandidateId) !== -1) {
          statsObject.connection.remoteIp = (r['ip'] as string) || '';
          statsObject.connection.remotePort = (r['port'] as number) || 0;
          statsObject.connection.remotePriority = (r['priority'] as number) || 0;
          statsObject.connection.remoteProtocol = (r['protocol'] as string) || '';
          statsObject.connection.remoteCandidateType = (r['candidateType'] as string) || '';
        }
        break;
      }
    }
  });

  return statsObject;
}
