import { EntityManager } from "../EntityManager";
import type { PositionComponent } from "../components/Position";
import type { CombatComponent } from "../components/Combat";
import type { StatsComponent } from "../components/Stats";
import { WEAPON_RANGE } from "../components/Combat";

const COMBAT_DECAY_TIME = 6.0; // seconds out of combat to leave combat state

export type DamageEvent = {
  attackerId: string;
  targetId: string;
  damage: number;
  weaponType: string;
};

export class CombatSystem {
  private entityManager: EntityManager;
  private onDamage: ((event: DamageEvent) => void) | null = null;

  constructor(entityManager: EntityManager) {
    this.entityManager = entityManager;
  }

  setOnDamage(handler: (event: DamageEvent) => void) {
    this.onDamage = handler;
  }

  update(dt: number) {
    const entities = this.entityManager.getEntitiesWithComponents("combat", "position");

    for (const entity of entities) {
      const combat = entity.components.get("combat") as CombatComponent;

      // Dead entities can't do anything
      const selfStats = entity.components.get("stats") as StatsComponent | undefined;
      if (selfStats && selfStats.hp <= 0) {
        this.disengageAutoAttack(combat);
        combat.inCombat = false;
        continue;
      }

      // Decay combat state
      if (combat.inCombat) {
        combat.combatTimer -= dt;
        if (combat.combatTimer <= 0) {
          combat.inCombat = false;
          combat.combatTimer = 0;
        }
      }

      // Regen HP when out of combat (1 HP every 0.5s)
      if (!combat.inCombat) {
        const stats = entity.components.get("stats") as StatsComponent | undefined;
        if (stats && stats.hp < stats.maxHp) {
          if (!combat._regenTimer) combat._regenTimer = 0;
          combat._regenTimer += dt;
          if (combat._regenTimer >= 0.5) {
            stats.hp = Math.min(stats.maxHp, Math.floor(stats.hp) + 1);
            combat._regenTimer = 0;
          }
        }
      }

      if (!combat.autoAttacking || !combat.targetEntityId) continue;

      // Check target still exists
      const target = this.entityManager.getEntity(combat.targetEntityId);
      if (!target) {
        this.disengageAutoAttack(combat);
        continue;
      }

      const targetStats = target.components.get("stats") as StatsComponent | undefined;
      if (targetStats && targetStats.hp <= 0) {
        this.disengageAutoAttack(combat);
        continue;
      }

      // Range check
      const pos = entity.components.get("position") as PositionComponent;
      const targetPos = target.components.get("position") as PositionComponent | undefined;
      if (!targetPos) continue;

      const range = WEAPON_RANGE[combat.weaponType];
      const dist = Math.max(Math.abs(pos.x - targetPos.x), Math.abs(pos.z - targetPos.z));

      if (dist > range) {
        // Out of range — pause attack timer but stay engaged
        continue;
      }

      // Wind-up phase
      if (combat.windingUp) {
        combat.windUpTimer -= dt;
        if (combat.windUpTimer <= 0) {
          // Wind-up complete — deal damage
          this.dealDamage(entity.id, combat, target.id);
          combat.windingUp = false;
          combat.attackTimer = combat.attackSpeed;
        }
        continue;
      }

      // Attack cooldown
      combat.attackTimer -= dt;
      if (combat.attackTimer <= 0) {
        // Start wind-up
        combat.windingUp = true;
        combat.windUpTimer = combat.windUpTime;
      }
    }
  }

  engageTarget(attackerId: string, targetId: string) {
    const combat = this.entityManager.getComponent<CombatComponent>(attackerId, "combat");
    if (!combat) return;

    // Toggle off if already targeting this entity
    if (combat.autoAttacking && combat.targetEntityId === targetId) {
      this.disengageAutoAttack(combat);
      return;
    }

    combat.autoAttacking = true;
    combat.targetEntityId = targetId;
    combat.attackTimer = 0; // Start attacking immediately
    combat.windingUp = false;
    combat.windUpTimer = 0;
  }

  cancelAutoAttack(entityId: string) {
    const combat = this.entityManager.getComponent<CombatComponent>(entityId, "combat");
    if (!combat) return;
    this.disengageAutoAttack(combat);
  }

  private disengageAutoAttack(combat: CombatComponent) {
    combat.autoAttacking = false;
    combat.targetEntityId = null;
    combat.attackTimer = 0;
    combat.windingUp = false;
    combat.windUpTimer = 0;
  }

  private dealDamage(attackerId: string, attackerCombat: CombatComponent, targetId: string) {
    const targetStats = this.entityManager.getComponent<StatsComponent>(targetId, "stats");
    if (!targetStats) return;

    const damage = attackerCombat.weaponDamage;
    targetStats.hp = Math.max(0, targetStats.hp - damage);

    // Attacker enters combat
    attackerCombat.inCombat = true;
    attackerCombat.combatTimer = COMBAT_DECAY_TIME;

    // Target enters combat + auto-retaliates
    const targetCombat = this.entityManager.getComponent<CombatComponent>(targetId, "combat");
    if (targetCombat) {
      targetCombat.inCombat = true;
      targetCombat.combatTimer = COMBAT_DECAY_TIME;

      // Auto-retaliate if not already attacking someone
      if (!targetCombat.autoAttacking) {
        targetCombat.autoAttacking = true;
        targetCombat.targetEntityId = attackerId;
        targetCombat.attackTimer = 0;
      }
    }

    if (this.onDamage) {
      this.onDamage({
        attackerId,
        targetId,
        damage,
        weaponType: attackerCombat.weaponType,
      });
    }
  }
}
