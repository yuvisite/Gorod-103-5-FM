import { PresetConfig, PresetType } from './types';

export const PRESETS: PresetConfig[] = [
  {
    id: PresetType.CLEAN,
    label: "Hi-Fi / Bypass",
    description: "Original clean signal without any processing.",
    lowPassFreq: 22000,
    highPassFreq: 0,
    distortion: 0,
    noiseLevel: 0,
    wobbleAmount: 0,
    quantizeAmount: 0
  },
  {
    id: PresetType.AM_RADIO,
    label: "AM Radio",
    description: "Limited bandwidth with warm static noise.",
    lowPassFreq: 3500,
    highPassFreq: 400,
    distortion: 15,
    noiseLevel: 0.15,
    wobbleAmount: 0.1,
    quantizeAmount: 0
  },
  {
    id: PresetType.PHONE,
    label: "Old Telephone",
    description: "Extremely narrow mid-range frequency focus.",
    lowPassFreq: 2500,
    highPassFreq: 500,
    distortion: 35,
    noiseLevel: 0.1,
    wobbleAmount: 0.05,
    quantizeAmount: 0
  },
  {
    id: PresetType.OLD_RINGTONE,
    label: "Old Ringtone",
    description: "Polyphonic Nokia style. Digital artifacts.",
    lowPassFreq: 3000,
    highPassFreq: 800,
    distortion: 0, 
    noiseLevel: 0.05,
    wobbleAmount: 0,
    quantizeAmount: 85 // High quantization for 8-bit sound
  },
  {
    id: PresetType.CHEAP_SPEAKER,
    label: "Cheap Speaker",
    description: "Tiny plastic speaker: no bass, harsh mids.",
    lowPassFreq: 5000,
    highPassFreq: 350,
    distortion: 60,
    noiseLevel: 0.03,
    wobbleAmount: 0,
    quantizeAmount: 10
  },
  {
    id: PresetType.WALKIE_TALKIE,
    label: "Walkie Talkie",
    description: "Heavy compression, distortion and squelch noise.",
    lowPassFreq: 3000,
    highPassFreq: 600,
    distortion: 120, 
    noiseLevel: 0.35,
    wobbleAmount: 0.02,
    quantizeAmount: 20
  },
  {
    id: PresetType.BLOWN_SPEAKER,
    label: "Blown Speaker",
    description: "Broken membrane sound, buzzing bass.",
    lowPassFreq: 1500,
    highPassFreq: 50,
    distortion: 400, 
    noiseLevel: 0.05,
    wobbleAmount: 0.8, // Heavy vibration
    quantizeAmount: 0
  },
  {
    id: PresetType.UNDERWATER,
    label: "Shortwave Drift",
    description: "Muffled, distant signal drifting in and out.",
    lowPassFreq: 800,
    highPassFreq: 100,
    distortion: 5,
    noiseLevel: 0.4,
    wobbleAmount: 0.6, // Sea sick
    quantizeAmount: 0
  }
];