import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Scene } from "@babylonjs/core/scene";

import { EntityManager } from "../EntityManager";
import type { PositionComponent } from "../components/Position";
import type { RenderableComponent } from "../components/Renderable";

const RING_COLOR_TARGET = new Color3(1, 0.85, 0);
const RING_EMISSIVE_TARGET = new Color3(0.6, 0.5, 0);
const RING_COLOR_ATTACKING = new Color3(1, 0.2, 0.2);
const RING_EMISSIVE_ATTACKING = new Color3(0.7, 0.1, 0.1);

interface AttackLine { mesh: Mesh; remaining: number; }

export class RenderSystem {
  private entityManager: EntityManager;
  private scene: Scene;
  private flashTimers = new Map<string, { remaining: number; originalColor: Color3 }>();
  private targetRing: Mesh | null = null;
  private targetRingMat: StandardMaterial | null = null;
  private targetEntityId: string | null = null;
  private autoAttacking = false;
  private attackLines: AttackLine[] = [];

  constructor(entityManager: EntityManager, scene: Scene) {
    this.entityManager = entityManager;
    this.scene = scene;
  }

  setTargetEntity(entityId: string | null) {
    this.targetEntityId = entityId;
    if (!entityId) { if (this.targetRing) this.targetRing.isVisible = false; return; }
    if (!this.targetRing) {
      this.targetRing = MeshBuilder.CreateTorus("targetRing", { diameter: 1.0, thickness: 0.05, tessellation: 24 }, this.scene);
      this.targetRingMat = new StandardMaterial("targetRingMat", this.scene);
      this.targetRingMat.diffuseColor = RING_COLOR_TARGET.clone();
      this.targetRingMat.emissiveColor = RING_EMISSIVE_TARGET.clone();
      this.targetRing.material = this.targetRingMat;
    }
    this.targetRing.isVisible = true;
    this.updateRingColor();
  }

  setAutoAttacking(active: boolean) { this.autoAttacking = active; this.updateRingColor(); }

  flashEntity(entityId: string, hexColor: string, duration = 0.2) {
    const render = this.entityManager.getComponent<RenderableComponent>(entityId, "renderable");
    if (!render?.mesh) return;
    const mat = render.mesh.material as StandardMaterial;
    if (!mat) return;
    const existing = this.flashTimers.get(entityId);
    const originalColor = existing?.originalColor || mat.diffuseColor.clone();
    mat.diffuseColor = Color3.FromHexString(hexColor);
    this.flashTimers.set(entityId, { remaining: duration, originalColor });
  }

  showAttackLine(fromId: string, toId: string, color = "#ff4444") {
    const fromPos = this.entityManager.getComponent<PositionComponent>(fromId, "position");
    const toPos = this.entityManager.getComponent<PositionComponent>(toId, "position");
    if (!fromPos || !toPos) return;
    const line = MeshBuilder.CreateLines(`attack_${Date.now()}`, {
      points: [new Vector3(fromPos.x + 0.5, 0.8, fromPos.z + 0.5), new Vector3(toPos.x + 0.5, 0.8, toPos.z + 0.5)],
    }, this.scene);
    line.color = Color3.FromHexString(color);
    this.attackLines.push({ mesh: line, remaining: 0.15 });
  }

  update(dt = 0) {
    for (const [entityId, flash] of this.flashTimers) {
      flash.remaining -= dt;
      if (flash.remaining <= 0) {
        const render = this.entityManager.getComponent<RenderableComponent>(entityId, "renderable");
        if (render?.mesh) { const mat = render.mesh.material as StandardMaterial; if (mat) mat.diffuseColor = flash.originalColor; }
        this.flashTimers.delete(entityId);
      }
    }

    for (let i = this.attackLines.length - 1; i >= 0; i--) {
      this.attackLines[i].remaining -= dt;
      if (this.attackLines[i].remaining <= 0) { this.attackLines[i].mesh.dispose(); this.attackLines.splice(i, 1); }
    }

    if (this.targetRing && this.targetEntityId) {
      const targetPos = this.entityManager.getComponent<PositionComponent>(this.targetEntityId, "position");
      if (targetPos) {
        this.targetRing.position.x = targetPos.x + 0.5;
        this.targetRing.position.z = targetPos.z + 0.5;
        this.targetRing.position.y = 0.02;
        this.targetRing.isVisible = true;
        this.targetRing.rotation.y += dt * 2;
      } else { this.targetRing.isVisible = false; }
    }

    const entities = this.entityManager.getEntitiesWithComponents("position", "renderable");
    for (const entity of entities) {
      const pos = entity.components.get("position") as PositionComponent;
      const render = entity.components.get("renderable") as RenderableComponent;
      if (!render.mesh) render.mesh = this.createMesh(entity.id, render);
      if (render.mesh) {
        render.mesh.position.x = pos.x + 0.5;
        render.mesh.position.z = pos.z + 0.5;
        render.mesh.position.y = pos.y;
        render.mesh.isVisible = render.visible;
      }
    }
  }

  private updateRingColor() {
    if (!this.targetRingMat) return;
    if (this.autoAttacking) {
      this.targetRingMat.diffuseColor = RING_COLOR_ATTACKING.clone();
      this.targetRingMat.emissiveColor = RING_EMISSIVE_ATTACKING.clone();
    } else {
      this.targetRingMat.diffuseColor = RING_COLOR_TARGET.clone();
      this.targetRingMat.emissiveColor = RING_EMISSIVE_TARGET.clone();
    }
  }

  private createMesh(entityId: string, render: RenderableComponent) {
    const body = MeshBuilder.CreateCylinder(`body_${entityId}`, { height: 1.2, diameter: 0.6, tessellation: 12 }, this.scene);
    body.position.y = 0.6;
    body.isPickable = true;
    const bodyMat = new StandardMaterial(`bodyMat_${entityId}`, this.scene);
    bodyMat.diffuseColor = Color3.FromHexString(render.bodyColor);
    body.material = bodyMat;

    const head = MeshBuilder.CreateSphere(`head_${entityId}`, { diameter: 0.45, segments: 8 }, this.scene);
    head.parent = body;
    head.position.y = 0.85;
    head.isPickable = true;
    const headMat = new StandardMaterial(`headMat_${entityId}`, this.scene);
    headMat.diffuseColor = Color3.FromHexString(render.skinColor);
    head.material = headMat;

    return body;
  }

  removeEntityMesh(entityId: string) {
    const render = this.entityManager.getComponent<RenderableComponent>(entityId, "renderable");
    if (render?.mesh) {
      // Dispose child meshes + their materials
      for (const child of render.mesh.getChildMeshes()) {
        child.material?.dispose();
        child.dispose();
      }
      render.mesh.material?.dispose();
      render.mesh.dispose();
      render.mesh = null;
    }
    this.flashTimers.delete(entityId);
  }

  // --- Dev mode spawn point rendering ---
  private spawnPointMeshes = new Map<string, Mesh>();

  renderSpawnPoints(points: Array<{ id: string; x: number; z: number; distance: number }>) {
    for (const sp of points) {
      if (this.spawnPointMeshes.has(sp.id)) continue;

      // Center dot
      const dot = MeshBuilder.CreateSphere(`sp_${sp.id}`, { diameter: 0.2, segments: 6 }, this.scene);
      dot.position.x = sp.x + 0.5;
      dot.position.z = sp.z + 0.5;
      dot.position.y = 0.15;
      dot.isPickable = false;
      const mat = new StandardMaterial(`sp_mat_${sp.id}`, this.scene);
      mat.diffuseColor = new Color3(1, 1, 0);
      mat.emissiveColor = new Color3(0.5, 0.5, 0);
      mat.alpha = 0.6;
      dot.material = mat;

      // Radius ring
      const points2d: Vector3[] = [];
      const segments = 32;
      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        points2d.push(new Vector3(
          sp.x + 0.5 + Math.cos(angle) * sp.distance,
          0.05,
          sp.z + 0.5 + Math.sin(angle) * sp.distance,
        ));
      }
      const ring = MeshBuilder.CreateLines(`sp_ring_${sp.id}`, { points: points2d }, this.scene);
      ring.color = new Color3(1, 1, 0);
      ring.alpha = 0.3;

      this.spawnPointMeshes.set(sp.id, dot);
    }
  }
}
