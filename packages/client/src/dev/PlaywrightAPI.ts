/**
 * Dev-only API exposed on window.__game for Playwright testing.
 * Provides direct access to game internals without needing to
 * simulate pixel-perfect mouse clicks on 3D meshes.
 */
import type { Game } from "../engine/Game";
import type { EntityManager } from "../ecs/EntityManager";
import type { PositionComponent } from "../ecs/components/Position";
import type { StatsComponent } from "../ecs/components/Stats";
import type { CombatComponent } from "../ecs/components/Combat";
import type { IdentityComponent } from "../ecs/components/Identity";
import type { MovementComponent } from "../ecs/components/Movement";

export interface PlaywrightGameAPI {
  // Queries
  getPlayerPosition(): { x: number; y: number; z: number } | null;
  getEntityList(): Array<{ id: string; name: string; type: string; x: number; z: number; hp?: number; maxHp?: number }>;
  getEntityById(id: string): any | null;
  getPlayerStats(): { hp: number; maxHp: number; mana: number; maxMana: number } | null;
  getPlayerCombat(): { inCombat: boolean; autoAttacking: boolean; targetId: string | null } | null;
  isConnected(): boolean;

  // Actions
  move(direction: "w" | "a" | "s" | "d"): void;
  moveTo(tileX: number, tileZ: number): void;
  selectTarget(entityId: string): void;
  clearTarget(): void;
  toggleAutoAttack(entityId?: string): void;
  cancelAutoAttack(): void;

  // Utilities
  waitForEntity(entityId: string, timeoutMs?: number): Promise<boolean>;
  waitForCombatState(inCombat: boolean, timeoutMs?: number): Promise<boolean>;
  waitForHp(entityId: string, hp: number, comparison: "lt" | "gt" | "eq", timeoutMs?: number): Promise<boolean>;
}

export function createPlaywrightAPI(getGame: () => Game | null): PlaywrightGameAPI {
  const em = (): EntityManager | null => getGame()?.getEntityManager() ?? null;
  const localId = (): string | null => (getGame() as any)?.localEntityId ?? null;

  return {
    getPlayerPosition() {
      const id = localId();
      if (!id) return null;
      const pos = em()?.getComponent<PositionComponent>(id, "position");
      return pos ? { x: pos.x, y: pos.y, z: pos.z } : null;
    },

    getEntityList() {
      const manager = em();
      if (!manager) return [];
      const result: any[] = [];
      for (const entity of manager.getAllEntities()) {
        const identity = entity.components.get("identity") as IdentityComponent | undefined;
        const pos = entity.components.get("position") as PositionComponent | undefined;
        const stats = entity.components.get("stats") as StatsComponent | undefined;
        result.push({
          id: entity.id,
          name: identity?.name ?? "Unknown",
          type: identity?.entityType ?? "unknown",
          x: pos?.x ?? 0,
          z: pos?.z ?? 0,
          hp: stats?.hp,
          maxHp: stats?.maxHp,
        });
      }
      return result;
    },

    getEntityById(id: string) {
      const manager = em();
      if (!manager) return null;
      const entity = manager.getEntity(id);
      if (!entity) return null;
      const result: any = { id: entity.id };
      for (const [type, comp] of entity.components) {
        result[type] = { ...comp };
        if (type === "renderable") {
          delete result[type].mesh; // Not serializable
        }
      }
      return result;
    },

    getPlayerStats() {
      const id = localId();
      if (!id) return null;
      const stats = em()?.getComponent<StatsComponent>(id, "stats");
      return stats ? { hp: stats.hp, maxHp: stats.maxHp, mana: stats.mana, maxMana: stats.maxMana } : null;
    },

    getPlayerCombat() {
      const id = localId();
      if (!id) return null;
      const combat = em()?.getComponent<CombatComponent>(id, "combat");
      return combat ? { inCombat: combat.inCombat, autoAttacking: combat.autoAttacking, targetId: combat.targetEntityId } : null;
    },

    isConnected() {
      return (getGame() as any)?.network?.isConnected() ?? false;
    },

    move(direction) {
      const game = getGame();
      if (!game) return;
      const input = game.getInputManager();
      const keyMap: Record<string, string> = { w: "KeyW", a: "KeyA", s: "KeyS", d: "KeyD" };
      const code = keyMap[direction];
      if (!code) return;
      window.dispatchEvent(new KeyboardEvent("keydown", { code, bubbles: true }));
      setTimeout(() => {
        window.dispatchEvent(new KeyboardEvent("keyup", { code, bubbles: true }));
      }, 50);
    },

    moveTo(tileX, tileZ) {
      const id = localId();
      if (!id) return;
      const movement = em()?.getComponent<MovementComponent>(id, "movement");
      if (!movement || movement.moving) return;
      movement.targetX = tileX;
      movement.targetZ = tileZ;
      movement.progress = 0;
      movement.moving = true;
    },

    selectTarget(entityId) {
      const game = getGame() as any;
      if (game) {
        game.selectTarget(entityId);
      }
    },

    clearTarget() {
      const game = getGame() as any;
      if (game) {
        game.selectTarget(null);
      }
    },

    toggleAutoAttack(entityId?) {
      const game = getGame() as any;
      const targetId = entityId ?? game?.selectedTargetId;
      if (game && targetId) {
        game.sendAutoAttackToggle(targetId);
      }
    },

    cancelAutoAttack() {
      const game = getGame() as any;
      if (game?.network?.isConnected()) {
        // Import dynamically to avoid circular deps
        import("../net/Protocol").then(({ packReliable, Opcode }) => {
          game.network.sendReliable(packReliable(Opcode.AUTO_ATTACK_CANCEL, {}));
        });
      }
    },

    async waitForEntity(entityId, timeoutMs = 5000) {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        if (em()?.getEntity(entityId)) return true;
        await new Promise(r => setTimeout(r, 100));
      }
      return false;
    },

    async waitForCombatState(inCombat, timeoutMs = 10000) {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const combat = this.getPlayerCombat();
        if (combat && combat.inCombat === inCombat) return true;
        await new Promise(r => setTimeout(r, 100));
      }
      return false;
    },

    async waitForHp(entityId, hp, comparison, timeoutMs = 10000) {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const stats = em()?.getComponent<StatsComponent>(entityId, "stats");
        if (stats) {
          if (comparison === "lt" && stats.hp < hp) return true;
          if (comparison === "gt" && stats.hp > hp) return true;
          if (comparison === "eq" && stats.hp === hp) return true;
        }
        await new Promise(r => setTimeout(r, 100));
      }
      return false;
    },
  };
}
