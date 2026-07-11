# SENTINEL

Planetary natural events telemetry and spatial observation dashboard.

## Overview
SENTINEL is a single-page telemetry dashboard that aggregates and visualizes active natural event data sourced from the NASA Earth Observatory Natural Event Tracker (EONET) v3 API. The application uses a 3D geospatial engine to map event coordinates, allowing operators to filter occurrences by planetary category and perform smooth camera transitions to inspect local event parameters. Localized environmental context is supplemented by integrating Google Maps and Air Quality APIs at the event centroid coordinates.

## Architecture
The application is structured as a client-side Single Page Application (SPA):
* **Data Ingestion Layer**: Fetches categories, sources, and events from the NASA EONET v3 REST endpoints. It implements a custom, self-healing parser to correct truncated JSON payloads and sanitizes coordinates, including correcting coordinate order discrepancies from the Global Disaster Alert and Coordination System (GDACS).
* **Geospatial Engine**: Utilizes CesiumJS to render a 3D Earth globe, projecting event coordinates onto standard Cartesian coordinate space. It integrates custom marker drawings on canvases and dynamically transitions the camera to center on active events.
* **Telemetry and Analysis Panel**: Queries reverse-geocoding coordinates via Google Maps API to resolve the nearest human settlements and details localized pollutants and AQI using the Google Air Quality API.
* **State Management**: Governed by a React reducer pattern (`appReducer`) defining three sequential phases: introduction/telemetry initialization, category overview, and active event telemetry tracking.

## Tech Stack
* **Framework**: React 19 (TypeScript) with Vite as the build tool for client-side single page rendering.
* **3D Geospatial Engine**: CesiumJS (integrated via `vite-plugin-cesium`) to handle terrain data, OSM 3D buildings, and geographic mapping.
* **Animation & Rendering**: GSAP and custom canvas shaders for ambient space-themed visual effects, plus custom interactive layouts.
* **Styling**: Pure CSS with custom styling tokens defined in `src/styles/tokens.css` for a dark-mode command center palette.
* **Telemetry Data Source**: NASA Earth Observatory Natural Event Tracker (EONET) v3 API (`https://eonet.gsfc.nasa.gov/api/v3`).

## Prerequisites
* Node.js (version 18.0.0 or later recommended)
* npm (package manager)

## Installation
All commands must be run from within the `sentinel` directory.

```bash
cd sentinel
npm install
```

## Configuration
Application behavior and external API integrations are configured via environment variables defined in a `.env` file within the `sentinel` directory.

| Variable Name | Description |
| :--- | :--- |
| `VITE_GOOGLE_MAPS_API_KEY` | Google Maps API key used for reverse geocoding to resolve nearest settlements at event centroids. |
| `VITE_CESIUM_ION_ACCESS_TOKEN` | Cesium Ion token used to authenticate requests for global imagery, world terrain, and OSM 3D buildings. |

## Usage
All commands must be executed within the `sentinel` directory.

### Development Mode
Start the Vite development server with hot module replacement:
```bash
npm run dev
```

### Static Asset Compilation
Compile TypeScript files and bundle assets for production deployment:
```bash
npm run build
```

### Code Quality Check
Execute static code analysis using Oxlint:
```bash
npm run lint
```

### Production Preview
Launch a local server to preview the built production assets:
```bash
npm run preview
```

## Project Structure
```
.
├── plan.md                                    # System specification and design constraints
└── sentinel/                                  # Core web application directory
    ├── index.html                             # HTML entry point for the single-page application
    ├── package.json                           # Project dependencies and script configurations
    ├── public/                                # Static assets, textures, cinematic video overlays, and audio assets
    │   └── textures/                          # Earth planetary textures
    └── src/                                   # Application source code
        ├── animations/                        # ReactBits and WebGL custom animation components
        ├── assets/                            # SVG icons and static graphics
        ├── data/                              # Data fetching, EONET API wrappers, coordinate parsing, and TypeScript interfaces
        ├── scene/                             # Geospatial globe rendering logic utilizing CesiumJS
        ├── state/                             # Global state management utilizing React context and reducers
        ├── styles/                            # Global stylesheet rules and design tokens
        └── ui/                                # Interactive 2D dashboards and event control deck components
```
