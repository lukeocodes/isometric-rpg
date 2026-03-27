import { entityStore } from "./entities.js";
import { getEquippedBonuses } from "./inventory.js";

const COMBAT_DECAY = 6.0;
const REGEN_INTERVAL = 0.5;
const WEAPON_RANGES: Record<string, number> = { melee: 1, ranged: 4, magic: 4 };

export interface CombatState {
  autoAttacking: boolean;
  targetId: string | null;
  inCombat: boolean;
  combatTimer: number;
  attackTimer: number;
  windingUp: boolean;
  windUpTimer: number;
  windUpTime: number;
  regenTimer: number;
  weaponType: string;
  weaponDamage: number;
  attackSpeed: number;
  hp: number;
  maxHp: number;
}

export interface DamageEvent { attackerId: string; targetId: string; damage: number; weaponType: string }
export interface DeathEvent { entityId: string; killerId: string }

const states = new Map<string, CombatState>();

export function getCombatState(entityId: string) { return states.get(entityId); }

export function registerEntity(entityId: string, weaponType = "melee", weaponDamage = 5,
  attackSpeed = 2.0, hp = 50, maxHp = 50) {
  states.set(entityId, {
    autoAttacking: false, targetId: null, inCombat: false, combatTimer: 0,
    attackTimer: 0, windingUp: false, windUpTimer: 0, windUpTime: 0.5,
    regenTimer: 0, weaponType, weaponDamage, attackSpeed, hp, maxHp,
  });
}

export function unregisterEntity(entityId: string) { states.delete(entityId); }

export function engageTarget(attackerId: string, targetId: string) {
  const s = states.get(attackerId);
  if (!s) return;
  if (s.autoAttacking && s.targetId === targetId) { disengage(attackerId); return; }
  s.autoAttacking = true;
  s.targetId = targetId;
  s.attackTimer = 0;
  s.windingUp = false;
}

export function disengage(entityId: string) {
  const s = states.get(entityId);
  if (!s) return;
  s.autoAttacking = false;
  s.targetId = null;
  s.attackTimer = 0;
  s.windingUp = false;
}

// Reusable arrays — cleared each tick, avoids allocation
const _damage: DamageEvent[] = [];
const _deaths: DeathEvent[] = [];

export function tick(dt: number): { damage: DamageEvent[]; deaths: DeathEvent[] } {
  _damage.length = 0;
  _deaths.length = 0;

  for (const [entityId, s] of states) {
    const entity = entityStore.get(entityId);
    if (!entity) continue;

    // Skip sleeping NPCs (no players nearby)
    if (!entityStore.isAwake(entityId)) continue;

    if (s.hp <= 0) { disengage(entityId); s.inCombat = false; continue; }

    if (s.inCombat) {
      s.combatTimer -= dt;
      if (s.combatTimer <= 0) { s.inCombat = false; s.combatTimer = 0; }
    }

    if (!s.inCombat && s.hp < s.maxHp) {
      s.regenTimer += dt;
      if (s.regenTimer >= REGEN_INTERVAL) { s.hp = Math.min(s.maxHp, s.hp + 1); s.regenTimer = 0; }
    }

    if (!s.autoAttacking || !s.targetId) continue;

    const target = entityStore.get(s.targetId);
    const ts = states.get(s.targetId);
    if (!target || !ts || ts.hp <= 0) { disengage(entityId); continue; }

    const dist = Math.max(Math.abs(entity.x - target.x), Math.abs(entity.z - target.z));
    if (dist > (WEAPON_RANGES[s.weaponType] || 1)) continue;

    if (s.windingUp) {
      s.windUpTimer -= dt;
      if (s.windUpTimer <= 0) {
        // Base damage + equipment bonus
        const attackerEntity = entityStore.get(entityId);
        const attackerBonus = attackerEntity?.entityType === "player" ? getEquippedBonuses(entityId) : null;
        let dmg = s.weaponDamage + (attackerBonus?.bonusDamage ?? 0);

        // Equipment armor reduces incoming damage
        const target = entityStore.get(s.targetId);
        if (target?.entityType === "player") {
          const targetBonus = getEquippedBonuses(s.targetId);
          dmg = Math.max(1, dmg - targetBonus.bonusArmor);
        }

        // Defend ability halves damage for 5s
        if (target && (target as any)._defendUntil && Date.now() < (target as any)._defendUntil) {
          dmg = Math.floor(dmg * 0.5);
        }
        ts.hp = Math.max(0, ts.hp - dmg);
        s.inCombat = true; s.combatTimer = COMBAT_DECAY;
        ts.inCombat = true; ts.combatTimer = COMBAT_DECAY;
        if (!ts.autoAttacking) { ts.autoAttacking = true; ts.targetId = entityId; ts.attackTimer = 0; }
        _damage.push({ attackerId: entityId, targetId: s.targetId, damage: dmg, weaponType: s.weaponType });
        if (ts.hp <= 0) _deaths.push({ entityId: s.targetId, killerId: entityId });
        s.windingUp = false;
        s.attackTimer = s.attackSpeed;
      }
      continue;
    }

    s.attackTimer -= dt;
    if (s.attackTimer <= 0) { s.windingUp = true; s.windUpTimer = s.windUpTime; }
  }

  return { damage: _damage, deaths: _deaths };
}
