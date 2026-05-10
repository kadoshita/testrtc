class TestrtcAudioLevelProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) {
      return true;
    }

    const channels = input.map((channel) => {
      const copy = new Float32Array(channel.length);
      copy.set(channel);
      return copy;
    });

    this.port.postMessage({ channels, sampleRate });
    return true;
  }
}

registerProcessor('testrtc-audio-level-processor', TestrtcAudioLevelProcessor);
