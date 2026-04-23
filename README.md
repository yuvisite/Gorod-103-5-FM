# GorodPlus 103.4 FM

A simple web application that simulates the sound quality of a some regional radio station signal from the Eastern Europe in early 2000s. And also  have other non radio effects.

ГородПлюс is translates like CityPlus - ultra generic name.

## Features

- **Audio Presets**: Emulates various devices like AM radio, walkie-talkies, old telephones, and blown speakers.
- **Spatial Effects**: Simulates sound coming from another room, an auditorium, or a public address system.
- **Signal Interference**: Manual frequency tuning and automatic interference modes.
- **UI**: A 2000s styled web site.
- **EAS Simulation**: Includes Emergency Alert System tones (the American ones, idk why it here).
- **Recording**: Export processed audio to WAV or WebM files.

## Signal Propagation & Physics

Unlike simple "lo-fi" filters, this engine simulates the physical characteristics of radio signal reception:

- **Tuning Simulation**: Replicates the behavior of an analog tuner. Moving away from the center frequency dynamically narrows the signal bandwidth (low-pass filtering) and introduces resonant carrier noise.
- **Atmospheric Fading**: Simulates long-distance AM propagation using LFO-driven gain ducking and modulation to replicate signal "drift" and atmospheric conditions.
- **Station Interference**: Features a dual-buffer system where a "neighboring" station bleeds into the main broadcast based on frequency offset, following a trigonometric crossfade model.
- **Mechanical Degradation**: Implements wow and flutter through modulated delay lines, along with random "tape snags" (sudden delay jumps) to emulate worn-out playback hardware.
- **Hardware Simulation**: Includes high-order non-linear distortion curves and amplitude quantization (bit-crushing) to emulate cheap transistors and early digital components.

## Tech Stack

- **React 19** & **Vite**
- **TypeScript**
- **Tailwind CSS**
- **Web Audio API**

## Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/yuvisite/Gorodplus.git
   cd Gorodplus
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

## Project Structure

- `App.tsx`: Main application component and state management.
- `services/AudioEngine.ts`: Core Web Audio API implementation.
- `components/Visualizer.tsx`: Real-time audio visualization.
- `utils/audioUtils.ts`: Math and helpers for audio effects.
- `constants.ts`: Preset configurations.

## License

This project is licensed under the MIT License. See the LICENSE file for details.
