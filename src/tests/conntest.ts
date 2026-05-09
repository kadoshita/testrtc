import { addTest } from './registry.js';
import { testSuiteName } from './testsuitename.js';
import { testCaseName } from './testcasename.js';
import { Call } from '../core/call.js';
import type { TestInterface, ICECandidateInfo } from '../types/index.js';

// Relay connectivity test
addTest(testSuiteName.CONNECTIVITY, testCaseName.RELAYCONNECTIVITY, (test) => {
  new RunConnectivityTest(test, Call.isRelay).run();
});

// Reflexive connectivity test
addTest(testSuiteName.CONNECTIVITY, testCaseName.REFLEXIVECONNECTIVITY, (test) => {
  new RunConnectivityTest(test, Call.isReflexive).run();
});

// Host connectivity test
addTest(testSuiteName.CONNECTIVITY, testCaseName.HOSTCONNECTIVITY, (test) => {
  new RunConnectivityTest(test, Call.isHost).start(null);
});

class RunConnectivityTest {
  private test: TestInterface;
  private iceCandidateFilter: (c: ICECandidateInfo) => boolean;
  private timeout: ReturnType<typeof setTimeout> | null = null;
  private parsedCandidates: ICECandidateInfo[] = [];
  private call: Call | null = null;

  constructor(test: TestInterface, iceCandidateFilter: (c: ICECandidateInfo) => boolean) {
    this.test = test;
    this.iceCandidateFilter = iceCandidateFilter;
  }

  run(): void {
    Call.asyncCreateTurnConfig(
      this.test.settings,
      this.start.bind(this),
      this.test.reportFatal.bind(this.test)
    );
  }

  start(config: RTCConfiguration | null): void {
    this.call = new Call(config, this.test);
    this.call.setIceCandidateFilter(this.iceCandidateFilter);

    this.call.pc1.addEventListener('icecandidate', (event) => {
      const e = event as RTCPeerConnectionIceEvent;
      if (e.candidate) {
        const parsedCandidate = Call.parseCandidate(e.candidate.candidate);
        this.parsedCandidates.push(parsedCandidate);
        if (this.iceCandidateFilter(parsedCandidate)) {
          this.test.reportInfo(
            `Gathered candidate of Type: ${parsedCandidate.type}` +
            ` Protocol: ${parsedCandidate.protocol}` +
            ` Address: ${parsedCandidate.address}`
          );
        }
      }
    });

    const ch1 = this.call.pc1.createDataChannel('');
    ch1.addEventListener('open', () => ch1.send('hello'));
    ch1.addEventListener('message', (event) => {
      const e = event as MessageEvent;
      if (e.data !== 'world') {
        this.test.reportError('Invalid data transmitted.');
      } else {
        this.test.reportSuccess('Data successfully transmitted between peers.');
      }
      this.hangup();
    });

    this.call.pc2.addEventListener('datachannel', (event) => {
      const ch2 = (event as RTCDataChannelEvent).channel;
      ch2.addEventListener('message', (msgEvent) => {
        const e = msgEvent as MessageEvent;
        if (e.data !== 'hello') {
          this.hangup('Invalid data transmitted.');
        } else {
          ch2.send('world');
        }
      });
    });

    this.call.establishConnection();
    this.timeout = setTimeout(() => this.hangup('Timed out'), 5000);
  }

  private findParsedCandidateOfSpecifiedType(
    candidateTypeMethod: (c: ICECandidateInfo) => boolean
  ): ICECandidateInfo | undefined {
    return this.parsedCandidates.find(candidateTypeMethod);
  }

  private hangup(errorMessage?: string): void {
    if (errorMessage) {
      if (
        errorMessage === 'Timed out' &&
        this.iceCandidateFilter === Call.isReflexive &&
        this.findParsedCandidateOfSpecifiedType(Call.isReflexive)
      ) {
        this.test.reportWarning(
          'Could not connect using reflexive candidates, likely due to the network environment/configuration.'
        );
      } else {
        this.test.reportError(errorMessage);
      }
    }
    if (this.timeout !== null) clearTimeout(this.timeout);
    this.call?.close();
    this.test.done();
  }
}
