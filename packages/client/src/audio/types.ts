/** Music states driven by server events and zone tags */
export enum MusicState {
  Exploring = "exploring",
  Town = "town",
  Dungeon = "dungeon",
  EnemyNearby = "enemy_nearby",
  Combat = "combat",
  Boss = "boss",
  Victory = "victory",
}

/** Priority ordering: higher number = higher priority override */
export const MUSIC_STATE_PRIORITY: Record<MusicState, number> = {
  [MusicState.Exploring]: 0,
  [MusicState.Town]: 1,
  [MusicState.Dungeon]: 2,
  [MusicState.Victory]: 3,
  [MusicState.EnemyNearby]: 4,
  [MusicState.Combat]: 5,
  [MusicState.Boss]: 6,
};

/** Audio bus names */
export type BusName = "music" | "sfx" | "weather" | "ambient";

/** Persisted audio preferences (account-level, server-stored) */
export interface AudioPreferences {
  masterVolume: number; // 0.0 - 1.0
  musicVolume: number; // 0.0 - 1.0
  sfxVolume: number; // 0.0 - 1.0
}

/** Default audio preferences for new accounts */
export const DEFAULT_AUDIO_PREFERENCES: AudioPreferences = {
  masterVolume: 0.8,
  musicVolume: 0.6,
  sfxVolume: 1.0,
};

/** Crossfade duration defaults in seconds per transition type */
export const CROSSFADE_DURATIONS: Record<string, number> = {
  exploring_to_town: 3.0,
  exploring_to_enemy_nearby: 2.0,
  enemy_nearby_to_combat: 1.0,
  combat_to_victory: 0.5,
  victory_to_exploring: 3.0,
  default: 2.0,
};

/** Victory stinger duration before auto-transition back to ambient */
export const VICTORY_TIMEOUT_MS = 4000;
