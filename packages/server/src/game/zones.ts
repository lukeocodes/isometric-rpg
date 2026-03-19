/**
 * Zone system — defines safe areas on the map.
 * Disconnecting in a safe zone instantly removes the character.
 * Disconnecting outside leaves them on the map for LINGER_DURATION.
 */

export interface SafeZone {
  id: string;
  name: string;
  mapId: number;
  x: number;
  z: number;
  radius: number;
}

const SAFE_ZONES: SafeZone[] = [
  {
    id: "town-spawn",
    name: "Town",
    mapId: 1,
    x: 0,
    z: 0,
    radius: 8, // The stone area near origin
  },
];

export function isInSafeZone(mapId: number, x: number, z: number): boolean {
  for (const zone of SAFE_ZONES) {
    if (zone.mapId !== mapId) continue;
    const dist = Math.sqrt((x - zone.x) ** 2 + (z - zone.z) ** 2);
    if (dist <= zone.radius) return true;
  }
  return false;
}

export function getSafeZone(mapId: number, x: number, z: number): SafeZone | null {
  for (const zone of SAFE_ZONES) {
    if (zone.mapId !== mapId) continue;
    const dist = Math.sqrt((x - zone.x) ** 2 + (z - zone.z) ** 2);
    if (dist <= zone.radius) return zone;
  }
  return null;
}

export function getAllSafeZones(): SafeZone[] {
  return SAFE_ZONES;
}
