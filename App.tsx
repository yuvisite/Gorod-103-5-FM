import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AudioEngine } from './services/AudioEngine';
import Visualizer from './components/Visualizer';
import Controls from './components/Controls';
import { PresetType, PresetConfig, SpatialEffect } from './types';
import { PRESETS } from './constants';

const App: React.FC = () => {
  // Logic State
  const engineRef = useRef<AudioEngine | null>(null);
  const rafRef = useRef<number>(0);
  
  // UI State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [currentPreset, setCurrentPreset] = useState<PresetType>(PresetType.CLEAN);
  const [fileName, setFileName] = useState<string | null>(null);
  const [interferenceFileName, setInterferenceFileName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New Features State
  const [noiseLevel, setNoiseLevel] = useState(0);
  const [crapLevel, setCrapLevel] = useState(0); // Distortion
  const [wobbleLevel, setWobbleLevel] = useState(0); // Wow/Flutter
  const [quantizeLevel, setQuantizeLevel] = useState(0); // Bitcrush
  const [spatialMode, setSpatialMode] = useState<SpatialEffect>(SpatialEffect.NONE);
  
  // Advanced AM / Tape Mechanics
  const [degFreq, setDegFreq] = useState(0.2); // Hz
  const [degIntensity, setDegIntensity] = useState(0); // 0-1
  const [snagIntensity, setSnagIntensity] = useState(0); // 0-1

  // Interference / Special FX
  const [interferenceLevel, setInterferenceLevel] = useState(0);
  const [heterodyneLevel, setHeterodyneLevel] = useState(0);
  const [isTestToneActive, setIsTestToneActive] = useState(false);
  const [isTappingActive, setIsTappingActive] = useState(false);
  const [isBroadcastCut, setIsBroadcastCut] = useState(false);
  const [isCrashing, setIsCrashing] = useState(false); // New Crash State

  const [isRecording, setIsRecording] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  
  // EAS State
  const [isEASActive, setIsEASActive] = useState(false);

  // Initialize Engine once
  useEffect(() => {
    engineRef.current = new AudioEngine();
    return () => {
      engineRef.current?.stop();
    };
  }, []);

  // Playback Loop for UI updates
  const updateUI = useCallback(() => {
    if (engineRef.current && isPlaying) {
      setCurrentTime(engineRef.current.getCurrentTime());
      rafRef.current = requestAnimationFrame(updateUI);
    }
  }, [isPlaying]);

  useEffect(() => {
    if (isPlaying) {
      rafRef.current = requestAnimationFrame(updateUI);
    } else {
      cancelAnimationFrame(rafRef.current);
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, updateUI]);

  // Handlers
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !engineRef.current) return;

    // Reset state
    setIsPlaying(false);
    setCurrentTime(0);
    setError(null);
    setFileName(file.name);
    setIsLoading(true);
    setDownloadUrl(null);
    setExportUrl(null);

    try {
      const dur = await engineRef.current.loadFile(file);
      setDuration(dur);
      setIsLoading(false);
    } catch (err) {
      console.error(err);
      setError("Ошибка чтения файла. Используйте MP3 или WAV.");
      setIsLoading(false);
    }
  };

  const handleInterferenceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !engineRef.current) return;
      try {
          await engineRef.current.loadInterferenceFile(file);
          setInterferenceFileName(file.name);
      } catch (err) {
          console.error("Interference load failed", err);
      }
  };

  const updateEngineParams = () => {
      if (!engineRef.current) return;
      engineRef.current.setSpatialEffect(spatialMode);
      engineRef.current.setDistortionLevel(crapLevel * 5); 
      engineRef.current.setNoiseLevel(noiseLevel);
      engineRef.current.setWobbleLevel(wobbleLevel);
      engineRef.current.setQuantizeLevel(quantizeLevel);
      engineRef.current.setDegradation(degFreq, degIntensity);
      engineRef.current.setTapeSnag(snagIntensity);
      
      engineRef.current.setInterferenceLevel(interferenceLevel);
      engineRef.current.setHeterodyneLevel(heterodyneLevel);
  };

  const togglePlay = () => {
    if (!engineRef.current || !fileName) return;

    if (isPlaying) {
      engineRef.current.stop(false);
      setIsPlaying(false);
      setIsEASActive(false);
      setIsTestToneActive(false);
      setIsTappingActive(false);
      setIsBroadcastCut(false);
      setIsCrashing(false);
    } else {
      const presetConfig = PRESETS.find(p => p.id === currentPreset) || PRESETS[0];
      engineRef.current.play(presetConfig, currentTime);
      updateEngineParams();
      setIsPlaying(true);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!engineRef.current) return;
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    
    const presetConfig = PRESETS.find(p => p.id === currentPreset) || PRESETS[0];
    engineRef.current.seek(time, presetConfig);
    updateEngineParams();
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    setVolume(vol);
    engineRef.current?.setVolume(vol);
  };

  const changePreset = (presetId: PresetType) => {
    setCurrentPreset(presetId);
    const config = PRESETS.find(p => p.id === presetId) || PRESETS[0];
    
    const newCrap = config.distortion > 0 ? config.distortion / 5 : 0;
    setCrapLevel(newCrap);
    setNoiseLevel(config.noiseLevel);
    setWobbleLevel(config.wobbleAmount);
    setQuantizeLevel(config.quantizeAmount);
    
    setDegIntensity(0);
    setSnagIntensity(0);

    if (engineRef.current && isPlaying) {
        engineRef.current.applyPreset(config);
        engineRef.current.setDegradation(0.2, 0);
        engineRef.current.setTapeSnag(0);
    }
  };

  const handleManualOverride = (type: string, val: number) => {
      if (!engineRef.current) return;
      if (type === 'noise') {
          setNoiseLevel(val);
          engineRef.current.setNoiseLevel(val);
      } else if (type === 'crap') {
          setCrapLevel(val);
          engineRef.current.setDistortionLevel(val * 5);
      } else if (type === 'wobble') {
          setWobbleLevel(val);
          engineRef.current.setWobbleLevel(val);
      } else if (type === 'quantize') {
          setQuantizeLevel(val);
          engineRef.current.setQuantizeLevel(val);
      } else if (type === 'degFreq') {
          setDegFreq(val);
          engineRef.current.setDegradation(val, degIntensity);
      } else if (type === 'degInt') {
          setDegIntensity(val);
          engineRef.current.setDegradation(degFreq, val);
      } else if (type === 'snag') {
          setSnagIntensity(val);
          engineRef.current.setTapeSnag(val);
      } else if (type === 'interference') {
          setInterferenceLevel(val);
          engineRef.current.setInterferenceLevel(val);
      } else if (type === 'heterodyne') {
          setHeterodyneLevel(val);
          engineRef.current.setHeterodyneLevel(val);
      }
  };

  const handleSpatial = (mode: SpatialEffect) => {
      setSpatialMode(mode);
      engineRef.current?.setSpatialEffect(mode);
  };

  const toggleRecording = async () => {
      if (!engineRef.current) return;
      if (isRecording) {
          const url = await engineRef.current.stopRecording();
          setDownloadUrl(url);
          setIsRecording(false);
      } else {
          setDownloadUrl(null);
          engineRef.current.startRecording();
          setIsRecording(true);
      }
  };

  const toggleEAS = () => {
      if (!engineRef.current) return;
      const newState = !isEASActive;
      setIsEASActive(newState);
      engineRef.current.triggerEAS(newState);
  };

  const toggleTestTone = () => {
      if (!engineRef.current) return;
      const newState = !isTestToneActive;
      setIsTestToneActive(newState);
      engineRef.current.toggleTestTone(newState);
  };
  
  const toggleTapping = () => {
      if (!engineRef.current) return;
      const newState = !isTappingActive;
      setIsTappingActive(newState);
      engineRef.current.toggleTapping(newState);
  };

  const toggleCut = () => {
      if (!engineRef.current) return;
      const newState = !isBroadcastCut;
      setIsBroadcastCut(newState);
      engineRef.current.toggleBroadcastCut(newState);
  };

  const toggleCrash = () => {
      if (!engineRef.current) return;
      const newState = !isCrashing;
      setIsCrashing(newState);
      engineRef.current.triggerSignalCrash(newState);
  };

  const handleExportFullTrack = async () => {
      if (!engineRef.current || isExporting) return;
      
      setIsExporting(true);
      setExportUrl(null);
      
      const config = PRESETS.find(p => p.id === currentPreset) || PRESETS[0];
      
      try {
        const url = await engineRef.current.renderOffline(
            config, 
            noiseLevel, 
            crapLevel * 5, 
            wobbleLevel, 
            spatialMode,
            degFreq,
            degIntensity,
            snagIntensity,
            quantizeLevel
        );
        setExportUrl(url);
      } catch (e) {
          console.error("Export failed", e);
          setError("Ошибка экспорта. Попробуйте еще раз.");
      } finally {
          setIsExporting(false);
      }
  };

  return (
    <div className="min-h-screen p-4 flex justify-center items-start font-sans">
      {/* Main Container 800px width fixed for old school feel */}
      <div className="w-[840px] bg-white text-black shadow-xl">
          
          {/* Header Banner */}
          <div className="h-28 bg-gradient-to-r from-win-dark to-win-main flex items-center justify-between px-6 border-b-4 border-win-light relative overflow-hidden">
             {/* Abstract grid bg */}
             <div className="absolute inset-0 opacity-20" style={{backgroundImage: 'linear-gradient(0deg, transparent 24%, #ffffff 25%, #ffffff 26%, transparent 27%, transparent 74%, #ffffff 75%, #ffffff 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, #ffffff 25%, #ffffff 26%, transparent 27%, transparent 74%, #ffffff 75%, #ffffff 76%, transparent 77%, transparent)', backgroundSize: '30px 30px'}}></div>
             
             <div className="relative z-10 flex flex-col">
                 <h1 className="text-4xl font-black text-white italic tracking-tighter drop-shadow-md">
                     ГОРОД<span className="text-win-cyan">ПЛЮС</span>
                 </h1>
                 <span className="text-win-green font-pixel text-xl tracking-widest bg-black/50 px-2 mt-1">103.4 FM</span>
             </div>
             <div className="relative z-10 text-right text-win-light text-xs font-bold font-pixel">
                 <div>СЕГОДНЯ: {new Date().toLocaleDateString()}</div>
                 <div className="text-white">ЛУЧШИЕ ХИТЫ 2000-х</div>
             </div>
          </div>

          {/* Marquee Bar */}
          <div className="bg-black text-win-green font-pixel py-1 border-b-2 border-win-dark overflow-hidden">
              <div className="marquee-container">
                  <div className="marquee-content uppercase text-sm">
                      {isEASActive ? 
                        "!!! ВНИМАНИЕ !!! ПРОВЕРКА СИСТЕМЫ ОПОВЕЩЕНИЯ !!! ОБНАРУЖЕНА УГРОЗА !!! ВНИМАНИЕ !!!" : 
                        "+++ ДОБРО ПОЖАЛОВАТЬ НА ОФИЦИАЛЬНЫЙ САЙТ РАДИОСТАНЦИИ ГОРОД ПЛЮС 103.4 FM +++ ПРЯМОЙ ЭФИР КРУГЛОСУТОЧНО +++ ЗАКАЗЫВАЙТЕ ПЕСНИ ПО ТЕЛЕФОНУ 555-01-02 +++ НОВОСТИ РЕГИОНА КАЖДЫЙ ЧАС +++"
                      }
                  </div>
              </div>
          </div>

          {/* Layout Columns */}
          <div className="flex bg-[#e6f2ff]">
              
              {/* Left Sidebar (Navigation) */}
              <div className="w-48 bg-[#cceeff] border-r border-win-main p-2 flex flex-col gap-2">
                  <div className="bg-win-main text-white text-xs font-bold px-2 py-1 mb-1">МЕНЮ</div>
                  {['Главная', 'Новости', 'Хит-парад', 'Диджеи', 'Форум', 'Гостевая книга'].map(item => (
                      <div key={item} className="text-xs text-win-dark font-bold hover:text-red-600 hover:underline cursor-pointer pl-2">
                          » {item}
                      </div>
                  ))}

                  <div className="bg-win-main text-white text-xs font-bold px-2 py-1 mt-4 mb-1">РЕКЛАМА</div>
                  <div className="w-full h-24 bg-white border border-win-dark flex items-center justify-center text-[10px] text-gray-400">
                      МЕСТО ДЛЯ БАННЕРА 120x60
                  </div>
                  
                  <div className="mt-auto text-[10px] text-center text-win-dark/60 font-pixel">
                      ПОСЕТИТЕЛИ: <span className="text-red-600">034921</span>
                  </div>
              </div>

              {/* Main Content Area */}
              <div className="flex-1 p-4 bg-[url('https://www.transparenttextures.com/patterns/diagmonds-light.png')]">
                  
                  <h2 className="text-win-dark font-bold text-lg mb-2 border-b border-win-main pb-1">
                      Онлайн Вещание / Обработка Звука
                  </h2>
                  
                  <p className="text-xs text-gray-600 mb-4 font-sans">
                      Загрузите свой трек в наш эфирный процессор, чтобы услышать, как он звучал бы на волнах 103.4 FM. Используйте пресеты для имитации плохого приема.
                  </p>

                  {/* THE PLAYER (Skinned App) */}
                  <div className="bevel-panel p-1 shadow-2xl max-w-xl mx-auto">
                      {/* Player Header */}
                      <div className="bg-gradient-to-r from-gray-800 to-black p-2 flex justify-between items-center border-b border-gray-600">
                           <div className="flex items-center gap-2">
                               <div className={`w-3 h-3 rounded-full ${isRecording || isExporting ? 'bg-red-500 animate-pulse' : 'bg-win-green'}`}></div>
                               <span className="text-win-cyan text-xs font-pixel tracking-widest">BROADCAST_SYSTEM_V2.0</span>
                           </div>
                           <label className="cursor-pointer">
                               <input type="file" accept="audio/*" onChange={handleFileUpload} className="hidden" />
                               <div className="bevel-btn bg-gray-300 px-2 py-0.5 text-[10px] font-bold text-black hover:bg-white active:bg-gray-400">
                                   EJECT / LOAD
                               </div>
                           </label>
                      </div>

                      {/* Display Screen */}
                      <div className={`p-4 border-l-4 border-r-4 border-gray-700 relative transition-colors duration-100 ${isEASActive || isCrashing ? 'bg-red-900' : 'bg-black'}`}>
                          {/* Screen Grid Overlay */}
                          <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-10 pointer-events-none bg-[length:100%_2px,3px_100%]"></div>
                          
                          <div className="flex justify-between items-end mb-2 relative z-20">
                             <div className="text-win-green font-pixel text-xs truncate max-w-[200px]">
                                 {isLoading ? "БУФЕРИЗАЦИЯ..." : (isEASActive ? "!!! ВНИМАНИЕ !!!" : isCrashing ? "ОШИБКА ОБОРУДОВАНИЯ" : (fileName || "НЕТ СИГНАЛА"))}
                             </div>
                             <div className="text-win-cyan font-pixel text-xs">
                                 {isPlaying ? (isCrashing ? "FAIL" : "ON AIR") : "PAUSED"}
                             </div>
                          </div>

                          {engineRef.current && (
                            <Visualizer 
                                analyser={engineRef.current.getAnalyser()} 
                                isPlaying={isPlaying || isEASActive} 
                            />
                          )}
                          
                          {error && (
                            <div className="absolute top-1/2 left-0 w-full text-center bg-red-900/80 text-white text-xs py-1 z-30 font-pixel">
                                ОШИБКА: {error}
                            </div>
                          )}
                      </div>

                      {/* Controls Area (Metallic look) */}
                      <div className="bg-gradient-to-b from-gray-400 to-gray-500 p-3">
                          <Controls 
                            isPlaying={isPlaying} 
                            onPlayPause={togglePlay} 
                            currentTime={currentTime}
                            duration={duration}
                            onSeek={handleSeek}
                            volume={volume}
                            onVolumeChange={handleVolumeChange}
                          />

                          {/* Knobs & Sliders Panel */}
                          <div className="mt-4 grid grid-cols-2 gap-2">
                              {/* Left Panel: Reception (RF) */}
                              <div className="bevel-inset p-2">
                                  <div className="text-[9px] text-win-light mb-2 font-pixel tracking-widest text-center">РАДИОЭФИР / RF</div>
                                  
                                  <div className="space-y-2">
                                      {/* Interference Loader */}
                                      <div className="flex items-center gap-2 mb-1">
                                          <label className="flex-1 cursor-pointer">
                                              <input type="file" accept="audio/*" onChange={handleInterferenceUpload} className="hidden" />
                                              <div className="text-[8px] bg-gray-300 text-black px-1 py-0.5 text-center hover:bg-white truncate">
                                                  {interferenceFileName ? `LOADED: ${interferenceFileName.substring(0,10)}...` : "[ ЗАГР. СОСЕД. СТАНЦИЮ ]"}
                                              </div>
                                          </label>
                                      </div>

                                      <div className="flex items-center gap-2">
                                          <span className="text-[9px] text-win-cyan w-12">НАЛАЗАНИЕ</span>
                                          <input type="range" min="0" max="1" step="0.01" 
                                              value={interferenceLevel} onChange={(e) => handleManualOverride('interference', parseFloat(e.target.value))}
                                              className="w-full h-2 bg-black appearance-none cursor-pointer border border-gray-600" />
                                      </div>
                                      <div className="flex items-center gap-2">
                                          <span className="text-[9px] text-win-cyan w-12">ПОМЕХИ</span>
                                          <input type="range" min="0" max="1" step="0.01" 
                                              value={noiseLevel} onChange={(e) => handleManualOverride('noise', parseFloat(e.target.value))}
                                              className="w-full h-2 bg-black appearance-none cursor-pointer border border-gray-600" />
                                      </div>
                                      <div className="flex items-center gap-2">
                                          <span className="text-[9px] text-win-cyan w-12">СВИСТ</span>
                                          <input type="range" min="0" max="1" step="0.01" 
                                              value={heterodyneLevel} onChange={(e) => handleManualOverride('heterodyne', parseFloat(e.target.value))}
                                              className="w-full h-2 bg-black appearance-none cursor-pointer border border-gray-600" />
                                      </div>
                                  </div>
                              </div>

                              {/* Right Panel: Mechanics (Tape/Amp) */}
                              <div className="bevel-inset p-2">
                                  <div className="text-[9px] text-win-light mb-2 font-pixel tracking-widest text-center">ЛЕНТОПРОТЯГ / DSP</div>
                                  <div className="space-y-2">
                                      <div className="flex items-center gap-2">
                                          <span className="text-[9px] text-win-green w-12">ИСКАЖЕНИЕ</span>
                                          <input type="range" min="0" max="100" step="1" 
                                              value={crapLevel} onChange={(e) => handleManualOverride('crap', parseFloat(e.target.value))}
                                              className="w-full h-2 bg-black appearance-none cursor-pointer border border-gray-600" />
                                      </div>
                                      <div className="flex items-center gap-2">
                                          <span className="text-[9px] text-win-green w-12">ДЕТОНАЦИЯ</span>
                                          <input type="range" min="0" max="1" step="0.01" 
                                              value={wobbleLevel} onChange={(e) => handleManualOverride('wobble', parseFloat(e.target.value))}
                                              className="w-full h-2 bg-black appearance-none cursor-pointer border border-gray-600" />
                                      </div>
                                      <div className="flex items-center gap-2">
                                          <span className="text-[9px] text-win-green w-12">ЦИФРА</span>
                                          <input type="range" min="0" max="100" step="1" 
                                              value={quantizeLevel} onChange={(e) => handleManualOverride('quantize', parseFloat(e.target.value))}
                                              className="w-full h-2 bg-black appearance-none cursor-pointer border border-gray-600" />
                                      </div>
                                      <div className="flex items-center gap-2">
                                          <span className="text-[9px] text-win-green w-12">СРЫВ</span>
                                          <input type="range" min="0" max="1" step="0.01" 
                                              value={snagIntensity} onChange={(e) => handleManualOverride('snag', parseFloat(e.target.value))}
                                              className="w-full h-2 bg-black appearance-none cursor-pointer border border-gray-600" />
                                      </div>
                                  </div>
                              </div>
                          </div>

                          {/* Trigger Buttons */}
                          <div className="mt-2 grid grid-cols-4 gap-1">
                               <button 
                                  onClick={toggleTapping}
                                  className={`bevel-btn py-1 text-[9px] font-bold ${isTappingActive ? 'bg-win-green text-black' : 'bg-gray-300 text-gray-800'}`}
                               >
                                   СТУК (MIC)
                               </button>
                               <button 
                                  onClick={toggleTestTone}
                                  className={`bevel-btn py-1 text-[9px] font-bold ${isTestToneActive ? 'bg-win-green text-black' : 'bg-gray-300 text-gray-800'}`}
                               >
                                   1KHZ TONE
                               </button>
                               <button 
                                  onClick={toggleCut}
                                  className={`bevel-btn py-1 text-[9px] font-bold ${isBroadcastCut ? 'bg-red-500 text-white' : 'bg-gray-300 text-gray-800'}`}
                               >
                                   MUTE
                               </button>
                               <button 
                                  onClick={toggleCrash}
                                  className={`bevel-btn py-1 text-[9px] font-bold ${isCrashing ? 'bg-red-700 text-white animate-pulse' : 'bg-gray-300 text-gray-800'}`}
                               >
                                   СБОЙ
                               </button>
                          </div>

                          {/* Spatial / Environment Controls */}
                          <div className="mt-2 flex gap-1 bg-[#1a1a1a] p-1 border border-gray-700 shadow-inner">
                               <div className="flex items-center px-2 text-[9px] font-pixel text-gray-500 w-24 border-r border-gray-700 mr-1">
                                   ЭХО / ПРОСТРАНСТВО
                               </div>
                               <div className="flex-1 flex gap-1">
                                  <button onClick={() => handleSpatial(SpatialEffect.NONE)} className={`flex-1 py-1 text-[9px] font-bold uppercase ${spatialMode === SpatialEffect.NONE ? 'bg-win-cyan text-black shadow-[0_0_5px_cyan]' : 'bg-[#333] text-gray-500'}`}>Выкл</button>
                                  <button onClick={() => handleSpatial(SpatialEffect.NEXT_ROOM)} className={`flex-1 py-1 text-[9px] font-bold uppercase ${spatialMode === SpatialEffect.NEXT_ROOM ? 'bg-win-cyan text-black shadow-[0_0_5px_cyan]' : 'bg-[#333] text-gray-500'}`}>Комната</button>
                                  <button onClick={() => handleSpatial(SpatialEffect.AUDITORIUM)} className={`flex-1 py-1 text-[9px] font-bold uppercase ${spatialMode === SpatialEffect.AUDITORIUM ? 'bg-win-cyan text-black shadow-[0_0_5px_cyan]' : 'bg-[#333] text-gray-500'}`}>Зал</button>
                                  <button onClick={() => handleSpatial(SpatialEffect.PA_SYSTEM)} className={`flex-1 py-1 text-[9px] font-bold uppercase ${spatialMode === SpatialEffect.PA_SYSTEM ? 'bg-win-cyan text-black shadow-[0_0_5px_cyan]' : 'bg-[#333] text-gray-500'}`}>PA Sys</button>
                               </div>
                          </div>
                          
                          {/* Emergency Button */}
                          <div className="mt-2">
                               <button 
                                  onClick={toggleEAS}
                                  className={`
                                      w-full py-2 font-bold font-pixel text-xs tracking-widest border-2
                                      transition-all duration-100 uppercase
                                      ${isEASActive 
                                          ? 'bg-red-600 text-white border-red-800 shadow-[inset_0_0_10px_black] animate-pulse' 
                                          : 'bg-red-900 text-red-200 border-red-950 hover:bg-red-800'}
                                  `}
                               >
                                   {isEASActive ? "!!! ПРЕРВАТЬ ПЕРЕХВАТ ЭФИРА !!!" : "⚠ ТЕСТ СИСТЕМЫ ОПОВЕЩЕНИЯ ⚠"}
                               </button>
                          </div>

                          {/* Presets */}
                          <div className="mt-3 bg-black p-1 border border-gray-600">
                              <div className="grid grid-cols-3 gap-1">
                                  {PRESETS.map((preset) => (
                                      <button
                                          key={preset.id}
                                          onClick={() => changePreset(preset.id)}
                                          className={`
                                              text-[9px] font-pixel py-1 px-1 uppercase truncate
                                              ${currentPreset === preset.id 
                                                  ? 'bg-win-green text-black font-bold' 
                                                  : 'bg-win-dark text-gray-400 hover:text-white'}
                                          `}
                                      >
                                          {preset.label}
                                      </button>
                                  ))}
                              </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="mt-3 flex gap-2">
                              <button 
                                  onClick={toggleRecording}
                                  disabled={!fileName || isExporting}
                                  className={`
                                      flex-1 bevel-btn py-1 text-[10px] font-bold font-sans flex items-center justify-center gap-1
                                      ${isRecording ? 'bg-red-200 text-red-900 border-red-400' : 'bg-gray-200 text-black hover:bg-white'}
                                      disabled:opacity-50
                                  `}
                              >
                                  <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-red-600' : 'bg-gray-500'}`}></div>
                                  {isRecording ? 'ЗАПИСЬ...' : 'ЗАПИСЬ ЭФИРА (WebM)'}
                              </button>
                              
                              <button 
                                  onClick={handleExportFullTrack}
                                  disabled={!fileName || isRecording || isExporting}
                                  className={`
                                      flex-1 bevel-btn py-1 text-[10px] font-bold font-sans flex items-center justify-center gap-1
                                      bg-win-main text-white hover:bg-win-light hover:text-black
                                      disabled:opacity-50
                                  `}
                              >
                                  {isExporting ? 'ОБРАБОТКА...' : 'СКАЧАТЬ ТРЕК (WAV)'}
                              </button>
                          </div>
                      </div>
                  </div>

                  {/* Download Links below player */}
                  {(downloadUrl || exportUrl) && (
                      <div className="mt-4 p-2 bg-win-green/20 border border-win-green text-center">
                          {downloadUrl && (
                               <a href={downloadUrl} download={`efir-zapis-${Date.now()}.webm`} className="text-xs text-win-dark font-bold underline mr-4 hover:text-red-600">
                                   [ Скачать запись эфира ]
                               </a>
                          )}
                          {exportUrl && (
                               <a href={exportUrl} download={`track-processed-${Date.now()}.wav`} className="text-xs text-win-dark font-bold underline hover:text-red-600">
                                   [ Скачать WAV ]
                               </a>
                          )}
                      </div>
                  )}

                  {/* Bottom Text */}
                  <div className="mt-8 text-xs text-gray-500 font-sans border-t border-gray-300 pt-2">
                      <p>© 2004 Радиостанция "Город Плюс". Все права защищены.</p>
                      <p>Адрес редакции: ул. Ленина 42, офис 305. Тел: 555-01-02</p>
                      <p className="mt-2 text-[10px]">Designed by WebMaster_2000</p>
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
};

export default App;