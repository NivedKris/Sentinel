import { useReducer, useCallback, useRef, useState, useEffect } from 'react';
import CesiumGlobe from './scene/CesiumGlobe';
import './styles/global.css';
import './App.css';

import Wordmark from './ui/Wordmark';
import StatusLine from './ui/StatusLine';
import CategoryList from './ui/CategoryList';
import EventList from './ui/EventList';
import EventDetailPanel from './ui/EventDetailPanel';
import TimeDisplay from './ui/TimeDisplay';
import Cursor from './ui/Cursor';
import LogoLoop from './ui/LogoLoop';

import { appReducer, initialState } from './state/appReducer';
import { fetchEventsByCategory, fetchSources } from './data/eonet';
import type { AppCategory, EonetEvent, EonetSourceDetail, FetchEventsOptions } from './data/types';
import { extractCoordinates } from './data/coordinates';

// ── ReactBits Animations ──
import Galaxy from './animations/Galaxy';
import CountUp from './animations/CountUp';
import DecryptedText from './animations/DecryptedText';
import GlitchText from './animations/GlitchText';
import ClickSpark from './animations/ClickSpark';
import StarBorder from './animations/StarBorder';

function formatDate(iso: string): string {
  const d = new Date(iso);
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function formatCoords(lon: number, lat: number): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lonDir = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(3)}° ${latDir}, ${Math.abs(lon).toFixed(3)}° ${lonDir}`;
}

const getCategoryColorHex = (id: string): string => {
  switch (id) {
    case 'wildfires': return '#FF5533';
    case 'severeStorms': return '#3399FF';
    case 'volcanoes': return '#FFCC00';
    case 'waterIce': return '#00FFCC';
    default: return '#FFFFFF';
  }
};

const partnerLogos = [
  { src: '/logos/nasa.svg', alt: 'NASA', href: 'https://www.nasa.gov' },
  { src: '/logos/google-maps.svg', alt: 'Google Maps', href: 'https://mapsplatform.google.com' },
  { src: '/logos/lockheed.svg', alt: 'Lockheed Martin', href: 'https://www.lockheedmartin.com' },
  { src: '/logos/boeing.svg', alt: 'Boeing', href: 'https://www.boeing.com' },
  { src: '/logos/airbus.svg', alt: 'Airbus', href: 'https://www.airbus.com' },
  { src: '/logos/national-geographic.svg', alt: 'National Geographic', href: 'https://www.nationalgeographic.com' },
  { src: '/logos/siemens.svg', alt: 'Siemens', href: 'https://www.siemens.com' }
];

export default function App() {
  const [state, dispatch] = useReducer(appReducer, initialState);

  const [filters, setFilters] = useState<FetchEventsOptions>({
    status: 'open',
    days: 30,
    limit: 300,
    source: 'all',
  });
  const [sourcesList, setSourcesList] = useState<EonetSourceDetail[]>([]);

  // Fetch sources list once on startup
  useEffect(() => {
    fetchSources()
      .then(setSourcesList)
      .catch(err => console.error('Failed to load observing agencies list', err));
  }, []);

  // Fetch events whenever category or filter parameters change
  useEffect(() => {
    if (!state.selectedCategory) return;
    let active = true;

    const load = async () => {
      dispatch({ type: 'SET_LOADING', payload: true });
      try {
        const events = await fetchEventsByCategory(state.selectedCategory!.id, filters);
        if (active) {
          dispatch({ type: 'SET_EVENTS', payload: events });
        }
      } catch (err) {
        if (active) {
          dispatch({ type: 'SET_ERROR', payload: err instanceof Error ? err.message : 'Failed to fetch events.' });
        }
      } finally {
        if (active) {
          dispatch({ type: 'SET_LOADING', payload: false });
        }
      }
    };

    load();

    return () => {
      active = false;
    };
  }, [state.selectedCategory?.id, filters]);

  const [mobileListOpen, setMobileListOpen] = useState(false);
  const [mobileDetailExpanded, setMobileDetailExpanded] = useState(false);
  const [mobileCategoryMenuOpen, setMobileCategoryMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [viewMode, setViewMode] = useState<'globe' | 'street'>('globe');
  const [showCredits, setShowCredits] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isEntering, setIsEntering] = useState(false);
  const [introStep, setIntroStep] = useState<'video' | 'loading' | 'prompt'>('video');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('Initializing telemetry link...');
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Telemetry Initialization Sequence (loader)
  useEffect(() => {
    if (introStep !== 'loading') return;
    
    let progress = 0;
    const interval = setInterval(() => {
      progress += 1;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        setTimeout(() => {
          setIntroStep('prompt');
        }, 600);
      }
      setLoadingProgress(progress);

      if (progress < 25) {
        setLoadingMessage('Resolving orbit coordinates...');
      } else if (progress < 50) {
        setLoadingMessage('Decrypting NASA EONET feed...');
      } else if (progress < 75) {
        setLoadingMessage('Compiling satellite overlays...');
      } else {
        setLoadingMessage('Connection established // ready');
      }
    }, 100);

    return () => clearInterval(interval);
  }, [introStep]);

  const handleVideoDone = useCallback(() => {
    if (introStep === 'video') {
      setIntroStep('loading');
    }
  }, [introStep]);

  const handleEnter = useCallback(() => {
    if (isEntering) return;
    setIsEntering(true);
    if (audioRef.current) {
      audioRef.current.muted = false;
      audioRef.current.play().catch(err => {
        console.warn('Audio playback was blocked or failed:', err);
      });
    }
    setTimeout(() => {
      dispatch({ type: 'SET_PHASE', payload: 'category' });
    }, 1500);
  }, [isEntering]);

  const handleIntroClick = useCallback(() => {
    if (introStep === 'video') {
      handleVideoDone();
      // Start audio playing on skip click (user interaction)
      if (audioRef.current) {
        audioRef.current.muted = false;
        audioRef.current.play().catch(err => {
          console.warn('Audio play failed on video skip:', err);
        });
      }
    } else if (introStep === 'prompt') {
      handleEnter();
    }
  }, [introStep, handleVideoDone, handleEnter]);

  const toggleMute = useCallback(() => {
    if (audioRef.current) {
      const nextMuted = !isMuted;
      audioRef.current.muted = nextMuted;
      setIsMuted(nextMuted);
      if (!nextMuted && audioRef.current.paused) {
        audioRef.current.play().catch(err => {
          console.warn('Playback failed on toggle:', err);
        });
      }
    }
  }, [isMuted]);

  const handleSelectCategory = useCallback((category: AppCategory) => {
    dispatch({ type: 'SELECT_CATEGORY', payload: category });
    setMobileListOpen(false); // Reset list overlay on category load
    setMobileDetailExpanded(false);
    setMobileCategoryMenuOpen(false); // Collapse category list
  }, []);

  const handleSelectEvent = useCallback((event: EonetEvent) => {
    dispatch({ type: 'SELECT_EVENT', payload: event });
    setMobileListOpen(false); // Auto-close list overlay when event selected
    setMobileDetailExpanded(false); // Start collapsed for focused details
    setMobileCategoryMenuOpen(false); // Close category list on event focus
  }, []);

  const handleCloseEvent = useCallback(() => {
    dispatch({ type: 'CLEAR_EVENT' });
    setMobileDetailExpanded(false);
    setMobileCategoryMenuOpen(false);
  }, []);

  // Escape key event listener to close detailed view
  useEffect(() => {
    if (state.phase !== 'event') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCloseEvent();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.phase, handleCloseEvent]);

  const isIntro    = state.phase === 'intro';
  const isCategory = state.phase === 'category';
  const isEvent    = state.phase === 'event';

  return (
    <ClickSpark
      sparkColor="#ffffff"
      sparkSize={7}
      sparkRadius={22}
      sparkCount={8}
      duration={500}
      style={{ position: 'fixed', inset: 0 }}
    >
    <div className={`app ${viewMode === 'street' ? 'street-view-active' : ''} ${mobileDetailExpanded ? 'mobile-telemetry-expanded' : ''}`} id="app">
      <CesiumGlobe
        events={state.events}
        selectedEvent={state.selectedEvent}
        onSelectEvent={handleSelectEvent}
        onClearEvent={handleCloseEvent}
        phase={state.phase}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {/* Cinematic Video Background Intro */}
      {isIntro && (
        <div className={`intro ${isEntering ? 'intro--entering' : ''} ${introStep === 'prompt' ? 'intro--prompt' : ''}`} id="intro" onClick={handleIntroClick} style={{ cursor: 'pointer' }}>
          
          {/* 1. Cinematic Video Background Section */}
          <div className={`intro-step-section intro-step-video ${introStep === 'video' ? 'active' : 'fade-out'}`}>
            <video
              className="intro-video-bg"
              src="/into.mp4"
              autoPlay
              muted
              playsInline
              onEnded={handleVideoDone}
              onError={() => {
                console.log("Intro background video not found, running starry fallback");
              }}
            />
          </div>

          {/* 2. Loading Progress Section */}
          {(introStep === 'loading' || introStep === 'prompt') && (
            <div className={`intro-step-section intro-step-loading ${introStep === 'loading' ? 'active' : 'fade-out'}`}>
              <div className="intro-loader">
                {/* Galaxy WebGL Background */}
                <div className="loader-radar">
                  <Galaxy
                    density={2.0}
                    speed={0.5}
                    starSpeed={0.3}
                    glowIntensity={0.4}
                    twinkleIntensity={0.6}
                    rotationSpeed={0.05}
                    saturation={0.0}
                    mouseInteraction={true}
                    mouseRepulsion={true}
                    repulsionStrength={2.5}
                    transparent={true}
                  />
                </div>
                <div className="loader-container">
                  <div className="loader-glitch-title">SENTINEL</div>
                  <div className="loader-bar-track">
                    <div className="loader-bar-fill" style={{ width: `${loadingProgress}%` }} />
                  </div>
                  <div className="loader-status">
                    <span className="loader-pct">
                      <CountUp
                        to={loadingProgress}
                        duration={0.25}
                        from={0}
                      />%
                    </span>
                    <span className="loader-msg">
                      <DecryptedText
                        text={loadingMessage}
                        animateOn="view"
                        speed={22}
                        sequential
                        revealDirection="start"
                        encryptedClassName="loader-decrypt-char"
                      />
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3. Prompt/Click to Continue Section */}
          {introStep === 'prompt' && (
            <div className="intro-step-section intro-step-prompt active">
              <div className="intro-inner">
                <div className="intro-left">
                  <h1 className="intro-title">
                    <GlitchText speed={0.4}>
                      SENTINEL
                    </GlitchText>
                  </h1>
                  <div className="intro-subtitle-container">
                    <div className="intro-meta-badge">
                      <span className="badge-blink">●</span> telemetry link active
                    </div>
                    <p className="intro-sub-text">
                      global planetary hazard survey // source: nasa eonet live feed
                    </p>
                  </div>
                  <div className="intro-prompt" style={{ marginTop: 'var(--space-6)', display: 'inline-block' }}>
                    <StarBorder speed="4.5s" color="#ffffff" thickness={1}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="intro-prompt-arrow" style={{ margin: 0, display: 'inline-block' }}>→</span>
                        <span>
                          {isEntering ? "ESTABLISHING SURVEY CONNECTION..." : "COMMENCE TELEMETRY SURVEY"}
                        </span>
                      </div>
                    </StarBorder>
                  </div>
                  <div className="intro-partner-logos" style={{ marginTop: '60px', width: '100%', maxWidth: '440px' }}>
                    <LogoLoop
                      logos={partnerLogos}
                      speed={50}
                      direction="left"
                      logoHeight={28}
                      gap={36}
                      pauseOnHover
                      scaleOnHover
                      fadeOut
                      fadeOutColor="#000000"
                      ariaLabel="Sentinel tech stack partners"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Floating Control Deck (Desktop Only) */}
      {!isIntro && !isMobile && (
        <div className="audio-control-deck">
          <button
            className={`deck-btn ${isMuted ? 'muted' : ''}`}
            onClick={toggleMute}
            title={isMuted ? 'Unmute Transmission' : 'Mute Transmission'}
          >
            <div className="wave-icon">
              <span className="wave-bar"></span>
              <span className="wave-bar"></span>
              <span className="wave-bar"></span>
              <span className="wave-bar"></span>
            </div>
          </button>
          <button
            className="deck-btn"
            onClick={() => setShowCredits(true)}
            title="Flight Credits & Mission Data"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </button>
        </div>
      )}

      {/* Credits Modal */}
      {showCredits && (
        <div className="credits-modal" onClick={() => setShowCredits(false)}>
          <div className="credits-content" onClick={(e) => e.stopPropagation()}>
            <button className="credits-close" onClick={() => setShowCredits(false)}>✕</button>
            <h2 className="credits-title">SENTINEL MISSION DECK</h2>
            <div className="credits-body">
              <div className="credits-section">
                <span className="credits-label">SYSTEM CLASSIFICATION</span>
                <span className="credits-value">PLANETARY SURVEY INSTRUMENT</span>
              </div>
              <div className="credits-section">
                <span className="credits-label">PRIMARY TELEMETRY AGENCY</span>
                <span className="credits-value">NASA Earth Observatory Natural Event Tracker (EONET)</span>
              </div>
              <div className="credits-section">
                <span className="credits-label">ACTIVE SENSORS IN SURVEY</span>
                <span className="credits-value">MODIS / VIIRS spectral imagers tracking wildfires, volcanic thermal output, storm paths, and iceberg movement.</span>
              </div>
              <div className="credits-section">
                <span className="credits-label">SOUND FREQUENCY</span>
                <span className="credits-value">Space Ambient Transmission (Playstarz)</span>
              </div>
            </div>
            <div className="credits-footer">
              ESTABLISHING LINK // 2026 SENTINEL COMMAND
            </div>
          </div>
        </div>
      )}

      {/* Hidden audio player with NASA planetary transmission sounds */}
      <audio ref={audioRef} loop preload="auto" muted={isMuted}>
        <source src="/playstarz_music-space-ambient-435262.mp3" type="audio/mpeg" />
        <source src="https://www.nasa.gov/wp-content/uploads/2015/01/578358main_kepler_star_KIC12268220C.mp3" type="audio/mpeg" />
      </audio>

      {/* Custom cursor */}
      {!isMobile && viewMode !== 'street' && <Cursor />}

      {/* ── Desktop UI ── */}
      {!isMobile && (
        <>
          {/* Persistent UI */}
          {!isEvent && <Wordmark />}
          <TimeDisplay visible={!isIntro && viewMode !== 'street'} />

          {/* Category list */}
          {(isCategory || isEvent) && (
            <CategoryList
              visible={!isEvent}
              selectedId={state.selectedCategory?.id ?? null}
              onSelect={handleSelectCategory}
            />
          )}

          {/* Event list */}
          {isCategory && state.selectedCategory && (
            <EventList
              events={state.events}
              selectedEvent={state.selectedEvent}
              loading={state.loading}
              error={state.error}
              visible={true}
              onSelect={handleSelectEvent}
              filters={filters}
              onFilterChange={setFilters}
              sourcesList={sourcesList}
            />
          )}

          {/* Status line */}
          <StatusLine
            category={state.selectedCategory}
            eventCount={state.events.length}
            visible={isCategory}
          />

          {/* Event detail */}
          {isEvent && state.selectedEvent && (
            <EventDetailPanel
              event={state.selectedEvent}
              onClose={handleCloseEvent}
            />
          )}
        </>
      )}

      {/* ── Mobile UI ── */}
      {isMobile && !isIntro && (
        <>
          {/* Street View Mode Floating Back Button */}
          {viewMode === 'street' && (
            <button
              className="mobile-street-view-back-btn"
              onClick={() => setViewMode('globe')}
            >
              ← BACK TO GLOBE
            </button>
          )}

          {/* Unified Top Header Bar */}
          {viewMode !== 'street' && (
            <header className="mobile-navbar">
              <div className="mobile-navbar-top">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Wordmark />
                  <div className="mobile-audio-inline" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <button
                      className={`deck-btn ${isMuted ? 'muted' : ''}`}
                      onClick={toggleMute}
                      title={isMuted ? 'Unmute Transmission' : 'Mute Transmission'}
                      style={{ width: '28px', height: '28px', padding: 0 }}
                    >
                      <div className="wave-icon" style={{ transform: 'scale(0.8)' }}>
                        <span className="wave-bar"></span>
                        <span className="wave-bar"></span>
                        <span className="wave-bar"></span>
                        <span className="wave-bar"></span>
                      </div>
                    </button>
                    <button
                      className="deck-btn"
                      onClick={() => setShowCredits(true)}
                      title="Flight Credits & Mission Data"
                      style={{ width: '28px', height: '28px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="16" x2="12" y2="12" />
                        <line x1="12" y1="8" x2="12.01" y2="8" />
                      </svg>
                    </button>
                  </div>
                </div>
                <TimeDisplay visible={true} />
              </div>

              {(!state.selectedCategory || mobileCategoryMenuOpen) && (
                <CategoryList
                  visible={true}
                  selectedId={state.selectedCategory?.id ?? null}
                  onSelect={handleSelectCategory}
                />
              )}
            </header>
          )}

          {/* Floating Category Menu Toggle Button (when collapsed) */}
          {state.selectedCategory && !mobileCategoryMenuOpen && viewMode !== 'street' && (
            <button
              className="mobile-category-toggle-btn"
              onClick={() => setMobileCategoryMenuOpen(true)}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '6px' }}>
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
              FILTER: {state.selectedCategory.label.toUpperCase()}
            </button>
          )}

          {/* Floating trigger button to open the event list overlay */}
          {state.selectedCategory && !state.selectedEvent && !mobileCategoryMenuOpen && !mobileListOpen && viewMode !== 'street' && (
            <button
              className="mobile-list-trigger"
              onClick={() => setMobileListOpen(true)}
            >
              {state.loading ? (
                <span className="mobile-trigger-loading">LOADING EVENTS...</span>
              ) : (
                <>
                  <span className="mobile-trigger-icon">≡</span>
                  <span className="mobile-trigger-text">
                    VIEW {state.events.length} EVENTS
                  </span>
                </>
              )}
            </button>
          )}

          {/* Full-screen list overlay */}
          {state.selectedCategory && mobileListOpen && (
            <div className="mobile-list-overlay">
              <div className="mobile-overlay-header">
                <div className="mobile-overlay-title">
                  {state.selectedCategory.label}
                  <span className="mobile-overlay-count">
                    ({state.events.length} records)
                  </span>
                </div>
                <button
                  className="mobile-overlay-close"
                  onClick={() => setMobileListOpen(false)}
                >
                  ✕ CLOSE
                </button>
              </div>
              <div className="mobile-overlay-content">
                <EventList
                  events={state.events}
                  selectedEvent={state.selectedEvent}
                  loading={state.loading}
                  error={state.error}
                  visible={true}
                  onSelect={handleSelectEvent}
                  filters={filters}
                  onFilterChange={setFilters}
                  sourcesList={sourcesList}
                />
              </div>
            </div>
          )}

          {/* Compact floating event detail card at the bottom */}
          {state.selectedEvent && state.phase === 'event' && viewMode !== 'street' && (
            <>
              {!mobileDetailExpanded ? (
                /* Sleek, Premium Collapsed Card Layout */
                <div className="mobile-event-card mobile-event-card--collapsed">
                  <div className="mobile-collapsed-header">
                    <span 
                      className="mobile-collapsed-category" 
                      style={{ color: getCategoryColorHex(state.selectedEvent.categories[0].id) }}
                    >
                      <span 
                        className="mobile-collapsed-bullet" 
                        style={{ backgroundColor: getCategoryColorHex(state.selectedEvent.categories[0].id), boxShadow: `0 0 8px ${getCategoryColorHex(state.selectedEvent.categories[0].id)}` }}
                      />
                      {state.selectedEvent.categories[0].title.toUpperCase()}
                    </span>
                    <button className="mobile-collapsed-close-btn" onClick={handleCloseEvent}>✕</button>
                  </div>
                  
                  <div className="mobile-collapsed-body">
                    <h3 className="mobile-collapsed-title">{state.selectedEvent.title}</h3>
                    {(() => {
                      const coords = extractCoordinates(state.selectedEvent.geometry);
                      if (coords) {
                        const [lon, lat] = coords;
                        return (
                          <div className="mobile-collapsed-coords">
                            <span className="mobile-coord-label">COORDS:</span> {formatCoords(lon, lat)}
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>

                  <div className="mobile-collapsed-footer">
                    <span className="mobile-collapsed-date">
                      {state.selectedEvent.geometry[state.selectedEvent.geometry.length - 1] && (
                        formatDate(state.selectedEvent.geometry[state.selectedEvent.geometry.length - 1].date)
                      )}
                    </span>
                    <button className="mobile-collapsed-btn mobile-btn-expand" onClick={() => setMobileDetailExpanded(true)}>
                      ANALYZE TELEMETRY →
                    </button>
                  </div>
                </div>
              ) : (
                /* Full bottom sheet when expanded */
                <div className="mobile-event-card mobile-event-card--expanded">
                  <div className="mobile-card-header">
                    <button className="mobile-card-back" onClick={() => setMobileDetailExpanded(false)}>
                      ← BACK TO MAP
                    </button>
                    <button
                      className="mobile-card-toggle"
                      onClick={handleCloseEvent}
                    >
                      ✕ CLOSE
                    </button>
                  </div>
                  <div className="mobile-card-content">
                    <EventDetailPanel
                      event={state.selectedEvent}
                      onClose={handleCloseEvent}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
    </ClickSpark>
  );
}
