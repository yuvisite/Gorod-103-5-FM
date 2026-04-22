import React, { useEffect, useRef } from 'react';

interface VisualizerProps {
  analyser: AnalyserNode;
  isPlaying: boolean;
}

const Visualizer: React.FC<VisualizerProps> = ({ analyser, isPlaying }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationId = requestAnimationFrame(draw);

      if (!isPlaying) {
        // Static noise visual when paused
        ctx.fillStyle = '#001a00';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.beginPath();
        ctx.moveTo(0, canvas.height / 2);
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.strokeStyle = '#004400';
        ctx.stroke();
        return;
      }

      analyser.getByteTimeDomainData(dataArray);

      // Dark Green Background
      ctx.fillStyle = '#001a00';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Grid
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#003300';
      ctx.beginPath();
      for(let x=0; x<canvas.width; x+=20) { ctx.moveTo(x,0); ctx.lineTo(x,canvas.height); }
      for(let y=0; y<canvas.height; y+=20) { ctx.moveTo(0,y); ctx.lineTo(canvas.width,y); }
      ctx.stroke();

      ctx.lineWidth = 2;
      // Bright Cyan/Green line
      ctx.strokeStyle = '#00ffcc'; 
      ctx.shadowBlur = 4;
      ctx.shadowColor = '#00ffcc';
      
      ctx.beginPath();

      const sliceWidth = (canvas.width * 1.0) / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
      
      // Reset shadow
      ctx.shadowBlur = 0;
    };

    draw();

    return () => cancelAnimationFrame(animationId);
  }, [analyser, isPlaying]);

  return (
    <div className="relative w-full h-32 bg-black border border-gray-600 shadow-inner">
        <canvas 
            ref={canvasRef} 
            width={800} 
            height={200} 
            className="w-full h-full object-cover"
        />
    </div>
  );
};

export default Visualizer;