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

  // Satellite Tracking & Animation Refs
  const satelliteEntityRef = useRef<Cesium.Entity | null>(null);
  const telemetryBeamEntityRef = useRef<Cesium.Entity | null>(null);
  const groundRippleEntityRef = useRef<Cesium.Entity | null>(null);

  const isAnimatingRef = useRef<boolean>(false);
  const animationPhaseRef = useRef<'orbit' | 'flight' | 'beam' | 'transition'>('orbit');
  const animationStartTimeRef = useRef<number>(0);
  const startPosRef = useRef<Cesium.Cartesian3 | null>(null);
  const targetPosRef = useRef<Cesium.Cartesian3 | null>(null);
  const eventGroundPosRef = useRef<Cesium.Cartesian3 | null>(null);
  const satellitePositionRef = useRef<Cesium.Cartesian3>(Cesium.Cartesian3.fromDegrees(0, 0, 400000));
  const satelliteOrientationRef = useRef<Cesium.Quaternion>(new Cesium.Quaternion());
  const normalOrbitAngleRef = useRef<number>(0);
  const groundRippleRadiusRef = useRef<number>(0);

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

    // Add 3D Satellite Model
    const satelliteEntity = viewer.entities.add({
      id: 'satellite-core',
      position: new Cesium.CallbackProperty(() => Cesium.Cartesian3.clone(satellitePositionRef.current), false) as any,
      orientation: new Cesium.CallbackProperty(() => Cesium.Quaternion.clone(satelliteOrientationRef.current), false) as any,
      model: {
        uri: window.location.origin + '/satellite.glb',
        minimumPixelSize: 160,
        maximumScale: 50000,
        scale: 25000.0
      }
    });
    satelliteEntityRef.current = satelliteEntity;

    // Add Telemetry Beam Polyline (continuous orange ray gun beam)
    const telemetryBeamEntity = viewer.entities.add({
      id: 'satellite-telemetry-beam',
      polyline: {
        positions: new Cesium.CallbackProperty(() => {
          if (selectedEventRef.current && animationPhaseRef.current !== 'flight' && targetPosRef.current && eventGroundPosRef.current) {
            return [targetPosRef.current, eventGroundPosRef.current];
          }
          return [];
        }, false),
        width: 2.0,
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.2,
          color: Cesium.Color.fromCssColorString('#f97316'), // glowing orange ray
          taperPower: 1.0
        }),
        show: new Cesium.CallbackProperty(() => {
          return selectedEventRef.current && animationPhaseRef.current !== 'flight';
        }, false)
      }
    });
    telemetryBeamEntityRef.current = telemetryBeamEntity;

    // Add Ground-level Radar Ripple Ellipse (orange pulse)
    const groundRippleEntity = viewer.entities.add({
      id: 'satellite-ground-ripple',
      position: new Cesium.CallbackProperty(() => {
        return eventGroundPosRef.current 
          ? Cesium.Cartesian3.clone(eventGroundPosRef.current) 
          : Cesium.Cartesian3.fromDegrees(0, 0, 0);
      }, false) as any,
      ellipse: {
        semiMajorAxis: new Cesium.CallbackProperty(() => Math.max(1.0, groundRippleRadiusRef.current), false),
        semiMinorAxis: new Cesium.CallbackProperty(() => Math.max(1.0, groundRippleRadiusRef.current), false),
        material: new Cesium.ColorMaterialProperty(
          new Cesium.CallbackProperty(() => {
            if (animationPhaseRef.current === 'beam') {
              const elapsed = Math.min(1.0, (Date.now() - animationStartTimeRef.current) / 1200);
              return Cesium.Color.fromCssColorString('#f97316').withAlpha(0.65 * (1.0 - elapsed));
            }
            return Cesium.Color.TRANSPARENT;
          }, false)
        ),
        height: 0,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        show: new Cesium.CallbackProperty(() => animationPhaseRef.current === 'beam', false)
      }
    });
    groundRippleEntityRef.current = groundRippleEntity;

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

    // Idle rotation + Satellite Orbit and Chase Camera Loop
    const removePreRender = viewer.scene.preRender.addEventListener(() => {
      // 1. Advance the normal orbit angle
      normalOrbitAngleRef.current += 0.0003;
      
      const phase = phaseRef.current;
      const selectedEvent = selectedEventRef.current;

      // 2. Perform updates depending on active animation state
      if (animationPhaseRef.current === 'orbit') {
        groundRippleRadiusRef.current = 0;
        if (selectedEventRef.current && targetPosRef.current) {
          satellitePositionRef.current = targetPosRef.current;
        } else {
          const rad = normalOrbitAngleRef.current;
          const radius = 6378137 + 400000;
          const inc = Cesium.Math.toRadians(45);
          const x = radius * Math.cos(rad);
          const y = radius * Math.sin(rad) * Math.cos(inc);
          const z = radius * Math.sin(rad) * Math.sin(inc);
          satellitePositionRef.current = new Cesium.Cartesian3(x, y, z);
        }

        // Idle rotate if in intro/category phase and not interacting
        if ((phase === 'intro' || !selectedEvent) && !isUserInteracting) {
          viewer.camera.rotate(Cesium.Cartesian3.UNIT_Z, 0.0004);
        }
      }
      else if (animationPhaseRef.current === 'flight') {
        groundRippleRadiusRef.current = 0;
        const startTime = animationStartTimeRef.current;
        const elapsed = Date.now() - startTime;
        const duration = 3500; // 3.5s flight time
        let t = Math.min(1.0, elapsed / duration);
        
        // easeInOutCubic curve
        t = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

        const startPos = startPosRef.current || new Cesium.Cartesian3();
        const targetPos = targetPosRef.current || new Cesium.Cartesian3();

        const startCart = Cesium.Cartographic.fromCartesian(startPos);
        const targetCart = Cesium.Cartographic.fromCartesian(targetPos);
        
        let diffLon = targetCart.longitude - startCart.longitude;
        if (diffLon > Math.PI) diffLon -= Math.PI * 2;
        if (diffLon < -Math.PI) diffLon += Math.PI * 2;
        
        const currentLat = startCart.latitude + (targetCart.latitude - startCart.latitude) * t;
        const currentLon = startCart.longitude + diffLon * t;
        
        const currentPos = Cesium.Cartesian3.fromRadians(currentLon, currentLat, 400000);
        satellitePositionRef.current = currentPos;

        if (elapsed >= duration) {
          animationPhaseRef.current = 'beam';
          animationStartTimeRef.current = Date.now();
        }
      }
      else if (animationPhaseRef.current === 'beam') {
        const startTime = animationStartTimeRef.current;
        const elapsed = Date.now() - startTime;
        const duration = 1200; // 1.2s beam discharge duration

        // Update ground ripple expansion radius (splash radius up to 500km)
        const beamElapsed = Math.min(1.0, elapsed / duration);
        groundRippleRadiusRef.current = beamElapsed * 500000;

        const currentPos = targetPosRef.current || new Cesium.Cartesian3();
        satellitePositionRef.current = currentPos;

        if (elapsed >= duration) {
          animationPhaseRef.current = 'transition';
          animationStartTimeRef.current = Date.now();

          // Smoothly release and zoom down to final event focus
          if (selectedEventRef.current) {
            const coords = extractCoordinates(selectedEventRef.current.geometry);
            if (coords) {
              const [lon, lat] = coords;
              const isMobile = window.innerWidth <= 768;
              const latOffset = isMobile ? 0.8 : 1.05;
              const pitchAngle = isMobile ? -35 : -35;
              viewer.camera.flyTo({
                destination: Cesium.Cartesian3.fromDegrees(lon, lat - latOffset, 80000),
                orientation: {
                  heading: Cesium.Math.toRadians(0),
                  pitch: Cesium.Math.toRadians(pitchAngle),
                  roll: 0.0
                },
                duration: 2.0,
                complete: () => {
                  isAnimatingRef.current = false;
                  animationPhaseRef.current = 'orbit';
                }
              });
            }
          }
        }
      }
      else if (animationPhaseRef.current === 'transition') {
        groundRippleRadiusRef.current = 0;
        if (targetPosRef.current) {
          satellitePositionRef.current = targetPosRef.current;
        }
      }

      // 3. Update satellite orientation ref based on current frame position
      if (satellitePositionRef.current && Cesium.Cartesian3.magnitude(satellitePositionRef.current) > 1.0) {
        const matrix = Cesium.Transforms.eastNorthUpToFixedFrame(satellitePositionRef.current);
        const rotationMatrix = Cesium.Matrix4.getMatrix3(matrix, new Cesium.Matrix3());
        satelliteOrientationRef.current = Cesium.Quaternion.fromRotationMatrix(rotationMatrix);
      }
    });

    return () => {
      removePreRender();
      handler.destroy();
      canvas.removeEventListener('mousedown', setInteractingTrue);
      canvas.removeEventListener('mouseup', setInteractingFalse);
      canvas.removeEventListener('touchstart', setInteractingTrue);
      canvas.removeEventListener('touchend', setInteractingFalse);

      // Clean up satellite entities
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        if (satelliteEntityRef.current) viewerRef.current.entities.remove(satelliteEntityRef.current);
        if (telemetryBeamEntityRef.current) viewerRef.current.entities.remove(telemetryBeamEntityRef.current);
        if (groundRippleEntityRef.current) viewerRef.current.entities.remove(groundRippleEntityRef.current);
      }

      viewer.destroy();
      viewerRef.current = null;
    };
  }, []); // Run once on mount

  // Sync events & markers
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    // Clear only non-satellite entities (markers)
    const entitiesToRemove: Cesium.Entity[] = [];
    for (let i = 0; i < viewer.entities.values.length; i++) {
      const entity = viewer.entities.values[i];
      if (!entity.id.startsWith('satellite-')) {
        entitiesToRemove.push(entity);
      }
    }
    entitiesToRemove.forEach(entity => viewer.entities.remove(entity));

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

  // Sync camera positions and satellite trajectory when selection shifts or new category events load
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    if (selectedEvent) {
      const coords = extractCoordinates(selectedEvent.geometry);
      if (coords) {
        const [lon, lat] = coords;
        const targetPos = Cesium.Cartesian3.fromDegrees(lon, lat, 400000);
        
        // Only start a new intercept animation if it's not already targeted
        const isAlreadyTarget = targetPosRef.current && 
          Cesium.Cartesian3.equalsEpsilon(targetPosRef.current, targetPos, 10.0);

        if (!isAlreadyTarget) {
          const eventGroundPos = Cesium.Cartesian3.fromDegrees(lon, lat, 0);
          startPosRef.current = Cesium.Cartesian3.clone(satellitePositionRef.current);
          targetPosRef.current = targetPos;
          eventGroundPosRef.current = eventGroundPos;
          
          animationPhaseRef.current = 'flight';
          animationStartTimeRef.current = Date.now();
          isAnimatingRef.current = true;

          // Smoothly fly camera to a third-person observation perspective of the region (1,500km altitude)
          const isMobile = window.innerWidth <= 768;
          const latOffset = isMobile ? 8.0 : 10.0;
          const altitude = isMobile ? 1200000 : 1500000;
          viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(lon, lat - latOffset, altitude),
            orientation: {
              heading: Cesium.Math.toRadians(0),
              pitch: Cesium.Math.toRadians(-40),
              roll: 0.0
            },
            duration: 3.5 // Matches the 3.5s satellite flight duration
          });
        }
      }
    } else {
      // Clear tracking if event deselected
      targetPosRef.current = null;
      eventGroundPosRef.current = null;
      animationPhaseRef.current = 'orbit';
      isAnimatingRef.current = false;

      if (phase !== 'intro') {
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
        const fallbackLon = viewer.camera.positionCartographic
          ? viewer.camera.positionCartographic.longitude * (180 / Math.PI)
          : 0;
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(fallbackLon, 20, 15000000),
          orientation: {
            heading: viewer.camera.heading,
            pitch: Cesium.Math.toRadians(-90),
            roll: 0
          },
          duration: 2.0
        });
      }
    }
  }, [selectedEvent, phase, events]);

  const zoomIn = () => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const camera = viewer.camera;
    const height = camera.positionCartographic?.height ?? 3500000;
    camera.zoomIn(height * 0.3);
  };

  const zoomOut = () => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const camera = viewer.camera;
    const height = camera.positionCartographic?.height ?? 3500000;
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
