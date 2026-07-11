import type {
  EonetCategoriesResponse, EonetEventsResponse, EonetCategory, EonetEvent,
  EonetSourceDetail, EonetSourcesResponse, EonetLayersResponse, EonetLayer,
  FetchEventsOptions, EonetGeometry
} from './types';

const BASE_URL = 'https://eonet.gsfc.nasa.gov/api/v3';

// In-memory cache
let categoriesCache: EonetCategory[] | null = null;
let sourcesCache: EonetSourceDetail[] | null = null;
const layersCache = new Map<string, EonetLayer[]>();

/**
 * Self-healing JSON parser that detects common EONET API truncation errors.
 * If the response was truncated mid-polygon coordinates array, it attempts to
 * dynamically insert missing brackets to make the JSON syntactically valid.
 */
function healAndParseJson(text: string): any {
  let attempts = 0;
  let currentText = text;
  while (attempts < 20) {
    try {
      return JSON.parse(currentText);
    } catch (e: any) {
      attempts++;
      const msg = e.message;
      const match = msg.match(/position (\d+)/);
      if (!match) throw e;
      const pos = parseInt(match[1]);
      if (pos >= currentText.length || pos < 0) throw e;
      
      const char = currentText[pos];
      if (char === '}' || char === ']') {
        // Insert a closing bracket before this character
        currentText = currentText.slice(0, pos) + ']' + currentText.slice(pos);
      } else if (char === ',') {
        // Remove trailing or extra comma
        currentText = currentText.slice(0, pos) + currentText.slice(pos + 1);
      } else {
        // Fallback: if we hit a position we can't heal directly, attempt to close outer array/object
        throw e;
      }
    }
  }
  throw new Error('Failed to parse and heal EONET API response');
}

/**
 * Cleans event coordinates, removing partial coordinate points or invalid structures
 * resulting from server-side data corruption or truncation.
 */
function sanitizeEvents(events: EonetEvent[]): EonetEvent[] {
  if (!Array.isArray(events)) return [];

  return events.map(event => {
    if (!event || typeof event !== 'object') return null;
    
    // Check if the event is sourced from GDACS
    const isGdacs = event.sources?.some(s => s.id === 'GDACS');

    const geometry = (event.geometry || []).map(geom => {
      if (!geom || typeof geom !== 'object') return null;
      
      const type = geom.type;
      let coords = geom.coordinates;
      
      if (type === 'Point') {
        if (!Array.isArray(coords) || coords.length < 2 || typeof coords[0] !== 'number' || typeof coords[1] !== 'number') {
          return null; // Invalid point
        }
        coords = [coords[0], coords[1]];
      } else if (type === 'Polygon') {
        if (!Array.isArray(coords)) return null;

        const traverseAndClean = (arr: any): any => {
          if (!Array.isArray(arr)) return null;
          // Check if it represents [lon, lat] or [lat, lon]
          if (arr.length >= 1 && typeof arr[0] === 'number') {
            if (arr.length >= 2 && typeof arr[1] === 'number') {
              // EONET Polygon coordinates for GDACS sources are reported in [latitude, longitude] order.
              // We swap them to standard [longitude, latitude] order so all maps, Three.js renderers, and
              // camera focus computations locate them in the correct countries.
              const shouldSwap = isGdacs || (Math.abs(arr[1]) > 90 && Math.abs(arr[0]) <= 90);
              if (shouldSwap) {
                return [arr[1], arr[0]]; // Swap to [longitude, latitude]
              }
              return [arr[0], arr[1]];
            }
            return null; // Truncated point coordinate
          }
          // Recursively clean arrays
          return arr
            .map(sub => traverseAndClean(sub))
            .filter(sub => sub !== null && (!Array.isArray(sub) || sub.length > 0));
        };

        coords = traverseAndClean(coords) || [];
      }
      
      return {
        ...geom,
        coordinates: coords
      };
    }).filter(g => g !== null) as EonetGeometry[];

    return {
      ...event,
      geometry
    };
  }).filter(ev => ev !== null) as EonetEvent[];
}

export async function fetchCategories(): Promise<EonetCategory[]> {
  if (categoriesCache !== null) return categoriesCache;

  const res = await fetch(`${BASE_URL}/categories`);
  if (!res.ok) {
    throw new Error(`Failed to fetch categories: ${res.status} ${res.statusText}`);
  }
  const text = await res.text();
  const data: EonetCategoriesResponse = healAndParseJson(text);
  categoriesCache = data.categories;
  return categoriesCache;
}

export async function fetchSources(): Promise<EonetSourceDetail[]> {
  if (sourcesCache !== null) return sourcesCache;

  const res = await fetch(`${BASE_URL}/sources`);
  if (!res.ok) {
    throw new Error(`Failed to fetch sources: ${res.status} ${res.statusText}`);
  }
  const text = await res.text();
  const data: EonetSourcesResponse = healAndParseJson(text);
  sourcesCache = data.sources;
  return sourcesCache;
}

export async function fetchLayersByCategory(categoryId: string): Promise<EonetLayer[]> {
  if (layersCache.has(categoryId)) {
    return layersCache.get(categoryId)!;
  }

  const res = await fetch(`${BASE_URL}/layers/${categoryId}`);
  if (!res.ok) {
    return [];
  }
  try {
    const text = await res.text();
    const data: EonetLayersResponse = healAndParseJson(text);
    const match = data.categories.find(c => c.id === categoryId);
    const layers = match ? match.layers : [];
    layersCache.set(categoryId, layers);
    return layers;
  } catch (err) {
    console.warn(`Failed parsing layers for ${categoryId}`, err);
    return [];
  }
}

export async function fetchEventsByCategory(
  categoryId: string,
  options: FetchEventsOptions = {}
): Promise<EonetEvent[]> {
  const { status = 'open', days = 30, limit = 300, source } = options;

  let url = `${BASE_URL}/events?category=${categoryId}&status=${status}&days=${days}&limit=${limit}`;
  if (source && source !== 'all') {
    url += `&source=${source}`;
  }

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch events: ${res.status} ${res.statusText}`);
  }
  const text = await res.text();
  const data: EonetEventsResponse = healAndParseJson(text);
  return sanitizeEvents(data.events);
}
