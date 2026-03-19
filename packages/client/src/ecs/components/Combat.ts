export type WeaponType = "melee" | "ranged" | "magic";

export const WEAPON_RANGE: Record<WeaponType, number> = {
  melee: 1,
  ranged: 4,
  magic: 4,
};

export interface CombatComponent {
  type: "combat";

  // Weapon
  weaponType: WeaponType;
  weaponDamage: number;
  attackSpeed: number; // seconds between attacks

  // Auto-attack state
  autoAttacking: boolean;
  targetEntityId: string | null;
  attackTimer: number; // countdown to next attack
  windingUp: boolean;  // true during the wind-up before damage lands
  windUpTime: number;  // how long the wind-up takes (cancel window)
  windUpTimer: number; // countdown within wind-up

  // Combat state
  inCombat: boolean;
  combatTimer: number; // time remaining in combat (decays to exit combat)

  // Regen
  _regenTimer: number;
}

export function createCombat(
  weaponType: WeaponType = "melee",
  weaponDamage = 5,
  attackSpeed = 2.0,
): CombatComponent {
  return {
    type: "combat",
    weaponType,
    weaponDamage,
    attackSpeed,
    autoAttacking: false,
    targetEntityId: null,
    attackTimer: 0,
    windingUp: false,
    windUpTime: 0.5, // 500ms cancel window
    windUpTimer: 0,
    inCombat: false,
    combatTimer: 0,
    _regenTimer: 0,
  };
}
