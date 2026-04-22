// Create a distortion curve for the WaveShaperNode
export const makeDistortionCurve = (amount: number): Float32Array => {
  const k = typeof amount === 'number' ? amount : 50;
  const n_samples = 44100;
  const curve = new Float32Array(n_samples);
  const deg = Math.PI / 180;
  
  for (let i = 0; i < n_samples; ++i) {
    const x = (i * 2) / n_samples - 1;
    // Sigmoid function for soft clipping to hard clipping
    curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
  }
  return curve;
};

// Create a staircase curve for Bitcrushing (Quantization)
export const makeQuantizationCurve = (amount: number): Float32Array => {
  const n_samples = 44100;
  const curve = new Float32Array(n_samples);
  
  // Amount represents "Step Size". 
  // 0 = smooth, 1 = subtle, 10 = 8-bit, 50 = 2-bit destruction
  const steps = 1 + (100 - amount); 
  
  for (let i = 0; i < n_samples; ++i) {
    const x = (i * 2) / n_samples - 1;
    // Round the signal to the nearest "step" to create digital artifacts
    curve[i] = Math.round(x * steps) / steps;
  }
  return curve;
};

// Create a buffer of white/pink noise
export const createNoiseBuffer = (ctx: BaseAudioContext): AudioBuffer => {
  const bufferSize = 2 * ctx.sampleRate; // 2 seconds of noise loop
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const output = buffer.getChannelData(0);
  
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    // Simple approximations for texture
    output[i] = (white + (Math.random() * 2 - 1)) / 2; 
  }
  return buffer;
};

// Create Impulse Response for Reverb
export const createImpulseResponse = (ctx: BaseAudioContext, duration: number, decay: number, reverse: boolean = false): AudioBuffer => {
    const sampleRate = ctx.sampleRate;
    const length = sampleRate * duration;
    const impulse = ctx.createBuffer(2, length, sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);
  
    for (let i = 0; i < length; i++) {
      const n = reverse ? length - i : i;
      let multiplier = Math.pow(1 - n / length, decay);
      
      // Add some noise texture
      const noise = (Math.random() * 2 - 1);
      left[i] = noise * multiplier;
      right[i] = noise * multiplier;
    }
    return impulse;
};

// Format seconds to MM:SS
export const formatTime = (seconds: number): string => {
  if (!seconds || isNaN(seconds)) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// Convert AudioBuffer to WAV Blob
export const audioBufferToWav = (buffer: AudioBuffer): Blob => {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const bufferArr = new ArrayBuffer(length);
  const view = new DataView(bufferArr);
  const channels = [];
  let i;
  let sample;
  let offset = 0;
  let pos = 0;

  // write WAVE header
  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8); // file length - 8
  setUint32(0x45564157); // "WAVE"

  setUint32(0x20746d66); // "fmt " chunk
  setUint32(16); // length = 16
  setUint16(1); // PCM (uncompressed)
  setUint16(numOfChan);
  setUint32(buffer.sampleRate);
  setUint32(buffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
  setUint16(numOfChan * 2); // block-align
  setUint16(16); // 16-bit (hardcoded in this encoder)

  setUint32(0x61746164); // "data" - chunk
  setUint32(length - pos - 4); // chunk length

  // write interleaved data
  for (i = 0; i < buffer.numberOfChannels; i++)
    channels.push(buffer.getChannelData(i));

  while (pos < buffer.length) {
    for (i = 0; i < numOfChan; i++) {
      // clamp
      sample = Math.max(-1, Math.min(1, channels[i][pos]));
      // scale to 16-bit signed int
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0; 
      view.setInt16(44 + offset, sample, true);
      offset += 2;
    }
    pos++;
  }

  return new Blob([bufferArr], { type: 'audio/wav' });

  function setUint16(data: number) {
    view.setUint16(pos, data, true);
    pos += 2;
  }

  function setUint32(data: number) {
    view.setUint32(pos, data, true);
    pos += 4;
  }
};