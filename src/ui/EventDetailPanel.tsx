import { useState, useEffect } from 'react';
import './EventDetailPanel.css';
import type { EonetEvent, EonetLayer } from '../data/types';
import { fetchLayersByCategory } from '../data/eonet';
import { extractCoordinates } from '../data/coordinates';
import ShinyText from '../animations/ShinyText';
import CountUp from '../animations/CountUp';

// ── Source agency name mapping ───────────────────────────────────
const SOURCE_NAMES: Record<string, string> = {
  IRWIN:      'IRWIN — Wildland Fire Intelligence',
  USGS_EHP:   'USGS Earthquake Hazards Program',
  BYU_ICE:    'BYU National Ice Center',
  GDACS:      'Global Disaster Alert & Coord. System',
  PDC:        'Pacific Disaster Center',
  MBFIRE:     'Montana BLM Fire',
  ABFIRE:     'Alberta Wildfire',
  CALFIRE:    'CAL FIRE',
  USFS_RMRS:  'USDA Forest Service',
  EO:         'NASA Earth Observatory',
  SIVolcano:  'Smithsonian GVP (Volcanoes)',
  NOAA_NHC:   'NOAA National Hurricane Center',
  ReliefWeb:  'UN OCHA ReliefWeb',
  InciWeb:    'InciWeb Incident Information',
};

// ── Magnitude unit → readable label ─────────────────────────────
const UNIT_LABELS: Record<string, string> = {
  acres:     'Acres burned',
  hectares:  'Hectares burned',
  kts:       'Wind speed',
  mb:        'Central pressure',
  MW:        'Radiative power',
  km:        'Estimated size',
};

const UNIT_SHORT: Record<string, string> = {
  acres:     'ac',
  hectares:  'ha',
  kts:       'kts',
  mb:        'mb',
  MW:        'MW',
  km:        'km',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCHours().toString().padStart(2, '0')}:${d.getUTCMinutes().toString().padStart(2, '0')} UTC`;
}

function formatCoords(lon: number, lat: number): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lonDir = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(3)}° ${latDir}, ${Math.abs(lon).toFixed(3)}° ${lonDir}`;
}

export default function EventDetailPanel({
  event,
  onClose,
  mobileExpanded = false,
  onToggleExpand,
}: {
  event: EonetEvent;
  onClose: () => void;
  mobileExpanded?: boolean;
  onToggleExpand?: () => void;
}) {
  const latest = event.geometry[event.geometry.length - 1];
  const dateStr = latest ? formatDate(latest.date) : '';
  const category = event.categories[0];
  const coords = extractCoordinates(event.geometry);
  const hasCoords = coords !== null;
  const [lon, lat] = coords || [0, 0];

  const hasMagnitude = latest?.magnitudeValue != null && latest?.magnitudeUnit;
  const magLabel = latest?.magnitudeUnit ? (UNIT_LABELS[latest.magnitudeUnit] ?? latest.magnitudeUnit) : '';
  const magUnit = latest?.magnitudeUnit ? (UNIT_SHORT[latest.magnitudeUnit] ?? '') : '';

  interface SettlementDetails {
    formattedAddress: string;
    locality?: string;
    adminArea1?: string;
    country?: string;
    postalCode?: string;
  }

  interface PollutantItem {
    code: string;
    name: string;
    fullName: string;
    value: number;
    units: string;
  }

  interface AirQualityDetails {
    aqi: number;
    category: string;
    pollutant: string;
    pollutantsList: PollutantItem[];
  }

  const [layers, setLayers] = useState<EonetLayer[]>([]);
  const [settlement, setSettlement] = useState<SettlementDetails | null>(null);
  const [airQuality, setAirQuality] = useState<AirQualityDetails | null>(null);
  const [loadingTelemetry, setLoadingTelemetry] = useState<boolean>(false);

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    if (category?.id) {
      fetchLayersByCategory(category.id)
        .then(setLayers)
        .catch(err => console.error('Failed to load layers', err));
    }
  }, [category?.id]);

  useEffect(() => {
    if (!hasCoords || !apiKey) {
      setSettlement(null);
      setAirQuality(null);
      return;
    }

    setLoadingTelemetry(true);
    setSettlement(null);
    setAirQuality(null);

    // 1. Reverse Geocoding for Settlement resolution
    const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${apiKey}`;
    const geocodePromise = fetch(geoUrl)
      .then(res => res.json())
      .then(data => {
        if (data.status === 'OK' && data.results && data.results.length > 0) {
          const firstResult = data.results[0];
          const details: SettlementDetails = {
            formattedAddress: firstResult.formatted_address,
          };

          firstResult.address_components.forEach((comp: any) => {
            if (comp.types.includes('locality')) {
              details.locality = comp.long_name;
            }
            if (comp.types.includes('administrative_area_level_1')) {
              details.adminArea1 = comp.long_name;
            }
            if (comp.types.includes('country')) {
              details.country = comp.long_name;
            }
            if (comp.types.includes('postal_code')) {
              details.postalCode = comp.long_name;
            }
          });

          setSettlement(details);
        } else {
          setSettlement(null);
        }
      })
      .catch(() => setSettlement(null));

    // 2. Air Quality Lookup
    const aqUrl = `https://airquality.googleapis.com/v1/currentConditions:lookup?key=${apiKey}`;
    const aqPromise = fetch(aqUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: { latitude: lat, longitude: lon }
      })
    })
      .then(res => res.json())
      .then(data => {
        if (data && data.indexes && data.indexes.length > 0) {
          const idx = data.indexes[0];
          const list = (data.pollutants || []).map((p: any) => ({
            code: p.code,
            name: p.displayName,
            fullName: p.fullName,
            value: p.concentration?.value || 0,
            units: p.concentration?.units === 'MICROGRAMS_PER_CUBIC_METER' ? 'µg/m³' :
                   p.concentration?.units === 'PARTS_PER_BILLION' ? 'ppb' :
                   p.concentration?.units === 'PARTS_PER_MILLION' ? 'ppm' :
                   p.concentration?.units || ''
          }));

          setAirQuality({
            aqi: idx.aqi,
            category: idx.category || 'Unknown',
            pollutant: idx.dominantPollutant ? idx.dominantPollutant.toUpperCase() : 'N/A',
            pollutantsList: list
          });
        }
      })
      .catch(() => {});

    Promise.allSettled([geocodePromise, aqPromise]).then(() => {
      setLoadingTelemetry(false);
    });
  }, [lat, lon, apiKey, hasCoords]);

  return (
    <div
      className={`dp-overlay${mobileExpanded ? ' dp-overlay--mobile-expanded' : ''}`}
      id="detail-panel"
      role="dialog"
      aria-modal="true"
    >
      {/* Mobile sheet drag/tap handle */}
      <div className="sheet-handle" onClick={onToggleExpand} />
      <div className="dp-content">
        <button className="dp-close" id="detail-close-btn" onClick={onClose} aria-label="Close">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <line x1="1" y1="1" x2="13" y2="13" stroke="currentColor" strokeWidth="1" strokeLinecap="square"/>
            <line x1="13" y1="1" x2="1" y2="13" stroke="currentColor" strokeWidth="1" strokeLinecap="square"/>
          </svg>
        </button>

        {/* Category + date row */}
        <div className="dp-meta-row">
          {category && (
            <span className="dp-category">
              <ShinyText
                text={category.title.toUpperCase()}
                speed={3}
                color="rgba(255, 255, 255, 0.7)"
                shineColor="#fff"
                spread={100}
              />
            </span>
          )}
          {dateStr && <span className="dp-date">{dateStr}</span>}
        </div>

        {/* Title */}
        <h2 className="dp-title">{event.title}</h2>

        {/* Description (if provided by NASA) */}
        {event.description && <p className="dp-desc">{event.description}</p>}

        {/* ── Data cards ───────────────────────── */}
        <div className="dp-cards">
          {/* Coordinates */}
          {hasCoords && (
            <div className="dp-card">
              <span className="dp-card-label">Last Coordinates</span>
              <span className="dp-card-value">{formatCoords(lon, lat)}</span>
              {latest?.date && <span className="dp-card-sub">Updated at {formatTime(latest.date)}</span>}
            </div>
          )}

          {/* Magnitude */}
          {hasMagnitude && (
            <div className="dp-card">
              <span className="dp-card-label">{magLabel}</span>
              <span className="dp-card-value dp-card-value--accent">
                <CountUp
                  to={Number(latest.magnitudeValue)}
                  duration={1.2}
                  separator=","
                />
                <span className="dp-card-unit"> {magUnit}</span>
              </span>
              <span className="dp-card-sub">Recorded value</span>
            </div>
          )}

          {/* Observation Status */}
          <div className="dp-card">
            <span className="dp-card-label">Observation Status</span>
            {event.closed ? (
              <>
                <span className="dp-card-value dp-card-value--closed">ARCHIVAL RECORD</span>
                <span className="dp-card-sub">Closed on {formatDate(event.closed)}</span>
              </>
            ) : (
              <>
                <span className="dp-card-value dp-card-value--open">ACTIVE INCIDENT</span>
                <span className="dp-card-sub">Real-time telemetry monitoring</span>
              </>
            )}
          </div>

          {/* Satellite observer note */}
          <div className="dp-card dp-card--satellite">
            <span className="dp-card-label">Observed by</span>
            <span className="dp-card-value">Earth Observation System</span>
            <span className="dp-card-sub">MODIS / VIIRS orbiters</span>
          </div>

          {/* Extended Google Telemetry Link Offline Warn */}
          {!apiKey && (
            <div className="dp-card dp-card--warning">
              <span className="dp-card-label">Extended Location Telemetry</span>
              <span className="dp-card-value" style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.4)' }}>LINK OFFLINE (API key missing)</span>
            </div>
          )}

          {/* Extended Telemetry Loading State */}
          {apiKey && loadingTelemetry && (
            <div className="dp-card dp-card--telemetry-loading">
              <span className="dp-card-label">Extended Telemetry Query</span>
              <span className="dp-card-value telemetry-blink">ESTABLISHING LINK...</span>
              <span className="dp-card-sub">Connecting to Google Maps & Air Quality APIs</span>
            </div>
          )}

          {/* Nearest Settlement Card */}
          {apiKey && !loadingTelemetry && settlement && (
            <div className="dp-card dp-card--settlement">
              <span className="dp-card-label">Nearest Settlement</span>
              <span className="dp-card-value" style={{ fontSize: '1rem', lineHeight: '1.25' }}>
                {settlement.locality || 'Remote Region'}
              </span>
              <div className="dp-telemetry-details">
                {settlement.adminArea1 && (
                  <div className="dp-tel-row">
                    <span className="dp-tel-key">ADMIN AREA</span>
                    <span className="dp-tel-val">{settlement.adminArea1}</span>
                  </div>
                )}
                {settlement.country && (
                  <div className="dp-tel-row">
                    <span className="dp-tel-key">TERRITORY</span>
                    <span className="dp-tel-val">{settlement.country}</span>
                  </div>
                )}
                {settlement.postalCode && (
                  <div className="dp-tel-row">
                    <span className="dp-tel-key">POSTAL INDEX</span>
                    <span className="dp-tel-val">{settlement.postalCode}</span>
                  </div>
                )}
                <div className="dp-tel-row" style={{ marginTop: '4px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '4px' }}>
                  <span className="dp-tel-key">FULL LOCATOR</span>
                  <span className="dp-tel-val" style={{ textAlign: 'left', display: 'block', opacity: 0.6, fontSize: '0.68rem', textTransform: 'none' }}>{settlement.formattedAddress}</span>
                </div>
              </div>
            </div>
          )}

          {/* Air Quality Card */}
          {apiKey && !loadingTelemetry && airQuality && (
            <div className="dp-card dp-card--air-quality">
              <span className="dp-card-label">Air Quality Index (AQI)</span>
              <span className="dp-card-value dp-card-value--accent">
                {airQuality.aqi} <span style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.5)' }}>({airQuality.category})</span>
              </span>
              <span className="dp-card-sub" style={{ marginBottom: '8px' }}>Dominant Pollutant: {airQuality.pollutant}</span>

              {airQuality.pollutantsList && airQuality.pollutantsList.length > 0 && (
                <div className="dp-telemetry-details" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '6px' }}>
                  <span className="dp-tel-section-title">POLLUTANT INVENTORY</span>
                  {airQuality.pollutantsList.map((p, idx) => (
                    <div key={idx} className="dp-tel-row">
                      <span className="dp-tel-key">{p.name} <span style={{ opacity: 0.4 }}>({p.fullName})</span></span>
                      <span className="dp-tel-val">{p.value.toFixed(1)} {p.units}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}


          {/* NASA GIBS mapped remote sensing layers */}
          {layers.length > 0 && (
            <div className="dp-card dp-card--layers">
              <span className="dp-card-label">NASA GIBS Satellite Bands</span>
              <div className="dp-layer-list">
                {layers.slice(0, 3).map((layer, index) => (
                  <div key={index} className="dp-layer-item">
                    <span className="dp-layer-name">{layer.name.replace(/_/g, ' ')}</span>
                    <span className="dp-layer-type">{layer.serviceType} Feed</span>
                  </div>
                ))}
                {layers.length > 3 && (
                  <span className="dp-layer-more">+ {layers.length - 3} additional satellite feeds</span>
                )}
              </div>
            </div>
          )}

          {/* Incident Track Path Timeline (if event is tracking coordinates over time) */}
          {event.geometry.length > 1 && (
            <div className="dp-card dp-card--track">
              <span className="dp-card-label">Incident Track History</span>
              <div className="dp-track-timeline">
                {event.geometry.slice().reverse().map((geom, idx) => {
                  let trackCoords: [number, number] | null = null;
                  if (geom.type === 'Point' && Array.isArray(geom.coordinates)) {
                    const coords = geom.coordinates as number[];
                    trackCoords = [coords[0], coords[1]];
                  } else if (geom.type === 'Polygon' && Array.isArray(geom.coordinates)) {
                    const coords = geom.coordinates as any;
                    if (Array.isArray(coords[0])) {
                      if (Array.isArray(coords[0][0]) && typeof coords[0][0][0] === 'number') {
                        trackCoords = [coords[0][0][0], coords[0][0][1]];
                      } else if (typeof coords[0][0] === 'number') {
                        trackCoords = [coords[0][0], coords[0][1]];
                      }
                    }
                  }
                  if (!trackCoords) return null;
                  const [gLon, gLat] = trackCoords;
                  const gDate = formatDate(geom.date);
                  const gTime = formatTime(geom.date);
                  const trackMag = geom.magnitudeValue != null && geom.magnitudeUnit
                    ? `${geom.magnitudeValue} ${UNIT_SHORT[geom.magnitudeUnit] ?? geom.magnitudeUnit}`
                    : null;
                  return (
                    <div key={idx} className="dp-track-point">
                      <div className="dp-track-bullet" />
                      <div className="dp-track-info">
                        <div className="dp-track-row">
                          <span className="dp-track-date">{gDate}</span>
                          <span className="dp-track-time">{gTime}</span>
                        </div>
                        <div className="dp-track-coords">{formatCoords(gLon, gLat)}</div>
                        {trackMag && <div className="dp-track-mag">{trackMag}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Data sources grid ─────────────────── */}
        {event.sources && event.sources.length > 0 && (
          <div className="dp-sources-block">
            <span className="dp-sources-title">Reporting Agencies</span>
            <div className="dp-sources-grid">
              {event.sources.map(src => {
                const sName = SOURCE_NAMES[src.id] ?? src.id;
                return (
                  <a
                    key={src.id}
                    className="dp-source-pill"
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span className="dp-pill-name">{sName}</span>
                    <svg className="dp-pill-arrow" width="8" height="8" viewBox="0 0 10 10" fill="none">
                      <path d="M1 9L9 1M9 1H3M9 1V7" stroke="currentColor" strokeWidth="1" strokeLinecap="square"/>
                    </svg>
                  </a>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
