/**
 * Extract the primary [longitude, latitude] from an EONET geometry array.
 * Uses the most recent geometry point (last entry, which has the latest date).
 * Returns null if no Point geometry is available.
 */
export function extractCoordinates(
  geometry: Array<{ type: string; coordinates: [number, number] | number[][] }>
): [number, number] | null {
  if (!Array.isArray(geometry)) return null;

  // 1. First find the last Point geometry entry
  for (let i = geometry.length - 1; i >= 0; i--) {
    const g = geometry[i];
    if (g && g.type === 'Point' && Array.isArray(g.coordinates)) {
      const coords = g.coordinates as any;
      if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
        return [coords[0], coords[1]]; // [longitude, latitude]
      }
    }
  }

  // 2. Fall back to the first coordinate of any Polygon geometry entry
  for (let i = geometry.length - 1; i >= 0; i--) {
    const g = geometry[i];
    if (g && g.type === 'Polygon' && Array.isArray(g.coordinates)) {
      const coords = g.coordinates as any;
      // Coordinates could be ring array (3D array: number[][][]) or nested array
      if (Array.isArray(coords[0])) {
        // If ring has points: rings[0] -> array of points, rings[0][0] -> point [lon, lat]
        if (Array.isArray(coords[0][0]) && typeof coords[0][0][0] === 'number' && typeof coords[0][0][1] === 'number') {
          return [coords[0][0][0], coords[0][0][1]];
        }
        // If it's a simple point list: points[0] -> point [lon, lat]
        if (typeof coords[0][0] === 'number' && typeof coords[0][1] === 'number') {
          return [coords[0][0], coords[0][1]];
        }
      }
    }
  }

  return null;
}
