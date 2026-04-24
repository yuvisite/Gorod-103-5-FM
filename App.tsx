import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AudioEngine } from './services/AudioEngine';
import Visualizer from './components/Visualizer';
import Controls from './components/Controls';
import { PresetType, PresetConfig, SpatialEffect, AutoInterferenceMode } from './types';
import { PRESETS } from './constants';

const POLL_OPTIONS = [
    { q: "Ваше любимое животное?", a: ["Кот", "Собака", "Хомяк", "Тамагочи"] },
    { q: "Лучшая операционная система?", a: ["Windows 98", "Windows XP", "MS-DOS", "Linux"] },
    { q: "Как вы слушаете музыку?", a: ["Winamp", "CD-плеер", "Кассеты", "Радио"] },
    { q: "Ваш любимый напиток?", a: ["Кола", "Живчик", "Чай", "Квас"] },
];

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
  
  // File States
  const [fileName, setFileName] = useState<string | null>(null);

  // Playlist State (Folder Mode)
  const [playlist, setPlaylist] = useState<File[]>([]);
  const [isFolderMode, setIsFolderMode] = useState(false);
  const [folderName, setFolderName] = useState<string | null>(null);
  const [trackHistory, setTrackHistory] = useState<string[]>([]); // New History State

  const [interferenceFileName, setInterferenceFileName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // FX State
  const [noiseLevel, setNoiseLevel] = useState(0);
  const [crapLevel, setCrapLevel] = useState(0); // Distortion
  const [wobbleLevel, setWobbleLevel] = useState(0); // Wow/Flutter
  const [quantizeLevel, setQuantizeLevel] = useState(0); // Bitcrush
  const [spatialMode, setSpatialMode] = useState<SpatialEffect>(SpatialEffect.NONE);
  const [autoIntMode, setAutoIntMode] = useState<AutoInterferenceMode>(AutoInterferenceMode.OFF);
  
  // Mechanics
  const [degFreq, setDegFreq] = useState(0.2); // Hz
  const [degIntensity, setDegIntensity] = useState(0); // 0-1
  const [snagIntensity, setSnagIntensity] = useState(0); // 0-1

  // Interference / Special FX
  const [interferenceLevel, setInterferenceLevel] = useState(0);
  const [heterodyneLevel, setHeterodyneLevel] = useState(0);
  const [isTestToneActive, setIsTestToneActive] = useState(false);
  const [isTappingActive, setIsTappingActive] = useState(false);
  const [isBroadcastCut, setIsBroadcastCut] = useState(false);
  const [isCrashing, setIsCrashing] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  
  // EAS State
  const [isEASActive, setIsEASActive] = useState(false);

  // Fake UI States
  const [currentPoll, setCurrentPoll] = useState(POLL_OPTIONS[0]);
  const [pollVote, setPollVote] = useState<string | null>(null);
  const [isPollSubmitted, setIsPollSubmitted] = useState(false);
  
  // Chat State
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<{user: string, color: string, text: string}[]>([]);

  // Init Date & Poll
  useEffect(() => {
      const randomPoll = POLL_OPTIONS[Math.floor(Math.random() * POLL_OPTIONS.length)];
      setCurrentPoll(randomPoll);
  }, []);

  const addToHistory = (name: string) => {
      setTrackHistory(prev => {
          const newHistory = [name, ...prev];
          return newHistory.slice(0, 10); // Keep last 10
      });
  };

  // --- Playlist Logic ---
  
  const playRandomTrack = useCallback(async () => {
      if (playlist.length === 0 || !engineRef.current) return;
      
      const randomIndex = Math.floor(Math.random() * playlist.length);
      const file = playlist[randomIndex];
      
      setFileName(file.name);
      addToHistory(file.name); // Add to visual history

      setIsLoading(true);
      setCurrentTime(0);

      try {
          const dur = await engineRef.current.loadFile(file);
          setDuration(dur);
          setIsLoading(false);
          
          // Auto start logic
          const presetConfig = PRESETS.find(p => p.id === currentPreset) || PRESETS[0];
          engineRef.current.play(presetConfig, 0);
          updateEngineParams();
          setIsPlaying(true);
      } catch (e) {
          console.error("Failed to load track from playlist", e);
          setIsLoading(false);
          // Try next if failed
          playRandomTrack(); 
      }
  }, [playlist, currentPreset]);


  // Initialize Engine once
  useEffect(() => {
    engineRef.current = new AudioEngine();
    
    // Attach callback for folder mode
    engineRef.current.onTrackEnd = () => {
         window.dispatchEvent(new Event('audio-track-end'));
    };

    return () => {
      engineRef.current?.stop();
    };
  }, []);

  // Listen for track end to trigger shuffle
  useEffect(() => {
      const handleTrackEnd = () => {
          if (isFolderMode && playlist.length > 0) {
              playRandomTrack();
          } else {
              setIsPlaying(false);
          }
      };
      window.addEventListener('audio-track-end', handleTrackEnd);
      return () => window.removeEventListener('audio-track-end', handleTrackEnd);
  }, [isFolderMode, playlist, playRandomTrack]);


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
    setDownloadUrl(null);
    setExportUrl(null);

    setIsFolderMode(false); // Switch to single file mode
    setPlaylist([]);
    setFolderName(null);

    setFileName(file.name);
    addToHistory(file.name);

    setIsLoading(true);
    try {
      const dur = await engineRef.current.loadFile(file);
      setDuration(dur);
      setIsLoading(false);
    } catch (err) {
      console.error(err);
      setError("Ошибка чтения аудио. Используйте MP3/WAV.");
      setIsLoading(false);
    }
  };

  const handleDirectorySelect = async () => {
      if (!('showDirectoryPicker' in window)) {
          alert("Ваш браузер не поддерживает выбор папок. Используйте Chrome или Edge.");
          return;
      }

      try {
          // @ts-ignore - TS doesn't fully know File System Access API yet
          const dirHandle = await window.showDirectoryPicker();
          const files: File[] = [];
          
          setIsLoading(true);
          setError(null);
          
          // Recursive scanner function
          const scanDir = async (handle: any) => {
              for await (const entry of handle.values()) {
                  if (entry.kind === 'file') {
                      const name = entry.name.toLowerCase();
                      if (name.endsWith('.mp3') || name.endsWith('.wav') || name.endsWith('.ogg')) {
                          files.push(await entry.getFile());
                      }
                  } else if (entry.kind === 'directory') {
                      // Recurse into subdirectory
                      await scanDir(entry);
                  }
              }
          };

          await scanDir(dirHandle);
          
          if (files.length > 0) {
              setPlaylist(files);
              setFolderName(dirHandle.name);
              setIsFolderMode(true);
              setFileName(`[ПАПКА] ${dirHandle.name} (${files.length} треков)`);
              setIsPlaying(false); 
          } else {
              setError("В папке (и подпапках) не найдено аудиофайлов (MP3/WAV/OGG).");
          }
          setIsLoading(false);
      } catch (err: any) {
          console.error("Directory pick cancelled or failed", err);
          
          if (err.message && err.message.includes('Cross origin sub frames')) {
               alert("Внимание: Выбор папки недоступен в режиме предпросмотра (iframe). Пожалуйста, откройте сайт в новом окне или используйте загрузку одиночных файлов.");
          } else if (err.name !== 'AbortError') {
               setError("Ошибка доступа к папке.");
          }
          
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
      engineRef.current.setAutoInterference(autoIntMode);
  };

  const togglePlay = () => {
    if (!engineRef.current) return;
    if (!fileName && playlist.length === 0) return;

    if (isPlaying) {
      engineRef.current.stop(false);
      setIsPlaying(false);
      setIsEASActive(false);
      setIsTestToneActive(false);
      setIsTappingActive(false);
      setIsBroadcastCut(false);
      setIsCrashing(false);
      setAutoIntMode(AutoInterferenceMode.OFF);
    } else {
      const presetConfig = PRESETS.find(p => p.id === currentPreset) || PRESETS[0];
      
      if (isFolderMode && playlist.length > 0) {
          if (engineRef.current.getCurrentTime() === 0) {
              playRandomTrack();
              return; 
          } else {
              engineRef.current.play(presetConfig, currentTime);
          }
      } else {
         engineRef.current.play(presetConfig, currentTime);
      }

      updateEngineParams();
      setIsPlaying(true);
    }
  };

  const handleSeek = (time: number) => {
    if (!engineRef.current) return;
    setCurrentTime(time);
    const presetConfig = PRESETS.find(p => p.id === currentPreset) || PRESETS[0];
    engineRef.current.seek(time, presetConfig);
    // Removed updateEngineParams call here as play/seek automatically applies current preset effects
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

  const handleAutoInterferenceChange = (mode: AutoInterferenceMode) => {
      setAutoIntMode(mode);
      if (engineRef.current) {
          engineRef.current.setAutoInterference(mode);
      }
  }

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

  const handleChatSubmit = () => {
      if (!chatInput.trim()) return;
      setChatMessages(prev => [{user: "Вы", color: "red-600", text: chatInput}, ...prev]);
      setChatInput("");
  }

  // Current Date logic
  const today = new Date();
  const day = today.getDate();
  const month = today.toLocaleString('ru', { month: 'long' }).toUpperCase();
  const weekday = today.toLocaleString('ru', { weekday: 'long' }).toUpperCase();

  return (
    <div className="min-h-screen p-4 flex justify-center items-start font-sans">
      {/* Main Container width expanded for 3-column layout */}
      <div className="w-[1000px] bg-white text-black shadow-xl">
          
          {/* Header Banner */}
          <div className="h-32 bg-gradient-to-r from-win-dark to-win-main flex flex-col justify-between px-6 border-b-4 border-win-light relative overflow-hidden">
             <div className="absolute inset-0 opacity-20" style={{backgroundImage: 'linear-gradient(0deg, transparent 24%, #ffffff 25%, #ffffff 26%, transparent 27%, transparent 74%, #ffffff 75%, #ffffff 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, #ffffff 25%, #ffffff 26%, transparent 27%, transparent 74%, #ffffff 75%, #ffffff 76%, transparent 77%, transparent)', backgroundSize: '30px 30px'}}></div>
             
             <div className="relative z-10 flex justify-between items-start mt-4">
                 <div className="flex flex-col">
                     <h1 className="text-5xl font-black text-white italic tracking-tighter drop-shadow-md flex items-baseline gap-2">
                         ГОРОД<span className="text-win-cyan text-3xl">103.5 FM</span>
                     </h1>
                 </div>
             </div>
             
             <div className="relative z-10 text-right text-win-light text-xs font-bold font-pixel mb-1 flex justify-between items-end">
                 <div className="flex gap-4">
                      <a href="#" className="hover:text-white hover:underline">ГЛАВНАЯ</a>
                      <a href="#" className="hover:text-white hover:underline">НОВОСТИ</a>
                      <a href="#" className="hover:text-white hover:underline">ЧАТ</a>
                      <a href="#" className="hover:text-white hover:underline">ФОРУМ</a>
                 </div>
                 <div>СЕГОДНЯ: {today.toLocaleDateString()}</div>
             </div>
          </div>

          {/* Marquee Bar */}
          <div className="bg-black text-win-green font-pixel py-1 border-b-2 border-win-dark overflow-hidden">
              <div className="marquee-container">
                  <div className="marquee-content uppercase text-sm">
                      {isEASActive ? 
                        "!!! ВНИМАНИЕ !!! ПРОВЕРКА СИСТЕМЫ ОПОВЕЩЕНИЯ !!! ОБНАРУЖЕНА УГРОЗА !!! ВНИМАНИЕ !!!" : 
                        "+++ ДОБРО ПОЖАЛОВАТЬ НА ОФИЦИАЛЬНЫЙ САЙТ РАДИОСТАНЦИИ ГОРОД 103.5 FM +++ ПРЯМОЙ ЭФИР КРУГЛОСУТОЧНО +++ ЗАКАЗЫВАЙТЕ ПЕСНИ ПО ТЕЛЕФОНУ 555-01-02 +++ НОВОСТИ РЕГИОНА КАЖДЫЙ ЧАС +++"
                      }
                  </div>
              </div>
          </div>

          {/* 3-Column Layout */}
          <div className="flex bg-[#e6f2ff] border-t border-white">
              
              {/* === LEFT COLUMN (180px) === */}
              <div className="w-[180px] bg-[#dbe8f5] border-r border-win-main p-2 flex flex-col gap-3">
                  
                  {/* Menu */}
                  <div className="border border-win-dark bg-white shadow-sm">
                      <div className="bg-gradient-to-r from-win-dark to-win-main text-white text-xs font-bold px-2 py-1">МЕНЮ</div>
                      <div className="flex flex-col text-[11px] font-sans">
                          <a className="px-2 py-1 text-red-600 font-bold bg-[#ffffcc] border-b border-gray-200">» РАДИОЭФИР</a>
                          <a className="px-2 py-1 text-win-dark hover:text-red-600 hover:bg-gray-100 border-b border-gray-200">» Программа</a>
                          <a className="px-2 py-1 text-win-dark hover:text-red-600 hover:bg-gray-100 border-b border-gray-200">» Новости</a>
                          <a className="px-2 py-1 text-win-dark hover:text-red-600 hover:bg-gray-100 border-b border-gray-200">» Хит-парад</a>
                          <a className="px-2 py-1 text-win-dark hover:text-red-600 hover:bg-gray-100 border-b border-gray-200">» Диджеи</a>
                          <a className="px-2 py-1 text-win-dark hover:text-red-600 hover:bg-gray-100 border-b border-gray-200">» Контакты</a>
                      </div>
                  </div>

                  {/* Login Form */}
                  <div className="border border-gray-400 bg-gray-200 shadow-sm p-2">
                      <div className="text-[10px] font-bold text-win-dark mb-1">ВХОД НА САЙТ</div>
                      <input type="text" placeholder="Логин" className="w-full text-[10px] border border-gray-400 px-1 mb-1" />
                      <input type="password" placeholder="Пароль" className="w-full text-[10px] border border-gray-400 px-1 mb-1" />
                      <div className="flex justify-between items-center">
                          <label className="text-[9px]"><input type="checkbox" /> Чужой ПК</label>
                          <button className="bg-gray-300 border border-gray-500 text-[9px] px-2 hover:bg-white">Войти</button>
                      </div>
                      <div className="text-[9px] text-blue-800 underline mt-1 cursor-pointer">Регистрация</div>
                  </div>

                  {/* Partners */}
                  <div className="border border-gray-400 bg-white p-1 text-center">
                      <div className="text-[10px] font-bold text-gray-500 mb-1">НАШИ ДРУЗЬЯ</div>
                      <div className="space-y-1">
                          <div className="h-8 bg-gray-200 border border-gray-300 flex items-center justify-center text-[8px] text-gray-400">ПОРТАЛ ГОРОДА</div>
                          <div className="h-8 bg-gray-200 border border-gray-300 flex items-center justify-center text-[8px] text-gray-400">АВТОРЫНОК</div>
                          <div className="h-8 bg-gray-200 border border-gray-300 flex items-center justify-center text-[8px] text-gray-400">ЧАТ "КРОВАТКА"</div>
                      </div>
                  </div>
              </div>

              {/* === CENTER COLUMN (Fluid) === */}
              <div className="flex-1 p-4 bg-[url('https://www.transparenttextures.com/patterns/diagmonds-light.png')]">
                  
                  <h2 className="text-win-dark font-bold text-lg mb-2 border-b border-win-main pb-1 flex justify-between items-end">
                      <span>Онлайн Вещание</span>
                      <span className="text-xs text-red-600 animate-pulse bg-white border border-red-600 px-1">ON AIR</span>
                  </h2>
                  
                  <p className="text-xs text-gray-600 mb-4 font-sans bg-[#ffffcc] border border-[#cccc99] p-2">
                      <span className="font-bold text-red-600">ВНИМАНИЕ:</span> Загрузите файл или выберите папку с музыкой для создания собственного радиоэфира с эффектами аналогового вещания.
                  </p>

                  {/* THE PLAYER (Skinned App) */}
                  <div className="bevel-panel p-1 shadow-2xl mx-auto mb-6">
                      {/* Player Header */}
                      <div className="bg-gradient-to-r from-gray-800 to-black p-2 flex justify-between items-center border-b border-gray-600">
                           <div className="flex items-center gap-2">
                               <div className={`w-3 h-3 rounded-full ${isRecording || isExporting ? 'bg-red-500 animate-pulse' : (isPlaying ? 'bg-win-green' : 'bg-red-900')}`}></div>
                               <span className="text-win-cyan text-xs font-pixel tracking-widest">
                                   {isFolderMode ? "AUTO_DJ_SYSTEM" : "BROADCAST_SYSTEM_V2.0"}
                               </span>
                           </div>
                           <div className="flex gap-1">
                               <button 
                                  onClick={handleDirectorySelect}
                                  className="bevel-btn bg-gray-300 px-2 py-0.5 text-[10px] font-bold text-black hover:bg-white active:bg-gray-400"
                                  title="Загрузить папку (Требуется Chrome/Edge)"
                               >
                                   ВЫБРАТЬ ПАПКУ
                               </button>
                               <label className="cursor-pointer">
                                   <input 
                                      type="file" 
                                      accept="audio/*"
                                      onChange={handleFileUpload} 
                                      className="hidden" 
                                   />
                                   <div className="bevel-btn bg-gray-300 px-2 py-0.5 text-[10px] font-bold text-black hover:bg-white active:bg-gray-400">
                                       LOAD FILE
                                   </div>
                               </label>
                           </div>
                      </div>

                      {/* Display Screen (Radio) */}
                      <div className={`p-4 border-l-4 border-r-4 border-gray-700 relative transition-colors duration-100 ${isEASActive || isCrashing ? 'bg-red-900' : 'bg-black'}`}>
                          {/* Screen Grid Overlay */}
                          <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-10 pointer-events-none bg-[length:100%_2px,3px_100%]"></div>
                          
                          <div className="flex justify-between items-end mb-2 relative z-20">
                             <div className="text-win-green font-pixel text-xs truncate max-w-[200px]">
                                 {isLoading ? "БУФЕРИЗАЦИЯ..." : (isEASActive ? "!!! ВНИМАНИЕ !!!" : isCrashing ? "ОШИБКА ОБОРУДОВАНИЯ" : (fileName || "НЕТ СИГНАЛА"))}
                                 {isFolderMode && !isLoading && !isEASActive && !isCrashing && (
                                     <div className="text-[10px] text-gray-500">{folderName} | ШЕФФЛ</div>
                                 )}
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
                                  <div className="text-[9px] text-win-light mb-2 font-pixel tracking-widest text-center">ПРИЕМ СИГНАЛА / RF</div>
                                  
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

                                      {/* AUTO INTERFERENCE SELECTOR */}
                                      <div className="flex items-center gap-2 mt-2 border-t border-gray-700 pt-1">
                                          <span className="text-[9px] text-win-cyan w-12 leading-3">АВТО-ПОМЕХИ</span>
                                          <select 
                                              value={autoIntMode}
                                              onChange={(e) => handleAutoInterferenceChange(e.target.value as AutoInterferenceMode)}
                                              className="flex-1 bg-black text-win-green text-[9px] border border-gray-600 font-pixel uppercase"
                                          >
                                              <option value={AutoInterferenceMode.OFF}>ОТКЛ</option>
                                              <option value={AutoInterferenceMode.WEAK}>СЛАБЫЙ (ДРЕЙФ)</option>
                                              <option value={AutoInterferenceMode.MEDIUM}>СРЕДНИЙ (ШУМ)</option>
                                              <option value={AutoInterferenceMode.HARD}>ЖЕСТКИЙ (ХАОС)</option>
                                          </select>
                                      </div>
                                  </div>
                              </div>

                              {/* Right Panel: Mechanics (Tape/Amp) */}
                              <div className="bevel-inset p-2">
                                  <div className="text-[9px] text-win-light mb-2 font-pixel tracking-widest text-center">ИСКАЖЕНИЯ / DSP</div>
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
                                  <button onClick={() => handleSpatial(SpatialEffect.PA_SYSTEM)} className={`flex-1 py-1 text-[9px] font-bold uppercase ${spatialMode === SpatialEffect.PA_SYSTEM ? 'bg-win-cyan text-black shadow-[0_0_5px_cyan]' : 'bg-[#333] text-gray-500'}`}>Вокзал</button>
                                  <button onClick={() => handleSpatial(SpatialEffect.CITY_ALERT)} className={`flex-1 py-1 text-[9px] font-bold uppercase ${spatialMode === SpatialEffect.CITY_ALERT ? 'bg-win-cyan text-black shadow-[0_0_5px_cyan]' : 'bg-[#333] text-gray-500'}`}>Улица</button>
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

                       {/* Guestbook / Chat */}
                       <div className="bg-white border border-gray-300 p-2 shadow-sm">
                          <h3 className="text-win-dark font-bold text-sm border-b border-gray-300 mb-2">ГОСТЕВАЯ КНИГА / ЧАТ</h3>
                          <div className="h-32 overflow-y-scroll bg-gray-100 border border-gray-300 p-1 mb-2 font-sans">
                              {chatMessages.length === 0 ? (
                                  <div className="text-[10px] text-gray-500 italic text-center mt-10">Нет сообщений. Будьте первым!</div>
                              ) : (
                                  chatMessages.map((msg, idx) => (
                                      <div key={idx} className="mb-1 border-b border-gray-200 pb-1">
                                          <span className={`font-bold text-${msg.color} text-[10px]`}>{msg.user}:</span> 
                                          <span className="text-[10px] ml-1">{msg.text}</span>
                                      </div>
                                  ))
                              )}
                          </div>
                          <div className="flex gap-1">
                              <input 
                                  type="text" 
                                  value={chatInput}
                                  onChange={(e) => setChatInput(e.target.value)}
                                  placeholder="Ваше сообщение..." 
                                  className="flex-1 border border-gray-400 text-[10px] px-1" 
                                  onKeyDown={(e) => e.key === 'Enter' && handleChatSubmit()}
                              />
                              <button onClick={handleChatSubmit} className="bg-gray-300 border border-gray-500 text-[10px] px-2 hover:bg-white">Отпр.</button>
                          </div>
                      </div>
                  </div>
              </div>

              {/* === RIGHT COLUMN (180px) === */}
              <div className="w-[180px] bg-[#dbe8f5] border-l border-win-main p-2 flex flex-col gap-3">
                  
                  {/* Poll Widget */}
                  <div className="border border-win-dark bg-white shadow-sm">
                      <div className="bg-gradient-to-r from-win-dark to-win-main text-white text-xs font-bold px-2 py-1">ОПРОС</div>
                      <div className="p-2 text-[10px]">
                          {!isPollSubmitted ? (
                              <>
                                  <div className="font-bold mb-2">{currentPoll.q}</div>
                                  <div className="space-y-1">
                                      {currentPoll.a.map((opt) => (
                                          <label key={opt} className="flex items-center gap-1 cursor-pointer">
                                              <input type="radio" name="poll" checked={pollVote === opt} onChange={() => setPollVote(opt)} /> {opt}
                                          </label>
                                      ))}
                                  </div>
                                  <div className="mt-2 text-center">
                                      <button 
                                          onClick={() => setIsPollSubmitted(true)}
                                          disabled={!pollVote}
                                          className="bg-gray-300 border border-gray-500 px-2 py-0.5 w-full hover:bg-white disabled:opacity-50"
                                      >
                                          Голосовать
                                      </button>
                                  </div>
                              </>
                          ) : (
                              <div className="text-center">
                                  <div className="font-bold text-win-dark mb-2">РЕЗУЛЬТАТЫ</div>
                                  <div className="text-left space-y-2">
                                      {currentPoll.a.map((opt, i) => (
                                          <div key={opt}>
                                              <div className="flex justify-between">
                                                  <span>{opt}</span>
                                                  <span className="font-bold">{[45, 30, 15, 10][i] || 0}%</span>
                                              </div>
                                              <div className="h-1 bg-gray-200 mt-px">
                                                  <div className="h-full bg-blue-600" style={{width: `${[45, 30, 15, 10][i] || 0}%`}}></div>
                                              </div>
                                          </div>
                                      ))}
                                  </div>
                                  <div className="mt-4 text-[9px] text-gray-500 border-t pt-1">
                                      Всего голосов: 4210<br/>
                                      Дата: {new Date(2002, Math.floor(Math.random()*11), Math.floor(Math.random()*28)).toLocaleDateString()}
                                  </div>
                              </div>
                          )}
                      </div>
                  </div>

                  {/* Last Played (History) */}
                  <div className="border border-gray-400 bg-white shadow-sm">
                      <div className="bg-gray-200 text-gray-800 text-xs font-bold px-2 py-1 border-b border-gray-400">ПОСЛЕДНИЕ В ЭФИРЕ</div>
                      {trackHistory.length === 0 ? (
                          <div className="text-[9px] p-2 text-gray-500 italic">Эфир только начался...</div>
                      ) : (
                          <ol className="list-decimal list-inside text-[9px] p-2 space-y-1 font-sans">
                              {trackHistory.map((track, i) => (
                                  <li key={i} className="truncate" title={track}>{track}</li>
                              ))}
                          </ol>
                      )}
                  </div>

                   {/* Calendar */}
                   <div className="border border-win-dark bg-white shadow-sm text-center p-1">
                       <div className="text-red-600 font-bold text-lg leading-none">{day}</div>
                       <div className="text-gray-600 text-xs uppercase font-bold">{month}</div>
                       <div className="text-[10px] text-gray-500">{weekday}</div>
                   </div>

                  <div className="mt-auto text-[9px] text-center text-gray-400">
                      Site best viewed in IE 6.0<br/>Resolution 800x600
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
};

export default App;