import { PresetType, PresetConfig, SpatialEffect } from '../types';
import { makeDistortionCurve, makeQuantizationCurve, createNoiseBuffer, createImpulseResponse, audioBufferToWav } from '../utils/audioUtils';

export class AudioEngine {
  private ctx: AudioContext;
  private sourceNode: AudioBufferSourceNode | null = null;
  
  // Secondary Source (Neighboring Station)
  private interferenceBuffer: AudioBuffer | null = null;
  private interferenceNode: AudioBufferSourceNode | null = null;
  private interferenceGain: GainNode;

  // Mix Bus Nodes
  private masterGain: GainNode; // Final volume
  private musicGain: GainNode; // Independent volume for music (for ducking)
  private preEffectsMix: GainNode; // The point where Music, EAS, and Noise merge BEFORE effects

  private analyser: AnalyserNode;
  private audioBuffer: AudioBuffer | null = null;
  
  // EAS Alert Nodes
  private easOsc1: OscillatorNode | null = null;
  private easOsc2: OscillatorNode | null = null;
  private easGain: GainNode;

  // Test Tone (TV Beep)
  private testToneOsc: OscillatorNode | null = null;
  private testToneGain: GainNode;

  // Heterodyne (Whistle)
  private heterodyneOsc: OscillatorNode | null = null;
  private heterodyneGain: GainNode;

  // Tapping Effect
  private tappingInterval: number | null = null;
  private tappingGain: GainNode;

  // Wobble Nodes (Wow/Flutter)
  private wobbleDelay: DelayNode;
  private wobbleLFO: OscillatorNode;
  private wobbleGain: GainNode;

  // AM Signal Degradation Nodes
  private amModulator: GainNode; // Main volume ducking
  private fadeOsc: OscillatorNode; // Periodic LFO
  private fadeGain: GainNode; // Depth of fade

  // Core Effect Nodes
  private lowPassFilter: BiquadFilterNode;
  private highPassFilter: BiquadFilterNode;
  private distortionNode: WaveShaperNode;
  private bitCrusherNode: WaveShaperNode;
  private noiseNode: AudioBufferSourceNode | null = null;
  private noiseGain: GainNode;
  private compressor: DynamicsCompressorNode;

  // Tuning / Filtering for interference simulation
  private tuningLowPass: BiquadFilterNode; 

  // Spatial Nodes
  private spatialInput: GainNode;
  private spatialOutput: GainNode;
  private convolver: ConvolverNode;
  private roomFilter: BiquadFilterNode;
  
  // PA System Specifics
  private paFilter: BiquadFilterNode;
  private paGain: GainNode;
  private delayNode: DelayNode;
  private delayGain: GainNode;
  private delayOutputGain: GainNode;

  // Recording
  private destStream: MediaStreamAudioDestinationNode;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];

  private startTime: number = 0;
  private pauseTime: number = 0;
  private isPlaying: boolean = false;
  
  // State for overrides
  private currentDistortionAmount: number = 0;
  private currentQuantizeAmount: number = 0;
  private snagInterval: number | null = null;
  private snagIntensity: number = 0;
  private isBroadcastCut: boolean = false;
  
  // Mix State
  private manualNoiseLevel: number = 0;
  private crossfadeLevel: number = 0;
  private isEASActive: boolean = false;
  
  // Crash State
  private isCrashed: boolean = false;
  private lastPresetConfig: PresetConfig | null = null;

  constructor() {
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // --- Routing Infrastructure ---
    this.masterGain = this.ctx.createGain();
    this.musicGain = this.ctx.createGain(); 
    this.preEffectsMix = this.ctx.createGain(); 

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.destStream = this.ctx.createMediaStreamDestination();

    // --- Tuning Simulation Node ---
    // Added a specific filter to simulate "losing the signal" quality during crossfade
    this.tuningLowPass = this.ctx.createBiquadFilter();
    this.tuningLowPass.type = 'lowpass';
    this.tuningLowPass.frequency.value = 22000;
    this.tuningLowPass.Q.value = 0.5;

    // --- Secondary Source ---
    this.interferenceGain = this.ctx.createGain();
    this.interferenceGain.gain.value = 0;
    this.interferenceGain.connect(this.preEffectsMix);

    // --- Heterodyne Setup ---
    this.heterodyneGain = this.ctx.createGain();
    this.heterodyneGain.gain.value = 0;
    this.heterodyneGain.connect(this.preEffectsMix);
    
    this.heterodyneOsc = this.ctx.createOscillator();
    this.heterodyneOsc.type = 'sine';
    this.heterodyneOsc.frequency.value = 4000; 
    this.heterodyneOsc.connect(this.heterodyneGain);
    this.heterodyneOsc.start();

    // --- Test Tone Setup ---
    this.testToneGain = this.ctx.createGain();
    this.testToneGain.gain.value = 0;
    this.testToneGain.connect(this.preEffectsMix);

    // --- Tapping Setup ---
    this.tappingGain = this.ctx.createGain();
    this.tappingGain.gain.value = 0.8;
    this.tappingGain.connect(this.preEffectsMix);

    // --- EAS Setup ---
    this.easGain = this.ctx.createGain();
    this.easGain.gain.value = 0.6; 
    this.easGain.connect(this.preEffectsMix); 
    
    // --- Wobble Setup (Tape Mechanism) ---
    this.wobbleDelay = this.ctx.createDelay(1.0);
    this.wobbleDelay.delayTime.value = 0.05;
    
    this.wobbleLFO = this.ctx.createOscillator();
    this.wobbleLFO.type = 'sine';
    this.wobbleLFO.frequency.value = 0.5;
    
    this.wobbleGain = this.ctx.createGain();
    this.wobbleGain.gain.value = 0;
    
    this.wobbleLFO.connect(this.wobbleGain);
    this.wobbleGain.connect(this.wobbleDelay.delayTime);
    this.wobbleLFO.start();

    // --- AM Signal Degradation Setup ---
    this.amModulator = this.ctx.createGain();
    this.amModulator.gain.value = 1.0;

    this.fadeOsc = this.ctx.createOscillator();
    this.fadeOsc.type = 'sine';
    this.fadeOsc.frequency.value = 0.2;
    
    this.fadeGain = this.ctx.createGain();
    this.fadeGain.gain.value = 0;

    this.fadeOsc.connect(this.fadeGain);
    this.fadeGain.connect(this.amModulator.gain);
    this.fadeOsc.start();

    // --- Processing Chain ---
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.setValueAtTime(-24, this.ctx.currentTime);
    this.compressor.knee.setValueAtTime(30, this.ctx.currentTime);
    this.compressor.ratio.setValueAtTime(12, this.ctx.currentTime);
    this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
    this.compressor.release.setValueAtTime(0.25, this.ctx.currentTime);

    this.lowPassFilter = this.ctx.createBiquadFilter();
    this.lowPassFilter.type = 'lowpass';
    
    this.highPassFilter = this.ctx.createBiquadFilter();
    this.highPassFilter.type = 'highpass';

    this.distortionNode = this.ctx.createWaveShaper();
    this.distortionNode.oversample = '4x';

    this.bitCrusherNode = this.ctx.createWaveShaper();
    this.bitCrusherNode.oversample = 'none';

    // Noise
    this.noiseGain = this.ctx.createGain();
    this.noiseGain.connect(this.preEffectsMix);

    // Spatial Nodes Init
    this.spatialInput = this.ctx.createGain();
    this.spatialOutput = this.ctx.createGain();
    
    this.convolver = this.ctx.createConvolver();
    this.convolver.buffer = createImpulseResponse(this.ctx, 2.5, 2.0);

    this.roomFilter = this.ctx.createBiquadFilter();
    this.roomFilter.type = 'lowpass';
    this.roomFilter.frequency.value = 200; 

    // PA System Init
    this.paFilter = this.ctx.createBiquadFilter();
    this.paFilter.type = 'bandpass';
    this.paFilter.frequency.value = 1100;
    this.paFilter.Q.value = 1.0;
    
    this.paGain = this.ctx.createGain();

    this.delayNode = this.ctx.createDelay(2.0);
    this.delayNode.delayTime.value = 0.4;
    this.delayGain = this.ctx.createGain();
    this.delayGain.gain.value = 0.1;

    this.delayOutputGain = this.ctx.createGain();
    this.delayOutputGain.gain.value = 0.3;

    this.setupRouting();
    this.startSnagLoop();
  }

  private setupRouting() {
    // ROUTING:
    // Source -> MusicGain -> TuningFilter -> PreEffectsMix
    // Interference -> InterferenceGain -> PreEffectsMix
    // Noise -> NoiseGain -> PreEffectsMix
    // Others -> PreEffectsMix
    
    // PreEffectsMix -> Wobble -> AM -> HP -> LP -> Dist -> Crush -> Comp -> Spatial -> Master
    
    // 1. Inputs to Chain
    this.preEffectsMix.connect(this.wobbleDelay);

    // 2. The Chain
    this.wobbleDelay.connect(this.amModulator);
    this.amModulator.connect(this.highPassFilter);
    this.highPassFilter.connect(this.lowPassFilter);
    this.lowPassFilter.connect(this.distortionNode);
    this.distortionNode.connect(this.bitCrusherNode);
    this.bitCrusherNode.connect(this.compressor);
    
    this.compressor.connect(this.spatialInput);
    this.spatialInput.connect(this.spatialOutput);

    // 3. Output
    this.spatialOutput.connect(this.masterGain);
    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
    this.masterGain.connect(this.destStream);
  }

  // --- MIXING & PHYSICS ENGINE ---

  private updateMix() {
      if (this.isCrashed) return; // Mix is locked during crash

      const t = this.ctx.currentTime;
      
      const mainVol = this.isBroadcastCut ? 0 : Math.cos(this.crossfadeLevel * Math.PI / 2);
      const neighborVol = this.isBroadcastCut ? 0 : Math.sin(this.crossfadeLevel * Math.PI / 2);

      const tuningNoise = Math.sin(this.crossfadeLevel * Math.PI) * 0.4;
      
      const centerDip = Math.sin(this.crossfadeLevel * Math.PI);
      const filterFreq = 22000 - (centerDip * 19000); 

      const targetMusicGain = this.isEASActive ? 0.05 : mainVol;
      
      this.musicGain.gain.setTargetAtTime(targetMusicGain, t, 0.1);
      this.interferenceGain.gain.setTargetAtTime(neighborVol, t, 0.1);
      
      const totalNoise = Math.min(1.0, this.manualNoiseLevel + tuningNoise);
      if (totalNoise > 0.001) {
          if (!this.noiseNode) this.startNoise(totalNoise);
          this.noiseGain.gain.setTargetAtTime(totalNoise * 0.5, t, 0.1);
      } else {
          this.noiseGain.gain.setTargetAtTime(0, t, 0.1);
      }

      this.tuningLowPass.frequency.setTargetAtTime(filterFreq, t, 0.1);
  }

  public setInterferenceLevel(level: number) {
      this.crossfadeLevel = Math.max(0, Math.min(1, level));
      this.updateMix();
  }

  public setNoiseLevel(amount: number) {
     this.manualNoiseLevel = amount;
     this.updateMix();
  }

  public toggleBroadcastCut(cut: boolean) {
      this.isBroadcastCut = cut;
      this.updateMix();
      
      if (cut) {
          this.heterodyneGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.01);
          this.easGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.01); 
      } else {
           this.easGain.gain.setTargetAtTime(0.6, this.ctx.currentTime, 0.05);
      }
  }

  // --- DRAMATIC SIGNAL FAILURE (CRASH) ---

  public triggerSignalCrash(active: boolean) {
    this.isCrashed = active;
    const t = this.ctx.currentTime;

    if (active) {
        // 1. TAPE STOP EFFECT (Pitch Drop)
        if (this.sourceNode) {
            this.sourceNode.playbackRate.cancelScheduledValues(t);
            this.sourceNode.playbackRate.setValueAtTime(1, t);
            // Drop to very slow speed over 2 seconds
            this.sourceNode.playbackRate.exponentialRampToValueAtTime(0.05, t + 2.0);
        }

        // 2. CHAOTIC WOBBLE (LFO rev up)
        this.wobbleLFO.frequency.cancelScheduledValues(t);
        this.wobbleLFO.frequency.setValueAtTime(this.wobbleLFO.frequency.value, t);
        this.wobbleLFO.frequency.linearRampToValueAtTime(20, t + 1.5); // Fast vibrato

        this.wobbleGain.gain.cancelScheduledValues(t);
        this.wobbleGain.gain.setValueAtTime(this.wobbleGain.gain.value, t);
        this.wobbleGain.gain.linearRampToValueAtTime(0.015, t + 1.5); // Deep depth

        // 3. FILTER SWEEP (Closing down)
        // We hijack the core LowPass filter
        this.lowPassFilter.frequency.cancelScheduledValues(t);
        this.lowPassFilter.frequency.setValueAtTime(this.lowPassFilter.frequency.value, t);
        this.lowPassFilter.frequency.exponentialRampToValueAtTime(50, t + 1.8);

        // 4. VOLUME DIE OUT
        // We kill the musicGain after the pitch drop starts
        this.musicGain.gain.cancelScheduledValues(t);
        this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, t);
        this.musicGain.gain.linearRampToValueAtTime(0, t + 1.9);

        // 5. NOISE SWELL
        // Temporary burst of static as signal dies
        if (!this.noiseNode) this.startNoise(0.8);
        this.noiseGain.gain.cancelScheduledValues(t);
        this.noiseGain.gain.setValueAtTime(this.noiseGain.gain.value, t);
        this.noiseGain.gain.linearRampToValueAtTime(0.8, t + 1.0);
        this.noiseGain.gain.linearRampToValueAtTime(0, t + 2.0); // Then silence

    } else {
        // RESTORE SIGNAL
        this.restoreSignal();
    }
  }

  private restoreSignal() {
      const t = this.ctx.currentTime;
      
      // 1. Reset Playback Rate
      if (this.sourceNode) {
          this.sourceNode.playbackRate.cancelScheduledValues(t);
          this.sourceNode.playbackRate.setTargetAtTime(1.0, t, 0.1);
      }

      // 2. Reset Filter & Effects to last known preset
      if (this.lastPresetConfig) {
          this.applyPreset(this.lastPresetConfig);
      } else {
          // Default fallback
          this.lowPassFilter.frequency.setTargetAtTime(20000, t, 0.1);
          this.wobbleLFO.frequency.setTargetAtTime(0.5, t, 0.1);
          this.wobbleGain.gain.setTargetAtTime(0, t, 0.1);
      }
      
      // 3. Force Update Mix to restore volumes
      // We need a slight delay to ensure the ramp-up doesn't sound like a reverse tape stop
      setTimeout(() => {
          this.updateMix();
      }, 50);
  }


  public triggerEAS(active: boolean) {
      if (this.ctx.state === 'suspended') {
          this.ctx.resume();
      }
      this.isEASActive = active;

      if (active) {
          if (this.easOsc1 || this.easOsc2) return;

          this.easOsc1 = this.ctx.createOscillator();
          this.easOsc1.type = 'sine';
          this.easOsc1.frequency.value = 853;

          this.easOsc2 = this.ctx.createOscillator();
          this.easOsc2.type = 'sine';
          this.easOsc2.frequency.value = 960;

          this.easOsc1.connect(this.easGain);
          this.easOsc2.connect(this.easGain);

          this.easOsc1.start();
          this.easOsc2.start();
      } else {
          if (this.easOsc1) { this.easOsc1.stop(); this.easOsc1.disconnect(); }
          if (this.easOsc2) { this.easOsc2.stop(); this.easOsc2.disconnect(); }
          this.easOsc1 = null;
          this.easOsc2 = null;
      }
      
      this.updateMix(); 
  }

  // --- Standard Features ---

  public async loadInterferenceFile(file: File) {
      const arrayBuffer = await file.arrayBuffer();
      this.interferenceBuffer = await this.ctx.decodeAudioData(arrayBuffer);
  }

  public setHeterodyneLevel(level: number) {
      this.heterodyneGain.gain.setTargetAtTime(level * 0.15, this.ctx.currentTime, 0.1);
  }

  public toggleTestTone(active: boolean) {
      if (active) {
          if (!this.testToneOsc) {
              this.testToneOsc = this.ctx.createOscillator();
              this.testToneOsc.type = 'sine';
              this.testToneOsc.frequency.value = 1000;
              this.testToneOsc.connect(this.testToneGain);
              this.testToneOsc.start();
              this.testToneGain.gain.setValueAtTime(0.5, this.ctx.currentTime);
          }
      } else {
          if (this.testToneOsc) {
              this.testToneOsc.stop();
              this.testToneOsc.disconnect();
              this.testToneOsc = null;
          }
      }
  }

  public toggleTapping(active: boolean) {
      if (this.tappingInterval) {
          window.clearInterval(this.tappingInterval);
          this.tappingInterval = null;
      }

      if (active) {
          this.tappingInterval = window.setInterval(() => {
              this.triggerThump();
          }, 800 + Math.random() * 1500); 
      }
  }

  private triggerThump() {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.frequency.setValueAtTime(60, t);
      osc.frequency.exponentialRampToValueAtTime(10, t + 0.1); 
      
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(1.0, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15); 

      osc.connect(gain);
      gain.connect(this.tappingGain); 
      
      osc.start(t);
      osc.stop(t + 0.2);
  }

  // --- Random Snag / Tape Instability Logic ---
  private startSnagLoop() {
      window.setInterval(() => {
          if (!this.isPlaying || this.snagIntensity <= 0 || this.isCrashed) return;
          if (Math.random() < (this.snagIntensity * 0.1)) {
              this.triggerTapeSnag();
          }
      }, 200);
  }

  private triggerTapeSnag() {
      const now = this.ctx.currentTime;
      const snagDepth = 0.02 + (Math.random() * 0.05); 
      this.wobbleDelay.delayTime.cancelScheduledValues(now);
      this.wobbleDelay.delayTime.linearRampToValueAtTime(0.05 + snagDepth, now + 0.1);
      this.wobbleDelay.delayTime.exponentialRampToValueAtTime(0.05, now + 0.6); 
  }

  public async loadFile(file: File): Promise<number> {
    const arrayBuffer = await file.arrayBuffer();
    this.audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
    return this.audioBuffer.duration;
  }

  public play(preset: PresetConfig, offset?: number) {
    if (!this.audioBuffer) return;
    
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    this.stop(false);

    this.sourceNode = this.ctx.createBufferSource();
    this.sourceNode.buffer = this.audioBuffer;
    this.sourceNode.loop = false;

    // Route: Source -> MusicGain -> TuningFilter -> PreEffectsMix
    this.sourceNode.connect(this.musicGain);
    this.musicGain.connect(this.tuningLowPass);
    this.tuningLowPass.connect(this.preEffectsMix);
    
    // Apply initial volumes
    this.updateMix();

    // Secondary Source (Interference)
    if (this.interferenceBuffer) {
        this.interferenceNode = this.ctx.createBufferSource();
        this.interferenceNode.buffer = this.interferenceBuffer;
        this.interferenceNode.loop = true;
        this.interferenceNode.connect(this.interferenceGain);
        this.interferenceNode.start(0, offset || 0);
    }

    this.applyPreset(preset);

    const startOffset = offset !== undefined ? offset : this.pauseTime;
    this.startTime = this.ctx.currentTime - startOffset;
    
    this.sourceNode.start(0, startOffset);
    this.isPlaying = true;
  }

  public stop(resetTime: boolean = true) {
    if (this.sourceNode) {
      try {
        this.sourceNode.stop();
        this.sourceNode.disconnect();
      } catch (e) {}
      this.sourceNode = null;
    }

    if (this.interferenceNode) {
        try {
            this.interferenceNode.stop();
            this.interferenceNode.disconnect();
        } catch(e) {}
        this.interferenceNode = null;
    }
    
    // Stop manual noise, but keep state for params
    if (this.noiseNode) {
        try {
            this.noiseNode.stop();
            this.noiseNode.disconnect();
        } catch(e) {}
        this.noiseNode = null;
    }

    this.triggerEAS(false);
    this.toggleTestTone(false);
    this.toggleTapping(false);
    this.isBroadcastCut = false;
    this.isCrashed = false;
    
    if (resetTime) {
      this.pauseTime = 0;
    } else {
      this.pauseTime = this.ctx.currentTime - this.startTime;
    }
    this.isPlaying = false;
  }

  public startNoise(level: number) {
      if (this.noiseNode) {
          try { this.noiseNode.stop(); this.noiseNode.disconnect(); } catch(e){}
      }
      this.noiseNode = this.ctx.createBufferSource();
      this.noiseNode.buffer = createNoiseBuffer(this.ctx);
      this.noiseNode.loop = true;
      this.noiseGain.gain.setValueAtTime(level * 0.5, this.ctx.currentTime);
      this.noiseNode.connect(this.noiseGain);
      this.noiseNode.start();
  }

  public seek(time: number, preset: PresetConfig) {
      if (this.isPlaying) {
          this.play(preset, time);
      } else {
          this.pauseTime = time;
      }
  }

  public setVolume(val: number) {
    this.masterGain.gain.setTargetAtTime(val, this.ctx.currentTime, 0.1);
  }

  public applyPreset(preset: PresetConfig) {
    this.lastPresetConfig = preset; // Save for restoreSignal
    this.highPassFilter.frequency.setTargetAtTime(preset.highPassFreq, this.ctx.currentTime, 0.1);
    this.lowPassFilter.frequency.setTargetAtTime(preset.lowPassFreq, this.ctx.currentTime, 0.1);

    this.setDistortionLevel(preset.distortion);
    this.setQuantizeLevel(preset.quantizeAmount);

    this.setWobbleLevel(preset.wobbleAmount);

    // Update noise params without restarting mix logic completely if possible
    // But play() calls applyPreset, so we set the baseline manual noise here
    this.setNoiseLevel(preset.noiseLevel);
  }

  public setDistortionLevel(amount: number) {
      if (amount <= 0) {
          this.distortionNode.curve = null;
      } else {
          this.distortionNode.curve = makeDistortionCurve(amount);
      }
      this.currentDistortionAmount = amount;
  }

  public setQuantizeLevel(amount: number) {
      if (amount <= 0) {
          this.bitCrusherNode.curve = null;
      } else {
          this.bitCrusherNode.curve = makeQuantizationCurve(amount);
      }
      this.currentQuantizeAmount = amount;
  }
  
  public setWobbleLevel(amount: number) {
      const depth = amount * 0.003; 
      this.wobbleGain.gain.setTargetAtTime(depth, this.ctx.currentTime, 0.2);
      this.wobbleLFO.frequency.setTargetAtTime(0.5 + (amount * 2), this.ctx.currentTime, 0.2);
  }

  public setDegradation(frequency: number, intensity: number) {
      this.fadeOsc.frequency.setTargetAtTime(frequency, this.ctx.currentTime, 0.1);
      this.fadeGain.gain.setTargetAtTime(intensity * 0.8, this.ctx.currentTime, 0.1);
  }

  public setTapeSnag(intensity: number) {
      this.snagIntensity = intensity;
  }

  public setSpatialEffect(effect: SpatialEffect) {
      this.spatialInput.disconnect();
      this.convolver.disconnect();
      this.roomFilter.disconnect();
      this.delayNode.disconnect();
      this.delayGain.disconnect();
      this.paFilter.disconnect();
      this.paGain.disconnect();
      this.delayOutputGain.disconnect();
      
      switch (effect) {
          case SpatialEffect.NEXT_ROOM:
              this.spatialInput.connect(this.roomFilter);
              this.roomFilter.connect(this.spatialOutput);
              break;
          case SpatialEffect.AUDITORIUM:
              this.spatialInput.connect(this.convolver);
              this.convolver.connect(this.spatialOutput);
              this.spatialInput.connect(this.spatialOutput); 
              break;
          case SpatialEffect.PA_SYSTEM:
              // PA Logic V2
              this.delayNode.delayTime.value = 0.5;
              this.delayGain.gain.value = 0.1;
              this.delayOutputGain.gain.value = 0.35;
              this.paGain.gain.value = 4.0;

              this.spatialInput.connect(this.paFilter);
              this.paFilter.connect(this.paGain);
              
              this.paGain.connect(this.spatialOutput);
              this.paGain.connect(this.delayNode);
              
              this.delayNode.connect(this.delayGain);
              this.delayGain.connect(this.delayNode);
              
              this.delayNode.connect(this.delayOutputGain);
              this.delayOutputGain.connect(this.spatialOutput);
              break;
          case SpatialEffect.NONE:
          default:
              this.spatialInput.connect(this.spatialOutput);
              break;
      }
  }

  // --- Offline Rendering ---

  public async renderOffline(
    preset: PresetConfig,
    noiseLevel: number,
    distortionOverride: number,
    wobbleOverride: number,
    spatialEffect: SpatialEffect,
    degFreq: number,
    degIntensity: number,
    snagIntensity: number,
    quantizeOverride: number
  ): Promise<string> {
    if (!this.audioBuffer) throw new Error("No Audio Loaded");

    const offlineCtx = new OfflineAudioContext(
        this.audioBuffer.numberOfChannels,
        this.audioBuffer.length,
        this.audioBuffer.sampleRate
    );

    const source = offlineCtx.createBufferSource();
    source.buffer = this.audioBuffer;

    const mixBus = offlineCtx.createGain();
    source.connect(mixBus);

    // 2. Noise (Standard preset noise only)
    if (noiseLevel > 0) {
        const noise = offlineCtx.createBufferSource();
        noise.buffer = createNoiseBuffer(offlineCtx);
        noise.loop = true;
        const noiseGain = offlineCtx.createGain();
        noiseGain.gain.value = noiseLevel * 0.5;
        noise.connect(noiseGain);
        noiseGain.connect(mixBus); 
        noise.start();
    }
    
    // Note: Offline rendering currently processes the Main Track through the effect chain.
    // It does not capture the "Neighbor Station" dynamic crossfading as that is a live performance feature.

    // 3. Effects Chain
    const wDelay = offlineCtx.createDelay(1.0);
    wDelay.delayTime.value = 0.05;
    
    if (snagIntensity > 0 || wobbleOverride > 0) {
        const wOsc = offlineCtx.createOscillator();
        const wGain = offlineCtx.createGain();
        wOsc.type = 'sine';
        wOsc.frequency.value = 0.5 + (wobbleOverride * 2);
        
        const chaos = snagIntensity * 0.01; 
        wGain.gain.value = (wobbleOverride * 0.003) + chaos;
        
        wOsc.connect(wGain);
        wGain.connect(wDelay.delayTime);
        wOsc.start();
    }

    const amGain = offlineCtx.createGain();
    if (degIntensity > 0) {
        const fadeOsc = offlineCtx.createOscillator();
        const fadeGain = offlineCtx.createGain();
        fadeOsc.frequency.value = degFreq;
        fadeGain.gain.value = degIntensity * 0.8;
        fadeOsc.connect(fadeGain);
        fadeGain.connect(amGain.gain);
        fadeOsc.start();
    }

    const hp = offlineCtx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = preset.highPassFreq;

    const lp = offlineCtx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = preset.lowPassFreq;

    const dist = offlineCtx.createWaveShaper();
    dist.oversample = '4x';
    if (distortionOverride > 0) {
        dist.curve = makeDistortionCurve(distortionOverride);
    }

    const crusher = offlineCtx.createWaveShaper();
    crusher.oversample = 'none';
    if (quantizeOverride > 0) {
        crusher.curve = makeQuantizationCurve(quantizeOverride);
    }

    const comp = offlineCtx.createDynamicsCompressor();
    comp.threshold.value = -24;
    comp.knee.value = 30;
    comp.ratio.value = 12;

    const spInput = offlineCtx.createGain();
    const spOutput = offlineCtx.createGain();
    
    // Connect MixBus to Chain
    mixBus.connect(wDelay);
    wDelay.connect(amGain);
    amGain.connect(hp);
    hp.connect(lp);
    lp.connect(dist);
    dist.connect(crusher);
    crusher.connect(comp);
    comp.connect(spInput);

    // Apply Spatial
    if (spatialEffect === SpatialEffect.NEXT_ROOM) {
        const room = offlineCtx.createBiquadFilter();
        room.type = 'lowpass';
        room.frequency.value = 200;
        spInput.connect(room);
        room.connect(spOutput);
    } 
    else if (spatialEffect === SpatialEffect.AUDITORIUM) {
        const conv = offlineCtx.createConvolver();
        conv.buffer = createImpulseResponse(offlineCtx, 2.5, 2.0);
        spInput.connect(conv);
        conv.connect(spOutput);
        spInput.connect(spOutput); 
    }
    else if (spatialEffect === SpatialEffect.PA_SYSTEM) {
        const paFilter = offlineCtx.createBiquadFilter();
        paFilter.type = 'bandpass';
        paFilter.frequency.value = 1100;
        paFilter.Q.value = 1.0;
        const paBoost = offlineCtx.createGain();
        paBoost.gain.value = 4.0; 
        const dly = offlineCtx.createDelay(2.0);
        dly.delayTime.value = 0.5; 
        const fb = offlineCtx.createGain();
        fb.gain.value = 0.1; 
        const wetMix = offlineCtx.createGain();
        wetMix.gain.value = 0.35; 
        spInput.connect(paFilter);
        paFilter.connect(paBoost);
        paBoost.connect(spOutput); 
        paBoost.connect(dly);
        dly.connect(fb); 
        fb.connect(dly);
        dly.connect(wetMix); 
        wetMix.connect(spOutput);
    } else {
        spInput.connect(spOutput);
    }

    spOutput.connect(offlineCtx.destination);

    source.start(0);
    const renderedBuffer = await offlineCtx.startRendering();
    const blob = audioBufferToWav(renderedBuffer);
    return URL.createObjectURL(blob);
  }

  // --- Recording ---

  public startRecording() {
      this.recordedChunks = [];
      const options = { mimeType: 'audio/webm;codecs=opus' };
      try {
        this.mediaRecorder = new MediaRecorder(this.destStream.stream, options);
      } catch (e) {
         console.error("MediaRecorder error", e);
         return;
      }
      this.mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
              this.recordedChunks.push(event.data);
          }
      };
      this.mediaRecorder.start();
  }

  public async stopRecording(): Promise<string> {
      return new Promise((resolve) => {
          if (!this.mediaRecorder) { resolve(''); return; }
          this.mediaRecorder.onstop = () => {
              const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });
              resolve(URL.createObjectURL(blob));
          };
          this.mediaRecorder.stop();
      });
  }

  public getAnalyser() { return this.analyser; }

  public getCurrentTime() {
    if (!this.isPlaying) return this.pauseTime;
    return Math.min(this.ctx.currentTime - this.startTime, this.audioBuffer?.duration || 0);
  }
}