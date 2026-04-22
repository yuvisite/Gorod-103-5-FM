import React, { useState, useEffect } from 'react';
import { formatTime } from '../utils/audioUtils';

interface ControlsProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  volume: number;
  onVolumeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const Controls: React.FC<ControlsProps> = ({
  isPlaying,
  onPlayPause,
  currentTime,
  duration,
  onSeek,
  volume,
  onVolumeChange
}) => {
  // Local state to handle smooth dragging without constantly restarting the engine
  const [localTime, setLocalTime] = useState(currentTime);
  const [isDragging, setIsDragging] = useState(false);

  // Sync local time with engine time only when NOT dragging
  useEffect(() => {
    if (!isDragging) {
      setLocalTime(currentTime);
    }
  }, [currentTime, isDragging]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsDragging(true);
    setLocalTime(parseFloat(e.target.value));
  };

  const handleSliderCommit = () => {
    setIsDragging(false);
    onSeek(localTime);
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      
      {/* Time & Scrubber */}
      <div className="flex items-center gap-2 bg-[#111] px-2 py-1 border border-gray-600 shadow-inner">
        <span className="text-[10px] font-pixel text-win-green w-10 text-right">{formatTime(localTime)}</span>
        <input
          type="range"
          min="0"
          max={duration || 0}
          step="0.1"
          value={localTime}
          onChange={handleSliderChange}
          onMouseUp={handleSliderCommit}
          onTouchEnd={handleSliderCommit}
          className="flex-1 h-2 bg-[#333] appearance-none cursor-pointer"
          style={{
             backgroundImage: 'linear-gradient(#00ff00, #00ff00)',
             backgroundSize: `${(localTime/(duration || 1))*100}% 100%`,
             backgroundRepeat: 'no-repeat'
          }}
        />
        <span className="text-[10px] font-pixel text-win-green w-10">{formatTime(duration)}</span>
      </div>

      <div className="flex items-center justify-between mt-1">
        {/* Play/Pause Button - Metallic Bevel */}
        <button
          onClick={onPlayPause}
          className={`
            w-12 h-12 rounded-full flex items-center justify-center
            border-2 border-gray-300 shadow-[2px_2px_4px_rgba(0,0,0,0.5),inset_1px_1px_2px_rgba(255,255,255,0.8)]
            active:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.6)] active:translate-y-px
            transition-all bg-gradient-to-br from-gray-100 to-gray-400
          `}
        >
          {isPlaying ? (
             <div className="w-3 h-3 bg-black border-l-2 border-r-2 border-black"></div>
             // Stop icon shape
          ) : (
             <div className="w-0 h-0 border-t-[6px] border-t-transparent border-l-[10px] border-l-black border-b-[6px] border-b-transparent ml-1"></div>
             // Play icon shape
          )}
        </button>

        <div className="text-[10px] text-black font-bold font-sans uppercase tracking-widest text-center opacity-60">
            Master Control
        </div>

        {/* Volume Slider - Fader Style */}
        <div className="flex items-center gap-2">
           <svg className="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
           <div className="relative w-24 h-4 bg-gray-800 border-b border-white rounded-full overflow-hidden shadow-inner">
               <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={onVolumeChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              {/* Fake visual level */}
              <div 
                className="h-full bg-gradient-to-r from-green-500 to-red-500" 
                style={{ width: `${volume * 100}%` }}
              />
           </div>
        </div>
      </div>
    </div>
  );
};

export default Controls;