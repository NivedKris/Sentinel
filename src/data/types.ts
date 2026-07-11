// Types derived from verified live EONET API response shapes
// API base: https://eonet.gsfc.nasa.gov/api/v3

export interface EonetCategory {
  id: string;
  title: string;
  link: string;
  description: string;
}

export interface EonetGeometry {
  magnitudeValue: number | null;
  magnitudeUnit: string | null;
  date: string; // ISO 8601
  type: 'Point' | 'Polygon';
  // GeoJSON order: [longitude, latitude] for Point; number[][] for Polygon
  coordinates: [number, number] | number[][];
}

export interface EonetSource {
  id: string;
  url: string;
}

export interface EonetEvent {
  id: string;
  title: string;
  description: string | null; // can be null — must handle
  link: string;
  closed: string | null;
  categories: Array<{ id: string; title: string }>;
  sources: EonetSource[];
  geometry: EonetGeometry[];
}

export interface EonetCategoriesResponse {
  title: string;
  description: string;
  link: string;
  categories: EonetCategory[];
}

export interface EonetEventsResponse {
  title: string;
  description: string;
  link: string;
  events: EonetEvent[];
}

export interface EonetSourceDetail {
  id: string;
  title: string;
  source: string;
  description: string;
}

export interface EonetSourcesResponse {
  title: string;
  description: string;
  link: string;
  sources: EonetSourceDetail[];
}

export interface EonetLayerParameter {
  name: string;
  value: string;
}

export interface EonetLayer {
  name: string;
  serviceUrl: string;
  serviceType: string;
  parameters: EonetLayerParameter[];
}

export interface EonetCategoryLayers {
  id: string;
  title: string;
  layers: EonetLayer[];
}

export interface EonetLayersResponse {
  title: string;
  description: string;
  link: string;
  categories: EonetCategoryLayers[];
}

// Application-level category definition (the 8 from plan.md)
export interface AppCategory {
  id: string;
  label: string;
}

// Camera phases
export type CameraPhase = 'intro' | 'category' | 'event';

// App state
export interface AppState {
  phase: CameraPhase;
  selectedCategory: AppCategory | null;
  selectedEvent: EonetEvent | null;
  events: EonetEvent[];
  loading: boolean;
  error: string | null;
}

export interface FetchEventsOptions {
  status?: 'open' | 'closed' | 'all';
  days?: number;
  limit?: number;
  source?: string;
}

export type AppAction =
  | { type: 'SET_PHASE'; payload: CameraPhase }
  | { type: 'SELECT_CATEGORY'; payload: AppCategory }
  | { type: 'SET_EVENTS'; payload: EonetEvent[] }
  | { type: 'SELECT_EVENT'; payload: EonetEvent }
  | { type: 'CLEAR_EVENT' }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null };
