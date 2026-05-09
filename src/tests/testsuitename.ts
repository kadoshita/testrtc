export const testSuiteName = {
  CAMERA: 'Camera',
  MICROPHONE: 'Microphone',
  NETWORK: 'Network',
  CONNECTIVITY: 'Connectivity',
  THROUGHPUT: 'Throughput',
} as const;

export type TestSuiteName = typeof testSuiteName[keyof typeof testSuiteName];
