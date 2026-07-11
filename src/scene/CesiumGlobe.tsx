import { useEffect, useRef, useState } from 'react';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import type { EonetEvent } from '../data/types';
import { extractCoordinates } from '../data/coordinates';

// Use a free public access token or let it fall back
Cesium.Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_ION_ACCESS_TOKEN || '';

interface CesiumGlobeProps {
  events: EonetEvent[];
  selectedEvent: EonetEvent | null;
  onSelectEvent: (event: EonetEvent) => void;
  onClearEvent: () => void;
  phase: 'intro' | 'category' | 'event';
  viewMode: 'globe' | 'street';
  onViewModeChange: (mode: 'globe' | 'street') => void;
}

const getCategoryColor = (categoryId: string): Cesium.Color => {
  switch (categoryId) {
    case 'wildfires':
      return Cesium.Color.fromCssColorString('#FF5533'); // Neon red-orange
    case 'severeStorms':
      return Cesium.Color.fromCssColorString('#3399FF'); // Cyan-blue
    case 'volcanoes':
      return Cesium.Color.fromCssColorString('#FFCC00'); // Amber yellow
    case 'waterIce':
      return Cesium.Color.fromCssColorString('#00FFCC'); // Mint/water-ice
    default:
      return Cesium.Color.fromCssColorString('#FFFFFF');
  }
};

const createMarkerImage = (colorStr: string, isSelected: boolean): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  const size = isSelected ? 48 : 32;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const center = size / 2;

  // 1. Soft glowing outer aura
  const glowRadius = isSelected ? 18 : 10;
  ctx.save();
  ctx.globalAlpha = isSelected ? 0.45 : 0.3;
  ctx.fillStyle = colorStr;
  ctx.beginPath();
  ctx.arc(center, center, glowRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 2. Concentric ring
  ctx.save();
  ctx.strokeStyle = isSelected ? '#ffffff' : colorStr;
  ctx.lineWidth = isSelected ? 2.5 : 1.5;
  ctx.shadowColor = colorStr;
  ctx.shadowBlur = isSelected ? 6 : 3;
  ctx.beginPath();
  ctx.arc(center, center, isSelected ? 8 : 5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // 3. Bright core
  ctx.save();
  ctx.fillStyle = isSelected ? colorStr : '#ffffff';
  ctx.beginPath();
  ctx.arc(center, center, isSelected ? 4 : 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  return canvas;
};

export default function CesiumGlobe({
  events,
  selectedEvent,
  onSelectEvent,
  onClearEvent,
  phase,
  viewMode,
  onViewModeChange
}: CesiumGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);

  // Sync refs to avoid stale closures in event handlers
  const phaseRef = useRef(phase);
  const selectedEventRef = useRef(selectedEvent);
  const eventsRef = useRef(events);
  const onSelectEventRef = useRef(onSelectEvent);
  const onClearEventRef = useRef(onClearEvent);

  const [streetViewAvailable, setStreetViewAvailable] = useState<boolean>(false);
  const [streetViewPanoId, setStreetViewPanoId] = useState<string | null>(null);

  useEffect(() => {
    phaseRef.current = phase;
    selectedEventRef.current = selectedEvent;
    eventsRef.current = events;
    onSelectEventRef.current = onSelectEvent;
    onClearEventRef.current = onClearEvent;
  }, [phase, selectedEvent, events, onSelectEvent, onClearEvent]);

  // Query Street View metadata when selectedEvent changes
  useEffect(() => {
    onViewModeChange('globe');
    setStreetViewAvailable(false);
    setStreetViewPanoId(null);

    if (!selectedEvent) return;
    const coords = extractCoordinates(selectedEvent.geometry);
    if (!coords) return;
    const [lon, lat] = coords;

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) return;

    const svMetaUrl = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${lat},${lon}&radius=20000&key=${apiKey}`;
    fetch(svMetaUrl)
      .then(res => res.json())
      .then(data => {
        if (data.status === 'OK' && data.pano_id) {
          setStreetViewAvailable(true);
          setStreetViewPanoId(data.pano_id);
        }
      })
      .catch(() => {});
  }, [selectedEvent]);

  // Initialize Cesium Viewer
  useEffect(() => {
    if (!containerRef.current) return;

    const viewer = new Cesium.Viewer(containerRef.current, {
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      baseLayerPicker: false,
      navigationHelpButton: false,
      animation: false,
      timeline: false,
      fullscreenButton: false,
      infoBox: false,
      selectionIndicator: false,
      scene3DOnly: true,
      // Load Cesium World Terrain
      terrain: Cesium.Terrain.fromWorldTerrain(),
    });

    viewer.scene.globe.enableLighting = true;
    viewer.scene.globe.depthTestAgainstTerrain = true;

    // Set dark space-themed background colors
    viewer.scene.backgroundColor = Cesium.Color.BLACK;
    if (viewer.scene.skyAtmosphere) {
      viewer.scene.skyAtmosphere.show = true;
    }

    // Load Cesium OSM Buildings for 3D landmarks and city structures
    Cesium.Cesium3DTileset.fromIonAssetId(96188).then(tileset => {
      viewer.scene.primitives.add(tileset);
    }).catch(err => {
      console.warn('Failed to load Cesium OSM Buildings:', err);
    });

    // Adjust camera to far global view initially
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(0, 20, 15000000),
      orientation: {
        heading: 0,
        pitch: Cesium.Math.toRadians(-90),
        roll: 0
      }
    });

    viewerRef.current = viewer;

    // Click handler for picking entities
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((click: any) => {
      const pickedObject = viewer.scene.pick(click.position);
      if (Cesium.defined(pickedObject) && pickedObject.id instanceof Cesium.Entity) {
        const entityId = pickedObject.id.id;
        const matched = eventsRef.current.find(ev => ev.id === entityId);
        if (matched) {
          onSelectEventRef.current(matched);
        }
      } else {
        onClearEventRef.current();
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // Mouse hover handler to show pointer cursor and interact with custom cursor on markers
    handler.setInputAction((movement: any) => {
      const pickedObject = viewer.scene.pick(movement.endPosition);
      if (Cesium.defined(pickedObject) && pickedObject.id instanceof Cesium.Entity) {
        viewer.scene.canvas.style.cursor = 'pointer';
        viewer.scene.canvas.setAttribute('data-cursor', 'pointer');
      } else {
        viewer.scene.canvas.style.cursor = 'default';
        viewer.scene.canvas.removeAttribute('data-cursor');
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    // Track user interaction state manually via mouse/touch events on canvas
    let isUserInteracting = false;
    const canvas = viewer.scene.canvas;
    const setInteractingTrue = () => { isUserInteracting = true; };
    const setInteractingFalse = () => { isUserInteracting = false; };

    canvas.addEventListener('mousedown', setInteractingTrue);
    canvas.addEventListener('mouseup', setInteractingFalse);
    canvas.addEventListener('touchstart', setInteractingTrue);
    canvas.addEventListener('touchend', setInteractingFalse);

    // Idle rotation listener
    const removePreRender = viewer.scene.preRender.addEventListener(() => {
      // Rotate slowly if in intro phase or if no event is selected and user is not dragging
      if ((phaseRef.current === 'intro' || !selectedEventRef.current) && !isUserInteracting) {
        viewer.camera.rotate(Cesium.Cartesian3.UNIT_Z, 0.0004);
      }
    });

    return () => {
      removePreRender();
      handler.destroy();
      canvas.removeEventListener('mousedown', setInteractingTrue);
      canvas.removeEventListener('mouseup', setInteractingFalse);
      canvas.removeEventListener('touchstart', setInteractingTrue);
      canvas.removeEventListener('touchend', setInteractingFalse);
      viewer.destroy();
      viewerRef.current = null;
    };
  }, []); // Run once on mount

  // Sync events & markers
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    viewer.entities.removeAll();

    events.forEach(event => {
      const coords = extractCoordinates(event.geometry);
      if (!coords) return;
      const [lon, lat] = coords;

      const categoryId = event.categories[0]?.id || '';
      const color = getCategoryColor(categoryId);
      const isSelected = selectedEvent?.id === event.id;

      viewer.entities.add({
        id: event.id,
        position: Cesium.Cartesian3.fromDegrees(lon, lat),
        billboard: {
          image: createMarkerImage(color.toCssColorString(), isSelected),
          verticalOrigin: Cesium.VerticalOrigin.CENTER,
          horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
        },
        label: {
          text: event.title,
          font: isSelected ? 'bold 11px monospace' : '10px monospace',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, isSelected ? -28 : -18),
          // Only show label when camera is close
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 1800000)
        }
      });
    });
  }, [events, selectedEvent]);

  // Sync camera positions when selection shifts or new category events load
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    if (selectedEvent) {
      const coords = extractCoordinates(selectedEvent.geometry);
      if (coords) {
        const [lon, lat] = coords;
        const isMobile = window.innerWidth <= 768;
        const latOffset = isMobile ? 0.8 : 1.05;
        const pitchAngle = isMobile ? -35 : -35;
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(lon, lat - latOffset, 80000), // Center the point correctly based on pitch angle
          orientation: {
            heading: Cesium.Math.toRadians(0), // Facing North
            pitch: Cesium.Math.toRadians(pitchAngle), // Tilt matching the latitude offset
            roll: 0.0
          },
          duration: 2.2
        });
      }
    } else if (phase !== 'intro') {
      // If no event is selected, fly to the geographical center (centroid) of the loaded events
      if (events && events.length > 0) {
        let totalLon = 0;
        let totalLat = 0;
        let count = 0;

        events.forEach(ev => {
          const coords = extractCoordinates(ev.geometry);
          if (coords) {
            totalLon += coords[0];
            totalLat += coords[1];
            count++;
          }
        });

        if (count > 0) {
          const avgLon = totalLon / count;
          const avgLat = totalLat / count;

          viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(avgLon, avgLat, 8000000), // Overview centered on concentration of events
            orientation: {
              heading: 0,
              pitch: Cesium.Math.toRadians(-90), // Directly top-down
              roll: 0
            },
            duration: 2.5
          });
          return;
        }
      }

      // Fallback fly back out when event is deselected
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(viewer.camera.positionCartographic.longitude * (180 / Math.PI), 20, 15000000),
        orientation: {
          heading: viewer.camera.heading,
          pitch: Cesium.Math.toRadians(-90),
          roll: 0
        },
        duration: 2.0
      });
    }
  }, [selectedEvent, phase, events]);

  const zoomIn = () => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const camera = viewer.camera;
    const height = camera.positionCartographic.height;
    camera.zoomIn(height * 0.3);
  };

  const zoomOut = () => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const camera = viewer.camera;
    const height = camera.positionCartographic.height;
    camera.zoomOut(height * 0.35);
  };

  return (
    <div style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 0 }}>
      {/* Globe Container */}
      <div 
        ref={containerRef} 
        style={{ 
          width: '100%', 
          height: '100%',
          visibility: viewMode === 'globe' ? 'visible' : 'hidden' 
        }} 
      />

      {/* Full-Screen Street View Container overlay */}
      {viewMode === 'street' && streetViewPanoId && (
        <div className="street-view-fullscreen-container">
          <iframe
            title="Full Screen Street View"
            width="100%"
            height="100%"
            style={{ border: 0 }}
            loading="lazy"
            allowFullScreen
            src={`https://www.google.com/maps/embed/v1/streetview?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&pano=${streetViewPanoId}&heading=0&pitch=0&fov=90`}
          />
        </div>
      )}

      {/* Control Overlay (Zoom & View Swap) */}
      {phase !== 'intro' && (
        <div className="cesium-controls-wrapper">
          {/* Zoom Controls (only in Globe mode) */}
          {viewMode === 'globe' && (
            <div className="cesium-zoom-controls">
              <button className="cesium-zoom-btn" onClick={zoomIn} aria-label="Zoom In">+</button>
              <button className="cesium-zoom-btn" onClick={zoomOut} aria-label="Zoom Out">-</button>
            </div>
          )}

          {/* View Mode Swap Button */}
          {selectedEvent && streetViewAvailable && (
            <button 
              className={`cesium-swap-btn ${viewMode === 'street' ? 'active' : ''}`}
              onClick={() => onViewModeChange(viewMode === 'globe' ? 'street' : 'globe')}
              aria-label="Toggle View Mode"
              title={viewMode === 'globe' ? 'Switch to Street View' : 'Switch to Globe View'}
            >
              {viewMode === 'globe' ? (
                <span className="swap-btn-content">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 21h16" opacity="0.4" />
                    <path d="M6 18h12" opacity="0.6" />
                    <circle cx="12" cy="5" r="2.5" />
                    <path d="M12 7.5v7.5" />
                    <path d="M9 10h6" />
                    <path d="M9 21v-6h6v6" />
                  </svg>
                  <span className="swap-btn-text">STREET LEVEL SURVEY</span>
                </span>
              ) : (
                <span className="swap-btn-content">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                    <path d="M2 12h20" />
                  </svg>
                  <span className="swap-btn-text">GLOBE VIEW</span>
                </span>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
