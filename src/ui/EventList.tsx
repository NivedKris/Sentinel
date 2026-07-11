import { useState, useEffect } from 'react';
import './EventList.css';
import type { EonetEvent, EonetSourceDetail, FetchEventsOptions } from '../data/types';
import AnimatedItem from '../animations/AnimatedItem';
import DecryptedText from '../animations/DecryptedText';

interface EventListProps {
  events: EonetEvent[];
  selectedEvent: EonetEvent | null;
  loading: boolean;
  error: string | null;
  visible: boolean;
  mobileExpanded?: boolean;
  onToggleExpand?: () => void;
  onSelect: (event: EonetEvent) => void;
  filters: FetchEventsOptions;
  onFilterChange: (newFilters: FetchEventsOptions) => void;
  sourcesList: EonetSourceDetail[];
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export default function EventList({
  events, selectedEvent, loading, error, visible,
  mobileExpanded = false, onToggleExpand, onSelect,
  filters, onFilterChange, sourcesList
}: EventListProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!visible) return null;

  return (
    <div className={`ev-list${mobileExpanded ? ' ev-list--mobile-expanded' : ''}`} id="event-list">
      {/* Mobile drag / tap sheet handle */}
      <div className="sheet-handle" onClick={onToggleExpand} />

      {/* Mobile collapsible filter trigger */}
      {isMobile && (
        <div className="ev-mobile-filters-toggle-bar">
          <button
            className={`ev-mobile-filters-toggle-btn ${showFilters ? 'active' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            {showFilters ? 'HIDE FILTERS ▴' : 'SHOW FILTERS & SETTINGS ▾'}
          </button>
        </div>
      )}

      {/* ── Filter Telemetry Controls ── */}
      {(!isMobile || showFilters) && (
        <div className="ev-filters">
          <div className="ev-filter-group">
            <label className="ev-filter-label">Filter Status</label>
            <div className="ev-btn-group">
              <button
                className={`ev-filter-btn ${filters.status === 'open' ? 'active' : ''}`}
                onClick={() => onFilterChange({ ...filters, status: 'open' })}
              >
                ACTIVE (OPEN)
              </button>
              <button
                className={`ev-filter-btn ${filters.status === 'closed' ? 'active' : ''}`}
                onClick={() => onFilterChange({ ...filters, status: 'closed' })}
              >
                ARCHIVE (CLOSED)
              </button>
            </div>
          </div>

          <div className="ev-filter-row">
            <div className="ev-filter-group">
              <label className="ev-filter-label">Timeframe</label>
              <select
                className="ev-select"
                value={filters.days}
                onChange={(e) => onFilterChange({ ...filters, days: Number(e.target.value) })}
              >
                <option value="15">Last 15 Days</option>
                <option value="30">Last 30 Days</option>
                <option value="90">Last 90 Days</option>
                <option value="365">Last Year</option>
                <option value="3650">Historical Records</option>
              </select>
            </div>

            <div className="ev-filter-group">
              <label className="ev-filter-label">Buffer Limit</label>
              <select
                className="ev-select"
                value={filters.limit}
                onChange={(e) => onFilterChange({ ...filters, limit: Number(e.target.value) })}
              >
                <option value="50">50 items</option>
                <option value="150">150 items</option>
                <option value="300">300 items</option>
                <option value="600">600 items</option>
              </select>
            </div>
          </div>

          <div className="ev-filter-group">
            <label className="ev-filter-label">Source Agency</label>
            <select
              className="ev-select"
              value={filters.source || 'all'}
              onChange={(e) => onFilterChange({ ...filters, source: e.target.value })}
            >
              <option value="all">All Observing Agencies</option>
              {sourcesList.map(src => (
                <option key={src.id} value={src.id}>
                  {src.title}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="ev-scroll-container">
        {loading && <p className="ev-state">Querying NASA database...</p>}
        {error && !loading && <p className="ev-state ev-error">{error}</p>}
        {!loading && !error && events.length === 0 && (
          <p className="ev-state">No matching incidents found for this filter configuration.</p>
        )}
        {!loading && !error && events.length > 0 && (
          <>
            <p className="ev-count">
              {events.length} records
              {events.length >= (filters.limit || 300) && (
                <span className="ev-limit"> (Query Limit Reached)</span>
              )}
            </p>
            <ul>
              {events.map((ev, i) => {
                const latestGeom = ev.geometry[ev.geometry.length - 1];
                const dateStr = latestGeom ? formatDate(latestGeom.date) : '';
                const magValue = latestGeom?.magnitudeValue;
                const magUnit = latestGeom?.magnitudeUnit;
                const useDecrypt = i < 20;
                return (
                  <li key={ev.id}>
                    <AnimatedItem index={i} delay={Math.min(i * 0.04, 0.6)}>
                      <button
                        id={`ev-${ev.id}`}
                        className={`ev-item${selectedEvent?.id === ev.id ? ' ev-item--active' : ''}`}
                        onClick={() => onSelect(ev)}
                        title={ev.title}
                      >
                        <div className="ev-item-left">
                          <span className="ev-item-title">
                            {useDecrypt ? (
                              <DecryptedText
                                text={ev.title}
                                animateOn="view"
                                speed={18}
                                sequential
                                revealDirection="start"
                                className=""
                                encryptedClassName="ev-decrypt-char"
                              />
                            ) : (
                              ev.title
                            )}
                          </span>
                          <span className="ev-item-meta">
                            {dateStr}
                            {magValue != null && ` • ${Number(magValue).toLocaleString()} ${magUnit || ''}`}
                          </span>
                        </div>
                        <span className="ev-item-chevron">→</span>
                      </button>
                    </AnimatedItem>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
