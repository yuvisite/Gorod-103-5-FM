# GorodPlus 103.4 FM

A simple web application that simulates the sound of a regional radio station from the early 2000s. This project was created for fun and to experiment with the Web Audio API.

## Features

- **Audio Presets**: Emulates various devices like AM radio, walkie-talkies, old telephones, and damaged speakers.
- **Spatial Effects**: Simulates sound coming from another room, an auditorium, or a public address system.
- **Signal Interference**: Manual frequency tuning and automatic interference modes.
- **UI**: interface styled after 2000s-era websites.
- **EAS Simulation**: Includes Emergency Alert System tones and effects.
- **Recording**: Export processed audio to WAV or WebM files.

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

MIT
