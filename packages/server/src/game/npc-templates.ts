/**
 * NPC Type System
 *
 * Inheritance chain builds up NPCs from categories:
 *   BaseNPC → Category → Group → Variant
 *
 * Example: BaseNPC → Monster → Skeleton → SkeletonArcher
 */

export type NPCCategory = "wildlife" | "monster" | "interactive";

export interface StatRange {
  min: number;
  max: number;
}

export interface NPCTemplate {
  id: string;
  name: string;
  groupId: string;
  category: NPCCategory;

  // Appearance
  bodyColor: string;
  skinColor: string;

  // Combat
  weaponType: "melee" | "ranged" | "magic" | "none";
  weaponDamage: StatRange;
  attackSpeed: StatRange;
  hp: StatRange;

  // Base stats
  str: StatRange;
  dex: StatRange;
  int: StatRange;

  // Behavior
  aggressive: boolean;    // attacks players on sight
  flees: boolean;         // runs from combat
  wanders: boolean;       // moves randomly in spawn area
  canTalk: boolean;       // interactive NPC
  wanderSpeed: number;    // tiles per second when wandering
}

// --- Base defaults by category ---

const WILDLIFE_BASE: Partial<NPCTemplate> = {
  category: "wildlife",
  weaponType: "none",
  weaponDamage: { min: 0, max: 0 },
  attackSpeed: { min: 3, max: 3 },
  aggressive: false,
  flees: true,
  wanders: true,
  canTalk: false,
  wanderSpeed: 1,
};

const MONSTER_BASE: Partial<NPCTemplate> = {
  category: "monster",
  aggressive: true,
  flees: false,
  wanders: true,
  canTalk: false,
  wanderSpeed: 0.5,
};

const INTERACTIVE_BASE: Partial<NPCTemplate> = {
  category: "interactive",
  weaponType: "none",
  weaponDamage: { min: 0, max: 0 },
  attackSpeed: { min: 99, max: 99 },
  aggressive: false,
  flees: false,
  wanders: false,
  canTalk: true,
  wanderSpeed: 0,
};

// --- Template builder ---

function template(base: Partial<NPCTemplate>, overrides: Partial<NPCTemplate> & { id: string; name: string; groupId: string }): NPCTemplate {
  return {
    category: "monster",
    bodyColor: "#888888",
    skinColor: "#aaaaaa",
    weaponType: "melee",
    weaponDamage: { min: 1, max: 3 },
    attackSpeed: { min: 2, max: 3 },
    hp: { min: 5, max: 15 },
    str: { min: 5, max: 10 },
    dex: { min: 5, max: 10 },
    int: { min: 5, max: 10 },
    aggressive: true,
    flees: false,
    wanders: true,
    canTalk: false,
    wanderSpeed: 0.5,
    ...base,
    ...overrides,
  } as NPCTemplate;
}

// --- Group bases (inherit from category) ---

const SKELETON_GROUP: Partial<NPCTemplate> = {
  ...MONSTER_BASE,
  groupId: "skeleton",
  bodyColor: "#aaaaaa",
  skinColor: "#ccccbb",
};

const IMP_GROUP: Partial<NPCTemplate> = {
  ...MONSTER_BASE,
  groupId: "imp",
  bodyColor: "#cc3333",
  skinColor: "#dd6666",
};

const RABBIT_GROUP: Partial<NPCTemplate> = {
  ...WILDLIFE_BASE,
  groupId: "rabbit",
  bodyColor: "#b8a080",
  skinColor: "#d4c4a8",
};

const GOBLIN_GROUP: Partial<NPCTemplate> = {
  ...MONSTER_BASE,
  groupId: "goblin",
  bodyColor: "#556b2f",
  skinColor: "#6b8e23",
};

// ============================================
// NPC Template Registry
// ============================================

export const NPC_TEMPLATES: Record<string, NPCTemplate> = {
  // --- Skeletons ---
  "skeleton-warrior": template(SKELETON_GROUP, {
    id: "skeleton-warrior",
    name: "Skeleton Warrior",
    groupId: "skeleton",
    weaponType: "melee",
    weaponDamage: { min: 3, max: 5 },
    attackSpeed: { min: 2.0, max: 2.5 },
    hp: { min: 10, max: 15 },
    str: { min: 8, max: 12 },
    dex: { min: 5, max: 8 },
    int: { min: 3, max: 5 },
  }),

  "skeleton-archer": template(SKELETON_GROUP, {
    id: "skeleton-archer",
    name: "Skeleton Archer",
    groupId: "skeleton",
    weaponType: "ranged",
    weaponDamage: { min: 2, max: 4 },
    attackSpeed: { min: 2.5, max: 3.0 },
    hp: { min: 8, max: 12 },
    str: { min: 5, max: 7 },
    dex: { min: 8, max: 12 },
    int: { min: 3, max: 5 },
  }),

  "skeleton-mage": template(SKELETON_GROUP, {
    id: "skeleton-mage",
    name: "Skeleton Mage",
    groupId: "skeleton",
    bodyColor: "#9999bb",
    weaponType: "magic",
    weaponDamage: { min: 4, max: 7 },
    attackSpeed: { min: 3.0, max: 3.5 },
    hp: { min: 6, max: 10 },
    str: { min: 3, max: 5 },
    dex: { min: 5, max: 7 },
    int: { min: 10, max: 15 },
  }),

  "skeleton-lord": template(SKELETON_GROUP, {
    id: "skeleton-lord",
    name: "Skeleton Lord",
    groupId: "skeleton",
    bodyColor: "#ddddcc",
    weaponType: "melee",
    weaponDamage: { min: 6, max: 10 },
    attackSpeed: { min: 1.8, max: 2.2 },
    hp: { min: 25, max: 40 },
    str: { min: 12, max: 18 },
    dex: { min: 8, max: 12 },
    int: { min: 8, max: 12 },
  }),

  // --- Imps ---
  "lesser-imp": template(IMP_GROUP, {
    id: "lesser-imp",
    name: "Lesser Imp",
    groupId: "imp",
    weaponType: "magic",
    weaponDamage: { min: 2, max: 4 },
    attackSpeed: { min: 2.0, max: 2.5 },
    hp: { min: 6, max: 10 },
    str: { min: 3, max: 5 },
    dex: { min: 6, max: 8 },
    int: { min: 8, max: 12 },
  }),

  "greater-imp": template(IMP_GROUP, {
    id: "greater-imp",
    name: "Greater Imp",
    groupId: "imp",
    bodyColor: "#aa1111",
    weaponType: "magic",
    weaponDamage: { min: 5, max: 8 },
    attackSpeed: { min: 2.5, max: 3.0 },
    hp: { min: 15, max: 25 },
    str: { min: 5, max: 8 },
    dex: { min: 8, max: 10 },
    int: { min: 12, max: 18 },
  }),

  // --- Goblins ---
  "goblin-grunt": template(GOBLIN_GROUP, {
    id: "goblin-grunt",
    name: "Goblin Grunt",
    groupId: "goblin",
    weaponType: "melee",
    weaponDamage: { min: 2, max: 3 },
    attackSpeed: { min: 1.8, max: 2.2 },
    hp: { min: 8, max: 12 },
    str: { min: 6, max: 9 },
    dex: { min: 7, max: 10 },
    int: { min: 3, max: 5 },
  }),

  "goblin-shaman": template(GOBLIN_GROUP, {
    id: "goblin-shaman",
    name: "Goblin Shaman",
    groupId: "goblin",
    bodyColor: "#3d5c1e",
    weaponType: "magic",
    weaponDamage: { min: 3, max: 6 },
    attackSpeed: { min: 2.5, max: 3.0 },
    hp: { min: 10, max: 15 },
    str: { min: 4, max: 6 },
    dex: { min: 5, max: 7 },
    int: { min: 8, max: 12 },
  }),

  // --- Wildlife ---
  "rabbit": template(RABBIT_GROUP, {
    id: "rabbit",
    name: "Rabbit",
    groupId: "rabbit",
    weaponType: "none",
    weaponDamage: { min: 0, max: 0 },
    hp: { min: 3, max: 5 },
    str: { min: 1, max: 2 },
    dex: { min: 8, max: 12 },
    int: { min: 1, max: 2 },
    wanderSpeed: 2,
  }),

  // --- Interactive ---
  "king-rabbit": template({
    ...INTERACTIVE_BASE,
    ...RABBIT_GROUP,
    canTalk: true,
    wanders: true,
    flees: false,
    wanderSpeed: 0.5,
  }, {
    id: "king-rabbit",
    name: "King Rabbit",
    groupId: "rabbit",
    bodyColor: "#f0e68c",
    skinColor: "#fff8dc",
    hp: { min: 100, max: 100 },
    str: { min: 1, max: 1 },
    dex: { min: 1, max: 1 },
    int: { min: 20, max: 20 },
  }),
};

// --- Helpers ---

export function rollStat(range: StatRange): number {
  return Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
}

export function getTemplatesByGroup(groupId: string): NPCTemplate[] {
  return Object.values(NPC_TEMPLATES).filter(t => t.groupId === groupId);
}

export function getTemplatesByCategory(category: NPCCategory): NPCTemplate[] {
  return Object.values(NPC_TEMPLATES).filter(t => t.category === category);
}

export function getTemplate(id: string): NPCTemplate | undefined {
  return NPC_TEMPLATES[id];
}
