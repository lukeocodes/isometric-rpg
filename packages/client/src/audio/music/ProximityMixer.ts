/**
 * ProximityMixer fades stems smoothly based on Manhattan distance from a
 * point of interest (POI). Each stem has a triggerDistance (where it starts
 * fading in) and a fullDistance (where it reaches full volume).
 *
 * Uses AudioParam automation for click-free gain changes.
 */

interface ProximityStem {
  name: string;
  gainNode: GainNode;
  triggerDistance: number; // starts fading in at this Manhattan distance
  fullDistance: number; // full volume at this distance (closer)
}

export class ProximityMixer {
  private stems: ProximityStem[] = [];

  /**
   * Register a stem with its gain node and distance configuration.
   * Initial gain is set to 0 (stem is silent until update is called).
   */
  addStem(
    name: string,
    gainNode: GainNode,
    config: { triggerDistance: number; fullDistance: number },
  ): void {
    gainNode.gain.value = 0;
    this.stems.push({
      name,
      gainNode,
      triggerDistance: config.triggerDistance,
      fullDistance: config.fullDistance,
    });
  }

  /**
   * Update all stem gains based on player position relative to POI.
   * Uses Manhattan distance: abs(dx) + abs(dz).
   *
   * Gain formula:
   *   t = clamp(1 - (dist - fullDistance) / (triggerDistance - fullDistance), 0, 1)
   *
   * At or closer than fullDistance: gain = 1.0
   * At or beyond triggerDistance: gain = 0.0
   * Between: linear interpolation
   */
  update(
    playerPos: { x: number; z: number },
    poi: { x: number; z: number },
  ): void {
    const dist =
      Math.abs(playerPos.x - poi.x) + Math.abs(playerPos.z - poi.z);

    for (const stem of this.stems) {
      const range = stem.triggerDistance - stem.fullDistance;
      const t =
        range <= 0
          ? 1
          : Math.max(
              0,
              Math.min(1, 1 - (dist - stem.fullDistance) / range),
            );

      const now = stem.gainNode.context.currentTime;
      stem.gainNode.gain.setValueAtTime(stem.gainNode.gain.value, now);
      stem.gainNode.gain.linearRampToValueAtTime(t, now + 0.3);
    }
  }

  /**
   * Dispose: set all stem gains to 0 and clear the stems array.
   */
  dispose(): void {
    for (const stem of this.stems) {
      const now = stem.gainNode.context.currentTime;
      stem.gainNode.gain.setValueAtTime(stem.gainNode.gain.value, now);
      stem.gainNode.gain.linearRampToValueAtTime(0, now + 0.05);
    }
    this.stems = [];
  }
}
