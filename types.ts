export enum PresetType {
  CLEAN = 'Clean Signal',
  AM_RADIO = 'AM Radio (1970s)',
  WALKIE_TALKIE = 'Walkie Talkie',
  BLOWN_SPEAKER = 'Blown Speaker',
  UNDERWATER = 'Shortwave Fade',
  PHONE = 'Old Telephone',
  CHEAP_SPEAKER = 'Cheap Speaker',
  OLD_RINGTONE = 'Old Ringtone (Polyphonic)'
}

export enum SpatialEffect {
  NONE = 'Direct',
  NEXT_ROOM = 'Next Room',
  AUDITORIUM = 'Auditorium',
  PA_SYSTEM = 'PA System'
}

export interface AudioState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isProcessing: boolean;
  fileName: string | null;
  isRecording: boolean;
}

export interface PresetConfig {
  id: PresetType;
  label: string;
  description: string;
  // Audio parameters
  lowPassFreq: number;
  highPassFreq: number;
  distortion: number; // 0 to 100+
  noiseLevel: number; // 0 to 1
  wobbleAmount: number; // 0 to 1
  quantizeAmount: number; // 0 to 50 (Higher = more low-fi digital artifacting)
}