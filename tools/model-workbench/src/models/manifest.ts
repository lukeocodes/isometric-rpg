import { registry } from "./registry";
import type { ModelCategory, AttachmentSlot } from "./types";

/**
 * Model manifest entry — metadata for game client integration.
 * The game client reads this to know what models exist and how to configure them.
 */
export interface ManifestEntry {
  id: string;
  name: string;
  category: ModelCategory;
  slot: AttachmentSlot;
  /** Whether this model can hold weapons (has hand-R/hand-L attachment points) */
  canHoldWeapons: boolean;
  /** Whether this is a non-humanoid body (rabbit, wolf, bear) */
  isQuadruped: boolean;
  /** Whether this is a boss variant */
  isBoss: boolean;
  /** Base model ID this is a variant of (for bosses) */
  baseVariantOf?: string;
}

/** Boss variant mappings */
const BOSS_VARIANTS: Record<string, string> = {
  "king-rabbit": "rabbit-body",
  "skeleton-lord": "skeleton-body",
  "alpha-wolf": "wolf-body",
};

const QUADRUPEDS = new Set(["rabbit-body", "wolf-body", "bear-body", "king-rabbit", "alpha-wolf"]);

const WEAPON_HOLDERS = new Set([
  "human-body", "elf-body", "dwarf-body",
  "skeleton-body", "goblin-body", "imp-body", "ogre-body", "wraith-body",
  "skeleton-lord",
]);

/**
 * Generate the full model manifest from the registry.
 */
export function generateManifest(): ManifestEntry[] {
  return registry.list().map((model) => ({
    id: model.id,
    name: model.name,
    category: model.category,
    slot: model.slot,
    canHoldWeapons: WEAPON_HOLDERS.has(model.id),
    isQuadruped: QUADRUPEDS.has(model.id),
    isBoss: model.id in BOSS_VARIANTS,
    baseVariantOf: BOSS_VARIANTS[model.id],
  }));
}

/**
 * Generate manifest as JSON string (for export/clipboard).
 */
export function generateManifestJSON(): string {
  return JSON.stringify(generateManifest(), null, 2);
}
