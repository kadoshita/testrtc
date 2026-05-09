import { addTest } from './registry.js';
import { testSuiteName } from './testsuitename.js';
import { testCaseName } from './testcasename.js';
import { Call } from '../core/call.js';
import type { TestInterface, ICECandidateInfo } from '../types/index.js';

addTest(testSuiteName.NETWORK, testCaseName.UDPENABLED, (test) => {
  new NetworkTest(test, 'udp', null, Call.isRelay).run();
});

addTest(testSuiteName.NETWORK, testCaseName.TCPENABLED, (test) => {
  new NetworkTest(test, 'tcp', null, Call.isRelay).run();
});

addTest(testSuiteName.NETWORK, testCaseName.IPV6ENABLED, (test) => {
  new NetworkTest(test, null, { optional: [{ googIPv6: true }] }, Call.isIpv6).run();
});

class NetworkTest {
  private test: TestInterface;
  private protocol: string | null;
  private params: Record<string, unknown> | null;
  private iceCandidateFilter: (c: ICECandidateInfo) => boolean;

  constructor(
    test: TestInterface,
    protocol: string | null,
    params: Record<string, unknown> | null,
    iceCandidateFilter: (c: ICECandidateInfo) => boolean
  ) {
    this.test = test;
    this.protocol = protocol;
    this.params = params;
    this.iceCandidateFilter = iceCandidateFilter;
  }

  run(): void {
    if (this.iceCandidateFilter === Call.isIpv6) {
      this.gatherCandidates(null, this.params, this.iceCandidateFilter);
    } else {
      Call.asyncCreateTurnConfig(
        this.test.settings,
        this.start.bind(this),
        this.test.reportFatal.bind(this.test)
      );
    }
  }

  private start(config: RTCConfiguration): void {
    this.filterConfig(config, this.protocol!);
    this.gatherCandidates(config, this.params, this.iceCandidateFilter);
  }

  private filterConfig(config: RTCConfiguration, protocol: string): void {
    const transport = 'transport=' + protocol;
    const newIceServers: RTCIceServer[] = [];
    for (const iceServer of config.iceServers ?? []) {
      const urls = Array.isArray(iceServer.urls) ? iceServer.urls : [iceServer.urls];
      const newUrls: string[] = [];
      for (const uri of urls) {
        if (uri.indexOf(transport) !== -1) {
          newUrls.push(uri);
        } else if (uri.indexOf('?transport=') === -1 && uri.startsWith('turn')) {
          newUrls.push(uri + '?' + transport);
        }
      }
      if (newUrls.length !== 0) {
        newIceServers.push({ ...iceServer, urls: newUrls });
      }
    }
    config.iceServers = newIceServers;
  }

  private gatherCandidates(
    config: RTCConfiguration | null,
    _params: Record<string, unknown> | null,
    isGood: (c: ICECandidateInfo) => boolean
  ): void {
    let pc: RTCPeerConnection | null;
    const isIPv6 = this.params !== null &&
      Array.isArray((this.params as { optional: { googIPv6?: boolean }[] }).optional) &&
      (this.params as { optional: { googIPv6?: boolean }[] }).optional[0]?.googIPv6;

    try {
      pc = new RTCPeerConnection(config ?? undefined);
    } catch (error) {
      if (isIPv6) {
        this.test.reportWarning(
          'Failed to create peer connection, IPv6 might not be setup/supported on the network.'
        );
      } else {
        this.test.reportError('Failed to create peer connection: ' + String(error));
      }
      this.test.done();
      return;
    }

    pc.addEventListener('icecandidate', (event) => {
      const e = event as RTCPeerConnectionIceEvent;
      if ((e.currentTarget as RTCPeerConnection).signalingState === 'closed') return;

      if (e.candidate) {
        const parsed = Call.parseCandidate(e.candidate.candidate);
        if (isGood(parsed)) {
          this.test.reportSuccess(
            `Gathered candidate of Type: ${parsed.type} Protocol: ${parsed.protocol} Address: ${parsed.address}`
          );
          pc?.close();
          pc = null;
          this.test.done();
        }
      } else {
        pc?.close();
        pc = null;
        if (isIPv6) {
          this.test.reportWarning(
            'Failed to gather IPv6 candidates, it might not be setup/supported on the network.'
          );
        } else {
          this.test.reportError('Failed to gather specified candidates');
        }
        this.test.done();
      }
    });

    this.createAudioOnlyReceiveOffer(pc);
  }

  private createAudioOnlyReceiveOffer(pc: RTCPeerConnection): void {
    const noop = () => {};
    pc.createOffer({ offerToReceiveAudio: true })
      .then((offer) => pc.setLocalDescription(offer).then(noop, noop))
      .catch(noop);
  }
}
