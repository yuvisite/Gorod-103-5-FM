# GorodPlus 103.4 FM - Regional Eastern Europe Radio Simulator, PA system and other things

![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![Vite](https://img.shields.io/badge/vite-%23646CFF.svg?style=for-the-badge&logo=vite&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white)
![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)

**This was made via Google AI Studio for fun and doesnt pretend to be some serious thing**
**GorodPlus 103.4 FM** is an stylysed as website of some reginal radi station Gorod Plus 103.4 FM web application that simulates a old 2000s crappy regional radio station sound. It also also have other modes, not only radio ranging from classic AM radio static to the muffled sound of a radio playing in the next room or PA system.

## Key Features

- **Real-time Audio Processing**: Powered by the Web Audio API for high-performance, low-latency DSP effects.
- **Analog shit Presets**:
  - **AM Radio**: Classic bandwidth limiting and warm static.
  - **Walkie Talkie**: Heavy distortion, compression, and squelch noise.
  - **Old Telephone**: Narrow frequency range for that nostalgic "landline" sound.
  - **Blown Speaker**: Simulated physical membrane damage and buzzing bass.
  - **Shortwave Fade**: Muffled signals that drift in and out with sea-sick wobble.
  - **Polyphonic Ringtone**: 8-bit quantization artifacts for a 2000s mobile feel.
- **Spatial Simulation**:
  - Hear your music as if it's playing in an **Auditorium**, through a **Station PA**, or even from the **Next Room**.
- **Interactive Interference**:
  - **Manual Tuner**: Drag the frequency slider to find the "sweet spot" or intentionally introduce static and cross-talk from neighboring stations.
  - **Auto-Interference**: Modes (Weak, Medium, Hard) that dynamically change signal quality over time.
- **Retro UI**:
  - Looks like site from 2000s. Simulacrum on tailwind because its AI Studio and not my.
- **Emergency Alert System (EAS)**: Simulate broadcast interruptions with realistic alert tones.
- **Recording & Export**: Capture your processed audio sessions and download them as WAV or WebM files.

## Technical Stack

- **Framework**: [React 19](https://react.dev/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Audio Engine**: Custom implementation using the [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)

##  Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yuvisite/Gorodplus.git
   cd Gorodplus
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:5173`.

## Project Structure

- [App.tsx](file:///e%3A/Code%20projects/GorodPlus%20103-4%20FM/App.tsx): Main application component, managing UI state and layout.
- [AudioEngine.ts](file:///e%3A/Code%20projects/GorodPlus%20103-4%20FM/services/AudioEngine.ts): Core logic for the Web Audio processing graph.
- [Visualizer.tsx](file:///e%3A/Code%20projects/GorodPlus%20103-4%20FM/components/Visualizer.tsx): Canvas-based oscilloscope for real-time frequency visualization.
- [Controls.tsx](file:///e%3A/Code%20projects/GorodPlus%20103-4%20FM/components/Controls.tsx): Playback and volume management components.
- [audioUtils.ts](file:///e%3A/Code%20projects/GorodPlus%20103-4%20FM/utils/audioUtils.ts): Mathematical helpers for generating distortion curves, noise buffers, and impulse responses.
- [constants.ts](file:///e%3A/Code%20projects/GorodPlus%20103-4%20FM/constants.ts): Configuration for radio presets and audio parameters.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---
*Designed for the best experience in IE 6.0 (not really, use a modern browser!)*
