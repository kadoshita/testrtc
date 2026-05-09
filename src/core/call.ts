import { enumerateStats } from './util.js';
import { report } from './report.js';
import type { TestInterface, ICECandidateInfo, AppSettings, StatsObject } from '../types/index.js';

// Vite define injections
declare const API_ENDPOINT: string;

type IceCandidateFilter = (candidate: ICECandidateInfo) => boolean;
type StatsCallback = (
  stats: StatsObject[],
  statsCollectTime: number[],
  stats2: StatsObject[],
  statsCollectTime2: number[]
) => void;

export class Call {
  private test: TestInterface;
  private traceEvent: (args: unknown) => void;
  private iceCandidateFilter: IceCandidateFilter = Call.noFilter;
  private constrainVideoBitrateKbps?: number;
  private constrainOfferToRemoveVideoFec = false;
  private localTrackIds = { audio: '', video: '' };
  private remoteTrackIds = { audio: '', video: '' };

  pc1: RTCPeerConnection;
  pc2: RTCPeerConnection;

  static cachedIceServers: RTCIceServer[] | null = null;
  static cachedIceConfigFetchTime: number | null = null;

  constructor(config: RTCConfiguration | null, test: TestInterface) {
    this.test = test;
    this.traceEvent = report.traceEventAsync('call');
    this.traceEvent({ config });

    this.pc1 = new RTCPeerConnection(config ?? undefined);
    this.pc2 = new RTCPeerConnection(config ?? undefined);

    this.pc1.addEventListener('icecandidate', (e) => this.onIceCandidate(this.pc2, e as RTCPeerConnectionIceEvent));
    this.pc2.addEventListener('icecandidate', (e) => this.onIceCandidate(this.pc1, e as RTCPeerConnectionIceEvent));
  }

  establishConnection(): void {
    this.traceEvent({ state: 'start' });
    this.pc1.createOffer().then(
      this.gotOffer.bind(this),
      this.test.reportFatal.bind(this.test)
    );
  }

  close(): void {
    this.traceEvent({ state: 'end' });
    this.pc1.close();
    this.pc2.close();
  }

  setIceCandidateFilter(filter: IceCandidateFilter): void {
    this.iceCandidateFilter = filter;
  }

  constrainVideoBitrate(maxVideoBitrateKbps: number): void {
    this.constrainVideoBitrateKbps = maxVideoBitrateKbps;
  }

  disableVideoFec(): void {
    this.constrainOfferToRemoveVideoFec = true;
  }

  gatherStats(
    peerConnection: RTCPeerConnection,
    peerConnection2: RTCPeerConnection | null,
    _localStream: MediaStream,
    statsCb: StatsCallback
  ): void {
    const stats: StatsObject[] = [];
    const stats2: StatsObject[] = [];
    const statsCollectTime: number[] = [];
    const statsCollectTime2: number[] = [];
    const statStepMs = 100;

    this.localTrackIds = { audio: '', video: '' };
    this.remoteTrackIds = { audio: '', video: '' };

    peerConnection.getSenders().forEach((sender) => {
      if (sender.track?.kind === 'audio') this.localTrackIds.audio = sender.track.id;
      else if (sender.track?.kind === 'video') this.localTrackIds.video = sender.track.id;
    });

    if (peerConnection2) {
      peerConnection2.getReceivers().forEach((receiver) => {
        if (receiver.track.kind === 'audio') this.remoteTrackIds.audio = receiver.track.id;
        else if (receiver.track.kind === 'video') this.remoteTrackIds.video = receiver.track.id;
      });
    }

    
    getStatsLoop();

    const self = this;
    function getStatsLoop(): void {
      if (peerConnection.signalingState === 'closed') {
        
        statsCb(stats, statsCollectTime, stats2, statsCollectTime2);
        return;
      }
      peerConnection.getStats()
        .then((response) => {
          const enumerated = enumerateStats(response as unknown as Map<string, RTCStats>, self.localTrackIds, self.remoteTrackIds);
          stats.push(enumerated);
          statsCollectTime.push(Date.now());
          setTimeout(getStatsLoop, statStepMs);
        })
        .catch((error: unknown) => {
          self.test.reportError('Could not gather stats: ' + String(error));
          
          statsCb(stats, statsCollectTime, [], []);
        });

      if (peerConnection2) {
        peerConnection2.getStats()
          .then((response) => {
            const enumerated = enumerateStats(response as unknown as Map<string, RTCStats>, self.localTrackIds, self.remoteTrackIds);
            stats2.push(enumerated);
            statsCollectTime2.push(Date.now());
          });
      }
    }
  }

  private gotOffer(offer: RTCSessionDescriptionInit): void {
    if (this.constrainOfferToRemoveVideoFec) {
      offer.sdp = offer.sdp?.replace(/(m=video 1 [^\r]+)(116 117)(\r\n)/g, '$1\r\n') ?? '';
      offer.sdp = offer.sdp.replace(/a=rtpmap:116 red\/90000\r\n/g, '');
      offer.sdp = offer.sdp.replace(/a=rtpmap:117 ulpfec\/90000\r\n/g, '');
      offer.sdp = offer.sdp.replace(/a=rtpmap:98 rtx\/90000\r\n/g, '');
      offer.sdp = offer.sdp.replace(/a=fmtp:98 apt=116\r\n/g, '');
    }
    this.pc1.setLocalDescription(offer);
    this.pc2.setRemoteDescription(offer);
    this.pc2.createAnswer().then(
      this.gotAnswer.bind(this),
      this.test.reportFatal.bind(this.test)
    );
  }

  private gotAnswer(answer: RTCSessionDescriptionInit): void {
    if (this.constrainVideoBitrateKbps) {
      answer.sdp = answer.sdp?.replace(
        /a=mid:video\r\n/g,
        `a=mid:video\r\nb=AS:${this.constrainVideoBitrateKbps}\r\n`
      ) ?? '';
    }
    this.pc2.setLocalDescription(answer);
    this.pc1.setRemoteDescription(answer);
  }

  private onIceCandidate(otherPeer: RTCPeerConnection, event: RTCPeerConnectionIceEvent): void {
    if (event.candidate) {
      const parsed = Call.parseCandidate(event.candidate.candidate);
      if (this.iceCandidateFilter(parsed)) {
        otherPeer.addIceCandidate(event.candidate);
      }
    }
  }

  // Static filter functions
  static noFilter(_candidate: ICECandidateInfo): boolean {
    return true;
  }

  static isRelay(candidate: ICECandidateInfo): boolean {
    return candidate.type === 'relay';
  }

  static isNotHostCandidate(candidate: ICECandidateInfo): boolean {
    return candidate.type !== 'host';
  }

  static isReflexive(candidate: ICECandidateInfo): boolean {
    return candidate.type === 'srflx';
  }

  static isHost(candidate: ICECandidateInfo): boolean {
    return candidate.type === 'host';
  }

  static isIpv6(candidate: ICECandidateInfo): boolean {
    return candidate.address.indexOf(':') !== -1;
  }

  static parseCandidate(text: string): ICECandidateInfo {
    const candidateStr = 'candidate:';
    const pos = text.indexOf(candidateStr) + candidateStr.length;
    const fields = text.substring(pos).split(' ');
    return {
      type: fields[7] ?? '',
      protocol: fields[2] ?? '',
      address: fields[4] ?? '',
    };
  }

  static asyncCreateTurnConfig(
    settings: AppSettings,
    onSuccess: (config: RTCConfiguration) => void,
    onError: (error: string) => void
  ): void {
    if (typeof settings.turnURI === 'string' && settings.turnURI !== '') {
      const iceServer: RTCIceServer = {
        username: settings.turnUsername ?? '',
        credential: settings.turnCredential ?? '',
        urls: settings.turnURI.split(','),
      };
      const config: RTCConfiguration = { iceServers: [iceServer] };
      report.traceEventInstant('turn-config', config);
      setTimeout(() => onSuccess(config), 0);
    } else {
      Call.fetchTurnConfig(
        (data: unknown) => {
          const response = data as { iceServers: RTCIceServer[] };
          const config: RTCConfiguration = { iceServers: response.iceServers };
          report.traceEventInstant('turn-config', config);
          onSuccess(config);
        },
        onError
      );
    }
  }

  static asyncCreateStunConfig(
    settings: AppSettings,
    onSuccess: (config: RTCConfiguration) => void,
    onError: (error: string) => void
  ): void {
    if (typeof settings.stunURI === 'string' && settings.stunURI !== '') {
      const iceServer: RTCIceServer = { urls: settings.stunURI.split(',') };
      const config: RTCConfiguration = { iceServers: [iceServer] };
      report.traceEventInstant('stun-config', config);
      setTimeout(() => onSuccess(config), 0);
    } else {
      Call.fetchTurnConfig(
        (data: unknown) => {
          const response = data as { iceServers: { urls: string[] }[] };
          const config: RTCConfiguration = { iceServers: response.iceServers };
          report.traceEventInstant('stun-config', config);
          onSuccess(config);
        },
        onError
      );
    }
  }

  private static fetchTurnConfig(
    onSuccess: (config: unknown) => void,
    onError: (error: string) => void
  ): void {
    fetch(API_ENDPOINT)
      .then((res) => res.json())
      .then((data: unknown) => onSuccess(data))
      .catch((e: unknown) => onError(e instanceof Error ? e.message : String(e)));
  }
}
