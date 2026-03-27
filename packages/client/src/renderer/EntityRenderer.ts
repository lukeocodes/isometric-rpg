import { Container, Graphics, Text, Sprite } from "pixi.js";
import { EntityManager } from "../ecs/EntityManager";
import type { PositionComponent } from "../ecs/components/Position";
import type { RenderableComponent } from "../ecs/components/Renderable";
import type { MovementComponent } from "../ecs/components/Movement";
import type { IdentityComponent } from "../ecs/components/Identity";
import type { StatsComponent } from "../ecs/components/Stats";
import type { CombatComponent } from "../ecs/components/Combat";
import { worldToScreen } from "./IsometricRenderer";
import { facingToDirection, directionToIsoOffset } from "./SpriteDirection";
import { EntitySpriteSheet, entityNameToSpriteType } from "./EntitySpriteSheet";

// Entity visual sizing (pixels)
// Entity visual sizing (pixels)
const BODY_WIDTH = 20;
const BODY_HEIGHT = 32;
const HEAD_RADIUS = 8;

// Target ring colors
const RING_COLOR_TARGET = 0xffd900;
const RING_COLOR_ATTACKING = 0xff3333;

// Entity scale by name — visual size differentiation
function getEntityScale(name: string): number {
  const lower = name.toLowerCase();
  if (lower.includes("rabbit")) return 0.6;
  if (lower.includes("king")) return 1.4;
  if (lower.includes("lord")) return 1.3;
  if (lower.includes("greater")) return 1.2;
  if (lower.includes("lesser")) return 0.85;
  if (lower.includes("grunt")) return 0.9;
  return 1.0;
}

// HP bar sizing
const HP_BAR_WIDTH = 30;
const HP_BAR_HEIGHT = 4;
const HP_BAR_Y_OFFSET = -BODY_HEIGHT - HEAD_RADIUS * 2 - 16; // above name label

interface AttackLine {
  graphics: Graphics;
  remaining: number;
}

interface FlashTimer {
  remaining: number;
  originalTint: number;
}

interface ChatBubble {
  container: Container;
  entityId: string;
  remaining: number;
}

interface FloatingText {
  text: Text;
  startY: number;
  elapsed: number;
  duration: number;
}

/**
 * PixiJS entity renderer — replaces Babylon.js RenderSystem.
 * Creates colored sprite containers for each entity (body + head),
 * handles z-sorting, damage flash, attack lines, and target ring.
 */
export class EntityRenderer {
  public container: Container;

  private entityManager: EntityManager;
  private localEntityId: string | null = null;
  private spriteSheet: EntitySpriteSheet | null = null;
  private flashTimers = new Map<string, FlashTimer>();
  private targetRing: Graphics | null = null;
  private targetEntityId: string | null = null;
  private autoAttacking = false;
  private attackLines: AttackLine[] = [];
  private floatingTexts: FloatingText[] = [];
  private chatBubbles: ChatBubble[] = [];
  private hpBars = new Map<string, Graphics>();
  private ringRotation = 0;

  // Derived facing for remote entities (no Movement component)
  private prevPositions = new Map<string, { x: number; z: number }>();
  private derivedFacing = new Map<string, { x: number; z: number }>();

  // Dev mode spawn point graphics
  private spawnPointGraphics = new Map<string, Graphics>();

  constructor(entityManager: EntityManager) {
    this.entityManager = entityManager;
    this.container = new Container();
    this.container.sortableChildren = true;

    // Clean up internal Maps when entities are removed to prevent memory leaks
    entityManager.onEntityRemoved((id) => {
      this.flashTimers.delete(id);
      this.prevPositions.delete(id);
      this.derivedFacing.delete(id);

      const hpBar = this.hpBars.get(id);
      if (hpBar) {
        hpBar.destroy();
        this.hpBars.delete(id);
      }

      const spGraphics = this.spawnPointGraphics.get(id);
      if (spGraphics) {
        spGraphics.destroy();
        this.spawnPointGraphics.delete(id);
      }
    });
  }

  setLocalEntityId(id: string) { this.localEntityId = id; }
  setSpriteSheet(sheet: EntitySpriteSheet) { this.spriteSheet = sheet; }

  setTargetEntity(entityId: string | null): void {
    this.targetEntityId = entityId;
    if (!entityId && this.targetRing) {
      this.targetRing.visible = false;
    }
  }

  setAutoAttacking(active: boolean): void {
    this.autoAttacking = active;
  }

  flashEntity(entityId: string, hexColor: string, duration = 0.2): void {
    const render = this.entityManager.getComponent<RenderableComponent>(entityId, "renderable");
    if (!render?.displayObject) return;
    const existing = this.flashTimers.get(entityId);
    const originalTint = existing?.originalTint ?? 0xffffff;
    const tintValue = parseInt(hexColor.replace("#", ""), 16) || 0xff0000;
    for (const child of render.displayObject.children) {
      if ("tint" in child) (child as Graphics).tint = tintValue;
    }
    this.flashTimers.set(entityId, { remaining: duration, originalTint });
  }

  /** Show a floating damage number above an entity */
  showDamageNumber(entityId: string, damage: number, weaponType?: string): void {
    const colors: Record<string, number> = {
      fire: 0xff6600, ice: 0x66ccff, shock: 0xffff44,
    };
    const color = colors[weaponType ?? ""] ?? 0xff3333;
    this.showFloatingNumber(entityId, `-${damage}`, color, 0.8);
  }

  /** Show a floating XP gain above an entity */
  showXpGain(entityId: string, xp: number): void {
    this.showFloatingNumber(entityId, `+${xp} XP`, 0x44ddff, 1.2);
  }

  private showFloatingNumber(entityId: string, label: string, color: number, duration: number): void {
    const pos = this.entityManager.getComponent<PositionComponent>(entityId, "position");
    if (!pos) return;

    const { sx, sy } = worldToScreen(pos.x, pos.z, pos.y);
    const offsetX = (Math.random() - 0.5) * 20;

    const text = new Text({
      text: label,
      style: {
        fontSize: 16,
        fontWeight: "bold",
        fill: color,
        fontFamily: "monospace",
        stroke: { color: 0x000000, width: 3 },
        dropShadow: { alpha: 0.5, distance: 1, color: 0x000000 },
      },
    });
    text.anchor.set(0.5, 0.5);
    text.position.set(sx + offsetX, sy - BODY_HEIGHT - HEAD_RADIUS * 2 - 10);
    text.zIndex = 1000000;
    this.container.addChild(text);

    this.floatingTexts.push({
      text,
      startY: text.position.y,
      elapsed: 0,
      duration,
    });
  }

  showChatBubble(entityId: string, text: string): void {
    // Remove existing bubble for this entity
    this.chatBubbles = this.chatBubbles.filter(b => {
      if (b.entityId === entityId) {
        b.container.destroy({ children: true });
        return false;
      }
      return true;
    });

    const render = this.entityManager.getComponent<RenderableComponent>(entityId, "renderable");
    if (!render?.displayObject) return;

    // Truncate long messages
    const displayText = text.length > 40 ? text.slice(0, 37) + "..." : text;

    const bubble = new Container();

    const label = new Text({
      text: displayText,
      style: {
        fontSize: 10,
        fill: 0x222222,
        fontFamily: "monospace",
        wordWrap: true,
        wordWrapWidth: 120,
      },
    });
    label.anchor.set(0.5, 1);
    label.position.set(0, -4);

    // Background rounded rect
    const bg = new Graphics();
    const padding = 6;
    const w = label.width + padding * 2;
    const h = label.height + padding * 2;
    bg.roundRect(-w / 2, -h - 4, w, h, 6);
    bg.fill({ color: 0xffffff, alpha: 0.9 });
    bg.stroke({ width: 1, color: 0xcccccc });

    // Speech pointer triangle
    bg.poly([{ x: -5, y: -4 }, { x: 5, y: -4 }, { x: 0, y: 4 }]);
    bg.fill({ color: 0xffffff, alpha: 0.9 });

    bubble.addChild(bg, label);
    bubble.position.set(0, -BODY_HEIGHT - HEAD_RADIUS * 2 - 24);
    bubble.zIndex = 999999;

    render.displayObject.addChild(bubble);
    this.chatBubbles.push({ container: bubble, entityId, remaining: 4.0 });
  }

  showAttackLine(fromId: string, toId: string): void {
    const fromPos = this.entityManager.getComponent<PositionComponent>(fromId, "position");
    const toPos = this.entityManager.getComponent<PositionComponent>(toId, "position");
    if (!fromPos || !toPos) return;

    const from = worldToScreen(fromPos.x, fromPos.z, fromPos.y);
    const to = worldToScreen(toPos.x, toPos.z, toPos.y);

    const g = new Graphics();
    g.moveTo(from.sx, from.sy - BODY_HEIGHT / 2);
    g.lineTo(to.sx, to.sy - BODY_HEIGHT / 2);
    g.stroke({ width: 2, color: 0xff4444, alpha: 0.8 });
    g.zIndex = 999999; // Always on top
    this.container.addChild(g);
    this.attackLines.push({ graphics: g, remaining: 0.15 });
  }

  update(dt = 0): void {
    // Update flash timers
    for (const [entityId, flash] of this.flashTimers) {
      flash.remaining -= dt;
      if (flash.remaining <= 0) {
        const render = this.entityManager.getComponent<RenderableComponent>(entityId, "renderable");
        if (render?.displayObject) {
          for (const child of render.displayObject.children) {
            if ("tint" in child) (child as Graphics).tint = flash.originalTint;
          }
        }
        this.flashTimers.delete(entityId);
      }
    }

    // Update attack lines
    for (let i = this.attackLines.length - 1; i >= 0; i--) {
      this.attackLines[i].remaining -= dt;
      if (this.attackLines[i].remaining <= 0) {
        this.attackLines[i].graphics.destroy();
        this.attackLines.splice(i, 1);
      }
    }

    // Update floating damage numbers
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.elapsed += dt;
      const progress = ft.elapsed / ft.duration;
      if (progress >= 1) {
        ft.text.destroy();
        this.floatingTexts.splice(i, 1);
      } else {
        // Float upward with easing (fast start, slow end)
        const ease = 1 - (1 - progress) * (1 - progress);
        ft.text.position.y = ft.startY - ease * 40;
        // Fade out in last 40%
        ft.text.alpha = progress > 0.6 ? 1 - (progress - 0.6) / 0.4 : 1;
        // Scale up slightly then back down
        const scale = progress < 0.2 ? 1 + progress * 2 : 1.4 - (progress - 0.2) * 0.5;
        ft.text.scale.set(scale);
      }
    }

    // Update chat bubbles
    for (let i = this.chatBubbles.length - 1; i >= 0; i--) {
      this.chatBubbles[i].remaining -= dt;
      if (this.chatBubbles[i].remaining <= 0) {
        this.chatBubbles[i].container.destroy({ children: true });
        this.chatBubbles.splice(i, 1);
      } else if (this.chatBubbles[i].remaining < 1) {
        // Fade out in last second
        this.chatBubbles[i].container.alpha = this.chatBubbles[i].remaining;
      }
    }

    // Update target ring
    if (this.targetEntityId) {
      const targetPos = this.entityManager.getComponent<PositionComponent>(this.targetEntityId, "position");
      if (targetPos) {
        if (!this.targetRing) {
          this.targetRing = this.createTargetRing();
          this.container.addChild(this.targetRing);
        }
        const { sx, sy } = worldToScreen(targetPos.x, targetPos.z, targetPos.y);
        this.targetRing.position.set(sx, sy);
        this.targetRing.visible = true;
        this.targetRing.zIndex = (targetPos.x + targetPos.z) * 10 - 1;
        // Pulse effect
        this.ringRotation += dt * 2;
        const pulse = 1.0 + Math.sin(this.ringRotation * 3) * 0.1;
        this.targetRing.scale.set(pulse);
        // Update color based on auto-attack state
        this.targetRing.clear();
        this.drawRingShape(this.targetRing);
      } else if (this.targetRing) {
        this.targetRing.visible = false;
      }
    }

    // Update entity positions, HP bars, and create display objects as needed
    for (const entity of this.entityManager.iterEntitiesWithComponents("position", "renderable")) {
      const pos = entity.components.get("position") as PositionComponent;
      const render = entity.components.get("renderable") as RenderableComponent;

      if (!render.displayObject) {
        render.displayObject = this.createEntitySprite(entity.id, render);
        this.container.addChild(render.displayObject);

        // Scale NPCs by max HP for visual size differentiation
        const identity = entity.components.get("identity") as IdentityComponent | undefined;
        const initStats = entity.components.get("stats") as StatsComponent | undefined;
        let targetScale = 1;
        if (identity?.entityType === "npc" && initStats) {
          targetScale = 0.7 + Math.min(0.6, initStats.maxHp / 60);
        }

        // Spawn-in animation: grow from 0 + fade in
        render.displayObject.scale.set(targetScale * 0.3);
        render.displayObject.alpha = 0;
        (render.displayObject as any)._spawning = true;
        const obj = render.displayObject;
        const ts = targetScale;
        let elapsed = 0;
        const animateIn = () => {
          elapsed += 1 / 60;
          const t = Math.min(1, elapsed / 0.35);
          const ease = 1 - (1 - t) * (1 - t); // ease-out quad
          obj.scale.set(ts * (0.3 + 0.7 * ease));
          obj.alpha = ease;
          if (t < 1) requestAnimationFrame(animateIn);
          else (obj as any)._spawning = false;
        };
        requestAnimationFrame(animateIn);
      }

      const { sx, sy } = worldToScreen(pos.x, pos.z, pos.y);
      const bobOffset = (render.displayObject as any)._bobOffset ?? 0;
      render.displayObject.position.set(sx, sy + bobOffset);
      render.displayObject.visible = render.visible;
      render.displayObject.zIndex = (pos.x + pos.z) * 10;

      // Resolve facing direction
      let fx = 0, fz = 1; // default south
      const mov = entity.components.get("movement") as MovementComponent | undefined;
      if (mov && (mov.facingX !== 0 || mov.facingZ !== 0)) {
        fx = mov.facingX;
        fz = mov.facingZ;
      } else {
        // Derive facing from position delta (remote entities / NPCs)
        const prev = this.prevPositions.get(entity.id);
        if (prev) {
          const ddx = pos.x - prev.x;
          const ddz = pos.z - prev.z;
          if (Math.abs(ddx) > 0.05 || Math.abs(ddz) > 0.05) {
            this.derivedFacing.set(entity.id, { x: Math.sign(ddx), z: Math.sign(ddz) });
          }
        }
        this.prevPositions.set(entity.id, { x: pos.x, z: pos.z });
        const facing = this.derivedFacing.get(entity.id);
        if (facing) { fx = facing.x; fz = facing.z; }
      }

      // Direction + sprite sheet frame update
      const dirIndex = facingToDirection(fx, fz);
      const prevDir = (render.displayObject as any)._dirIndex ?? -1;
      (render.displayObject as any)._dirIndex = dirIndex;

      // Swap sprite texture when direction changes (sprite sheet mode)
      const bodySprite = render.displayObject.children.find(c => c.label === "body-sprite") as Sprite | undefined;
      if (bodySprite && this.spriteSheet && prevDir !== dirIndex) {
        const spriteType = (render.displayObject as any)._spriteType as string;
        if (spriteType) {
          bodySprite.texture = this.spriteSheet.getFrame(spriteType, dirIndex);
        }
      }

      // Update eyes (Graphics mode — skip if using sprite sheet)
      if (!bodySprite) {
        const eyes = render.displayObject.children.find(c => c.label === "eyes") as Graphics | undefined;
        if (eyes) {
          const hcy = (render.displayObject as any)._headCenterY;
          const hr = (render.displayObject as any)._headRadius;
          this.drawEyes(eyes, fx, fz, hcy, hr);
        }
      }

      // Update HP bar
      const stats = entity.components.get("stats") as StatsComponent | undefined;
      const combat = entity.components.get("combat") as CombatComponent | undefined;
      const identity = entity.components.get("identity") as IdentityComponent | undefined;
      if (stats && render.displayObject) {
        const hpRatio = stats.maxHp > 0 ? stats.hp / stats.maxHp : 1;
        const showBar = hpRatio < 1 || combat?.inCombat || identity?.entityType === "npc";

        let hpBar = this.hpBars.get(entity.id);
        if (showBar) {
          if (!hpBar) {
            hpBar = new Graphics();
            render.displayObject.addChild(hpBar);
            this.hpBars.set(entity.id, hpBar);
          }
          hpBar.clear();
          // Background (dark)
          hpBar.roundRect(-HP_BAR_WIDTH / 2, HP_BAR_Y_OFFSET, HP_BAR_WIDTH, HP_BAR_HEIGHT, 1);
          hpBar.fill({ color: 0x222222, alpha: 0.8 });
          // HP fill
          const fillWidth = Math.max(1, HP_BAR_WIDTH * hpRatio);
          const barColor = hpRatio > 0.6 ? 0x44cc44 : hpRatio > 0.3 ? 0xcccc22 : 0xcc2222;
          hpBar.roundRect(-HP_BAR_WIDTH / 2, HP_BAR_Y_OFFSET, fillWidth, HP_BAR_HEIGHT, 1);
          hpBar.fill(barColor);
          // Border
          hpBar.roundRect(-HP_BAR_WIDTH / 2, HP_BAR_Y_OFFSET, HP_BAR_WIDTH, HP_BAR_HEIGHT, 1);
          hpBar.stroke({ width: 0.5, color: 0x000000, alpha: 0.5 });
          hpBar.visible = true;
        } else if (hpBar) {
          hpBar.visible = false;
        }
      }
    }
  }

  /** Fade out an entity's sprite over duration, then destroy it */
  fadeOutAndRemove(entityId: string, duration = 0.5): void {
    const render = this.entityManager.getComponent<RenderableComponent>(entityId, "renderable");
    if (!render?.displayObject) {
      this.removeEntityMesh(entityId);
      return;
    }

    const obj = render.displayObject;
    const startScale = obj.scale.x;
    render.displayObject = null; // Detach from ECS so it won't be updated

    let elapsed = 0;
    const animate = () => {
      elapsed += 1 / 60; // approximate frame time
      const progress = Math.min(1, elapsed / duration);
      obj.alpha = 1 - progress;
      obj.scale.set(startScale * (1 - progress * 0.3)); // Shrink slightly
      obj.position.y -= 0.5; // Float up slightly

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        obj.destroy({ children: true });
      }
    };
    requestAnimationFrame(animate);

    this.flashTimers.delete(entityId);
    this.hpBars.delete(entityId);
    this.prevPositions.delete(entityId);
    this.derivedFacing.delete(entityId);
  }

  removeEntityMesh(entityId: string): void {
    const render = this.entityManager.getComponent<RenderableComponent>(entityId, "renderable");
    if (render?.displayObject) {
      render.displayObject.destroy({ children: true });
      render.displayObject = null;
    }
    this.flashTimers.delete(entityId);
    this.hpBars.delete(entityId);
    this.prevPositions.delete(entityId);
    this.derivedFacing.delete(entityId);
  }

  private createEntitySprite(entityId: string, render: RenderableComponent): Container {
    const container = new Container();
    const identity = this.entityManager.getComponent<IdentityComponent>(entityId, "identity");
    const npcType = identity?.name?.toLowerCase() ?? "";
    const spriteType = entityNameToSpriteType(identity?.name ?? "");
    const isLocalPlayer = entityId === this.localEntityId;

    // Try sprite sheet mode first
    if (this.spriteSheet) {
      // Ground shadow
      const shadow = new Graphics();
      if (isLocalPlayer) {
        shadow.ellipse(0, 2, 16, 8);
        shadow.fill({ color: 0x44cc44, alpha: 0.15 });
        shadow.ellipse(0, 2, 16, 8);
        shadow.stroke({ width: 1.5, color: 0x44cc44, alpha: 0.5 });
      } else {
        shadow.ellipse(0, 2, 14, 7);
        shadow.fill({ color: 0x000000, alpha: 0.25 });
      }
      container.addChild(shadow);

      // Sprite from sheet
      const texture = this.spriteSheet.getFrame(spriteType, 0);
      const bodySprite = new Sprite(texture);
      bodySprite.label = "body-sprite";
      bodySprite.anchor.set(0.5, 1);
      bodySprite.position.set(0, 4);
      container.addChild(bodySprite);
      (container as any)._spriteType = spriteType;
    } else {
      // Fallback: Graphics mode
      const bodyColor = hexToNumber(render.bodyColor);
      const skinColor = hexToNumber(render.skinColor);

      const shadow = new Graphics();
      if (isLocalPlayer) {
        shadow.ellipse(0, 2, 16, 8);
        shadow.fill({ color: 0x44cc44, alpha: 0.15 });
        shadow.ellipse(0, 2, 16, 8);
        shadow.stroke({ width: 1.5, color: 0x44cc44, alpha: 0.5 });
      } else {
        shadow.ellipse(0, 2, 14, 7);
        shadow.fill({ color: 0x000000, alpha: 0.25 });
      }
      container.addChild(shadow);

      if (npcType.includes("rabbit")) {
        this.drawRabbitSprite(container, bodyColor, skinColor);
      } else if (npcType.includes("skeleton")) {
        this.drawSkeletonSprite(container, bodyColor);
      } else if (npcType.includes("goblin")) {
        this.drawGoblinSprite(container, bodyColor, skinColor);
      } else if (npcType.includes("imp")) {
        this.drawImpSprite(container, bodyColor);
      } else {
        this.drawHumanoidSprite(container, bodyColor, skinColor);
      }

      // Eyes (only in Graphics mode)
      const eyes = new Graphics();
      eyes.label = "eyes";
      this.drawEyes(eyes, 0, 1);
      container.addChild(eyes);
    }

    // Name label
    if (identity?.name) {
      // Color names: players blue, passive NPCs yellow, hostile NPCs red
      const isNpc = identity.entityType === "npc";
      const isPassive = npcType.includes("rabbit");
      const nameColor = !isNpc ? 0x88ddff : isPassive ? 0xcccc66 : 0xff6644;
      const label = new Text({
        text: identity.name,
        style: {
          fontSize: 10,
          fill: nameColor,
          fontFamily: "monospace",
          stroke: { color: 0x000000, width: 2 },
        },
      });
      label.anchor.set(0.5, 1);
      label.position.set(0, -BODY_HEIGHT - HEAD_RADIUS * 2 - 2);
      container.addChild(label);
    }

    // Scale by NPC type — visual size differentiation
    if (identity) {
      const scale = getEntityScale(identity.name);
      container.scale.set(scale);
    }

    return container;
  }

  private createTargetRing(): Graphics {
    const g = new Graphics();
    this.drawRingShape(g);
    return g;
  }

  private drawRingShape(g: Graphics): void {
    const color = this.autoAttacking ? RING_COLOR_ATTACKING : RING_COLOR_TARGET;
    // Draw an ellipse (isometric circle) under the entity
    g.ellipse(0, 4, 18, 9);
    g.stroke({ width: 2, color, alpha: 0.9 });
  }

  // --- Sprite type helpers ---

  private drawHumanoidSprite(c: Container, bodyColor: number, skinColor: number): void {
    const body = new Graphics();
    body.roundRect(-BODY_WIDTH / 2, -BODY_HEIGHT, BODY_WIDTH, BODY_HEIGHT, 4);
    body.fill(bodyColor);
    body.stroke({ width: 1, color: 0x000000, alpha: 0.3 });
    c.addChild(body);
    const head = new Graphics();
    head.circle(0, -BODY_HEIGHT - HEAD_RADIUS + 2, HEAD_RADIUS);
    head.fill(skinColor);
    head.stroke({ width: 1, color: 0x000000, alpha: 0.3 });
    c.addChild(head);
    (c as any)._headCenterY = -BODY_HEIGHT - HEAD_RADIUS + 2;
    (c as any)._headRadius = HEAD_RADIUS;
  }

  private drawRabbitSprite(c: Container, bodyColor: number, _skinColor: number): void {
    // Oval body (wider, shorter)
    const body = new Graphics();
    body.ellipse(0, -10, 10, 12);
    body.fill(bodyColor);
    body.stroke({ width: 1, color: 0x000000, alpha: 0.3 });
    c.addChild(body);
    // Round head
    const head = new Graphics();
    head.circle(0, -24, 7);
    head.fill(bodyColor);
    head.stroke({ width: 1, color: 0x000000, alpha: 0.3 });
    c.addChild(head);
    // Ears (two tall ovals)
    const ears = new Graphics();
    ears.ellipse(-4, -36, 2.5, 8);
    ears.ellipse(4, -36, 2.5, 8);
    ears.fill(bodyColor);
    ears.stroke({ width: 1, color: 0x000000, alpha: 0.2 });
    ears.ellipse(-4, -36, 1.5, 5);
    ears.ellipse(4, -36, 1.5, 5);
    ears.fill(0xddaaaa);
    c.addChild(ears);
    (c as any)._headCenterY = -24;
    (c as any)._headRadius = 7;
  }

  private drawSkeletonSprite(c: Container, bodyColor: number): void {
    // Thin angular body
    const body = new Graphics();
    body.roundRect(-6, -BODY_HEIGHT, 12, BODY_HEIGHT, 2);
    body.fill(bodyColor);
    body.stroke({ width: 1, color: 0x000000, alpha: 0.3 });
    // Rib lines
    body.moveTo(-5, -BODY_HEIGHT + 8); body.lineTo(5, -BODY_HEIGHT + 8);
    body.moveTo(-5, -BODY_HEIGHT + 14); body.lineTo(5, -BODY_HEIGHT + 14);
    body.moveTo(-5, -BODY_HEIGHT + 20); body.lineTo(5, -BODY_HEIGHT + 20);
    body.stroke({ width: 1, color: 0x444444, alpha: 0.5 });
    c.addChild(body);
    // Angular skull
    const head = new Graphics();
    head.roundRect(-7, -BODY_HEIGHT - 12, 14, 14, 3);
    head.fill(0xe8e0d0);
    head.stroke({ width: 1, color: 0x000000, alpha: 0.3 });
    // Jaw line
    head.moveTo(-5, -BODY_HEIGHT - 2); head.lineTo(5, -BODY_HEIGHT - 2);
    head.stroke({ width: 1, color: 0x666666, alpha: 0.4 });
    c.addChild(head);
    (c as any)._headCenterY = -BODY_HEIGHT - 5;
    (c as any)._headRadius = 7;
  }

  private drawGoblinSprite(c: Container, bodyColor: number, skinColor: number): void {
    // Short wide body
    const body = new Graphics();
    body.roundRect(-12, -22, 24, 22, 5);
    body.fill(bodyColor);
    body.stroke({ width: 1, color: 0x000000, alpha: 0.3 });
    c.addChild(body);
    // Wide head with pointed ears
    const head = new Graphics();
    head.circle(0, -30, 8);
    head.fill(skinColor);
    head.stroke({ width: 1, color: 0x000000, alpha: 0.3 });
    c.addChild(head);
    // Pointed ears
    const ears = new Graphics();
    ears.poly([{ x: -8, y: -32 }, { x: -15, y: -38 }, { x: -7, y: -28 }]);
    ears.poly([{ x: 8, y: -32 }, { x: 15, y: -38 }, { x: 7, y: -28 }]);
    ears.fill(skinColor);
    c.addChild(ears);
    (c as any)._headCenterY = -30;
    (c as any)._headRadius = 8;
  }

  private drawImpSprite(c: Container, bodyColor: number): void {
    // Small body
    const body = new Graphics();
    body.roundRect(-7, -20, 14, 20, 3);
    body.fill(bodyColor);
    body.stroke({ width: 1, color: 0x000000, alpha: 0.3 });
    c.addChild(body);
    // Head
    const head = new Graphics();
    head.circle(0, -26, 6);
    head.fill(bodyColor);
    head.stroke({ width: 1, color: 0x000000, alpha: 0.3 });
    c.addChild(head);
    // Small horns
    const horns = new Graphics();
    horns.poly([{ x: -4, y: -32 }, { x: -2, y: -38 }, { x: 0, y: -32 }]);
    horns.poly([{ x: 4, y: -32 }, { x: 2, y: -38 }, { x: 0, y: -32 }]);
    horns.fill(0x332222);
    c.addChild(horns);
    // Wings (small triangles on sides)
    const wings = new Graphics();
    wings.poly([{ x: -7, y: -18 }, { x: -18, y: -24 }, { x: -8, y: -10 }]);
    wings.poly([{ x: 7, y: -18 }, { x: 18, y: -24 }, { x: 8, y: -10 }]);
    wings.fill({ color: bodyColor, alpha: 0.6 });
    wings.stroke({ width: 1, color: 0x000000, alpha: 0.2 });
    c.addChild(wings);
    (c as any)._headCenterY = -26;
    (c as any)._headRadius = 6;
  }

  /** Draw two eye dots offset from head center based on facing direction (isometric) */
  private drawEyes(g: Graphics, facingX: number, facingZ: number, headCY?: number, headR?: number): void {
    g.clear();
    const headCenterY = headCY ?? (-BODY_HEIGHT - HEAD_RADIUS + 2);
    const hr = headR ?? HEAD_RADIUS;
    const dir = facingToDirection(facingX, facingZ);
    const iso = directionToIsoOffset(dir);
    const ox = iso.x * hr * 0.7;
    const oy = iso.y * hr * 0.7;
    // Two eyes spaced perpendicular to facing
    const perpX = -iso.y * 3.5;
    const perpY = iso.x * 3.5;
    g.circle(ox + perpX, headCenterY + oy + perpY, 2);
    g.circle(ox - perpX, headCenterY + oy - perpY, 2);
    g.fill({ color: 0x222222 });
  }

  // --- Dev mode spawn point rendering ---
  renderSpawnPoints(points: Array<{ id: string; x: number; z: number; distance: number }>): void {
    for (const sp of points) {
      if (this.spawnPointGraphics.has(sp.id)) continue;

      const g = new Graphics();
      const { sx, sy } = worldToScreen(sp.x + 0.5, sp.z + 0.5, 0);

      // Center dot
      g.circle(0, 0, 4);
      g.fill({ color: 0xffff00, alpha: 0.6 });

      // Radius ring (approximate isometric ellipse)
      const radiusPx = sp.distance * 32; // rough pixel scale
      g.ellipse(0, 0, radiusPx, radiusPx / 2);
      g.stroke({ width: 1, color: 0xffff00, alpha: 0.3 });

      g.position.set(sx, sy);
      g.zIndex = -1;
      this.container.addChild(g);
      this.spawnPointGraphics.set(sp.id, g);
    }
  }

  /** Render glowing portal markers at zone exits */
  renderZoneExits(exits: Array<{ name: string; tileX: number; tileZ: number; tileWidth: number; tileHeight: number }>, time: number): void {
    for (const exit of exits) {
      const key = `exit-${exit.name}`;
      let g = this.spawnPointGraphics.get(key);
      if (!g) {
        g = new Graphics();
        this.container.addChild(g);
        this.spawnPointGraphics.set(key, g);
      }
      g.clear();
      const cx = exit.tileX + exit.tileWidth / 2;
      const cz = exit.tileZ + exit.tileHeight / 2;
      const { sx, sy } = worldToScreen(cx, cz, 0);
      // Pulsing portal glow
      const pulse = 0.6 + Math.sin(time * 3) * 0.2;
      const w = exit.tileWidth * 16;
      const h = exit.tileHeight * 8;
      g.ellipse(0, 0, w, h);
      g.fill({ color: 0x6644cc, alpha: pulse * 0.15 });
      g.ellipse(0, 0, w * 0.7, h * 0.7);
      g.fill({ color: 0x8866ff, alpha: pulse * 0.2 });
      // Border
      g.ellipse(0, 0, w, h);
      g.stroke({ width: 2, color: 0x8866ff, alpha: pulse * 0.5 });
      // Label
      g.position.set(sx, sy);
      g.zIndex = (cx + cz) * 10 - 2;
    }
  }

  dispose(): void {
    this.container.destroy({ children: true });
    this.flashTimers.clear();
    this.attackLines.length = 0;
  }
}

function hexToNumber(hex: string): number {
  return parseInt(hex.replace("#", ""), 16);
}
