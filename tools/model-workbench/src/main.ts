import { Application, Graphics, Text, TextStyle, Container } from "pixi.js";
import { DIRECTION_NAMES, DIRECTION_COUNT, FRAME_W, FRAME_H } from "./models/types";
import type { CompositeConfig, AttachmentSlot, ModelPalette } from "./models/types";
import { computePalette } from "./models/palette";
import { renderComposite, renderModel } from "./models/composite";
import { createModelNav } from "./ModelNav";
import { createConfigPanel } from "./ConfigPanel";
import {
  createWorkbenchAPI,
  exposeWorkbenchAPI,
  type WorkbenchState,
  type AnimationMode,
} from "./WorkbenchAPI";

// ─── Import all model barrels to trigger registration ────────────────
import "./models/bodies/index";
import "./models/weapons/index";
import "./models/offhand/index";
import "./models/armor/index";
import "./models/headgear/index";
import "./models/hair/index";

// ─── Layout constants ───────────────────────────────────────────────

const MAIN_SCALE = 5;
const GRID_SCALE = 2.5;
const STRIP_SCALE = 2;
const WALK_FRAMES = 8;
const PAD = 16;

// ─── App boot ───────────────────────────────────────────────────────

async function main() {
  const app = new Application();
  await app.init({
    background: 0x16213e,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });

  const canvasArea = document.getElementById("canvas-area")!;
  canvasArea.appendChild(app.canvas);

  function resize() {
    app.renderer.resize(canvasArea.clientWidth, canvasArea.clientHeight);
  }
  resize();
  window.addEventListener("resize", resize);

  // ─── State ──────────────────────

  const defaultPalette = computePalette(0xf0c8a0, 0x5c3a1e, 0x334455, 0x4466aa, 0x886633, "leather");

  const state: WorkbenchState = {
    viewMode: "composite",
    selectedModelId: null,
    direction: 0,
    walkPhase: 0,
    combatPhase: 0,
    animationMode: "walk",
    playing: true,
    animSpeed: 1.0,
    showGhostBody: false,
    compositeConfig: {
      baseModelId: "human-body",
      attachments: [
        { slot: "head-top" as AttachmentSlot, modelId: "hair-short" },
        { slot: "torso" as AttachmentSlot, modelId: "armor-leather" },
        { slot: "hand-R" as AttachmentSlot, modelId: "weapon-sword" },
        { slot: "hand-L" as AttachmentSlot, modelId: "shield-kite" },
      ],
      palette: defaultPalette,
      build: 1.0,
      height: 1.0,
    },
  };

  // ─── API ────────────────────────

  const api = createWorkbenchAPI(state);
  exposeWorkbenchAPI(api);

  // ─── Panels ─────────────────────

  const modelNavEl = document.getElementById("model-nav")!;
  const configPanelEl = document.getElementById("config-panel")!;

  const configPanel = createConfigPanel(configPanelEl, state, api);
  const modelNav = createModelNav(modelNavEl, state, api, () => {
    configPanel.rebuild();
  });

  // Keep panels in sync when API changes state programmatically
  api.onChange(() => {
    modelNav.refresh();
    configPanel.rebuild();
  });

  // ─── Display objects ────────────

  const bgGfx = new Graphics();
  app.stage.addChild(bgGfx);

  const mainContainer = new Container();
  const mainGfx = new Graphics();
  mainContainer.addChild(mainGfx);
  app.stage.addChild(mainContainer);

  const gridContainers: Container[] = [];
  const gridGraphics: Graphics[] = [];
  for (let i = 0; i < DIRECTION_COUNT; i++) {
    const c = new Container();
    const g = new Graphics();
    c.addChild(g);
    gridContainers.push(c);
    gridGraphics.push(g);
    app.stage.addChild(c);
  }

  const stripContainers: Container[] = [];
  const stripGraphics: Graphics[] = [];
  for (let i = 0; i < WALK_FRAMES; i++) {
    const c = new Container();
    const g = new Graphics();
    c.addChild(g);
    stripContainers.push(c);
    stripGraphics.push(g);
    app.stage.addChild(c);
  }

  const labelsContainer = new Container();
  app.stage.addChild(labelsContainer);

  // Styles
  const labelStyle = new TextStyle({ fontSize: 11, fill: 0x888888, fontFamily: "monospace" });
  const labelStyleActive = new TextStyle({ fontSize: 11, fill: 0x53a8b6, fontFamily: "monospace", fontWeight: "bold" });
  const headerStyle = new TextStyle({ fontSize: 13, fill: 0x53a8b6, fontFamily: "monospace", fontWeight: "bold" });

  const dirLabels: Text[] = [];
  for (let i = 0; i < DIRECTION_COUNT; i++) {
    const t = new Text({ text: DIRECTION_NAMES[i], style: labelStyle });
    labelsContainer.addChild(t);
    dirLabels.push(t);
  }

  const mainHeader = new Text({ text: "", style: headerStyle });
  labelsContainer.addChild(mainHeader);
  const gridHeader = new Text({ text: "8 DIRECTIONS (click to select)", style: headerStyle });
  labelsContainer.addChild(gridHeader);
  const stripHeader = new Text({ text: "WALK CYCLE", style: headerStyle });
  labelsContainer.addChild(stripHeader);

  const frameLabels: Text[] = [];
  for (let i = 0; i < WALK_FRAMES; i++) {
    const t = new Text({ text: `${i + 1}`, style: labelStyle });
    labelsContainer.addChild(t);
    frameLabels.push(t);
  }

  // ─── Click to select direction ──

  const DIR_GRID = [
    [3, 4, 5],
    [2, -1, 6],
    [1, 0, 7],
  ];

  let gridStartX = 0;
  let gridStartY = 0;
  let cellW = 0;
  let cellH = 0;

  app.stage.eventMode = "static";
  app.stage.hitArea = app.screen;
  app.stage.on("pointerdown", (e) => {
    const mx = e.global.x;
    const my = e.global.y;
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const dir = DIR_GRID[row][col];
        if (dir < 0) continue;
        const cx = gridStartX + col * cellW;
        const cy = gridStartY + row * cellH;
        if (mx >= cx && mx < cx + cellW && my >= cy && my < cy + cellH) {
          state.direction = dir;
          return;
        }
      }
    }
  });

  // ─── Render helpers ─────────────

  const CHECK_SIZE = 8;
  const CHECK_LIGHT = 0xffffff;
  const CHECK_DARK = 0xcccccc;

  function drawCheckerboard(g: Graphics, x: number, y: number, w: number, h: number): void {
    // Clip area fill first
    g.rect(x, y, w, h);
    g.fill(CHECK_DARK);

    // Light squares
    const cols = Math.ceil(w / CHECK_SIZE);
    const rows = Math.ceil(h / CHECK_SIZE);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if ((r + c) % 2 === 0) {
          const sx = x + c * CHECK_SIZE;
          const sy = y + r * CHECK_SIZE;
          const sw = Math.min(CHECK_SIZE, x + w - sx);
          const sh = Math.min(CHECK_SIZE, y + h - sy);
          g.rect(sx, sy, sw, sh);
          g.fill(CHECK_LIGHT);
        }
      }
    }
  }

  // Render a frame with both walk and combat phases
  function renderFrame(g: Graphics, dir: number, walkPhase: number, scale: number, combatPhase = 0): void {
    if (state.viewMode === "composite") {
      renderComposite(g, state.compositeConfig, dir, walkPhase, scale, combatPhase);
    } else if (state.selectedModelId) {
      renderModel(
        g,
        state.selectedModelId,
        state.compositeConfig.palette,
        dir,
        walkPhase,
        scale,
        state.showGhostBody
      );
    }
  }

  // ─── Render loop ────────────────

  app.ticker.add((ticker) => {
    if (state.playing) {
      const dt = ticker.deltaTime * 0.08 * state.animSpeed;
      const mode = state.animationMode;
      if (mode === "walk") {
        state.walkPhase += dt;
        state.combatPhase = 0;
      } else if (mode === "attack") {
        state.combatPhase += dt;
        state.walkPhase = 0;
      } else {
        // walk+attack: both run simultaneously
        state.walkPhase += dt;
        state.combatPhase += dt;
      }
    }

    // Layout
    const mainW = FRAME_W * MAIN_SCALE;
    const mainH = FRAME_H * MAIN_SCALE;
    const mainX = PAD + mainW / 2;
    const mainY = PAD + 20 + mainH - 10;

    cellW = FRAME_W * GRID_SCALE + 12;
    cellH = FRAME_H * GRID_SCALE + 24;
    gridStartX = PAD + mainW + PAD * 2;
    gridStartY = PAD + 20;

    const stripY = Math.max(mainY + 30, gridStartY + cellH * 3 + 20);
    const stripCellW = FRAME_W * STRIP_SCALE + 8;
    const stripCellH = FRAME_H * STRIP_SCALE;

    // ─── Background ─────────────

    bgGfx.clear();

    drawCheckerboard(bgGfx, mainX - mainW / 2 - 4, mainY - mainH - 4, mainW + 8, mainH + 12);

    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const dir = DIR_GRID[row][col];
        if (dir < 0) continue;
        const cx = gridStartX + col * cellW;
        const cy = gridStartY + row * cellH;
        const isActive = dir === state.direction;
        drawCheckerboard(bgGfx, cx + 2, cy + 2, cellW - 4, cellH - 4);
        if (isActive) {
          bgGfx.rect(cx + 2, cy + 2, cellW - 4, cellH - 4);
          bgGfx.stroke({ width: 1, color: 0x53a8b6, alpha: 0.6 });
        }
      }
    }

    for (let i = 0; i < WALK_FRAMES; i++) {
      const sx = PAD + i * (stripCellW + 4);
      drawCheckerboard(bgGfx, sx, stripY, stripCellW, stripCellH + 4);
    }

    // ─── Main preview ───────────

    mainContainer.position.set(mainX, mainY);
    mainGfx.clear();
    renderFrame(mainGfx, state.direction, state.walkPhase, MAIN_SCALE, state.combatPhase);

    // ─── Direction grid (shows representative pose for current mode) ─────────

    // For combat modes show a mid-swing pose in the grid; for walk show mid-stride
    const gridPhaseWalk  = state.animationMode !== "attack"  ? Math.PI * 0.4 : 0;
    const gridPhaseCombat = state.animationMode !== "walk"    ? Math.PI * 0.5 : 0; // π/2 = strike moment

    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const dir = DIR_GRID[row][col];
        if (dir < 0) continue;
        const cx = gridStartX + col * cellW + cellW / 2;
        const cy = gridStartY + row * cellH + cellH - 16;

        gridContainers[dir].position.set(cx, cy);
        gridGraphics[dir].clear();
        renderFrame(gridGraphics[dir], dir, gridPhaseWalk, GRID_SCALE, gridPhaseCombat);

        const label = dirLabels[dir];
        label.style = dir === state.direction ? labelStyleActive : labelStyle;
        label.position.set(cx - label.width / 2, cy + 4);
      }
    }

    // ─── Animation strip (adapts to mode) ─────────

    for (let i = 0; i < WALK_FRAMES; i++) {
      const framePhase = (i / WALK_FRAMES) * Math.PI * 2;
      const mode = state.animationMode;
      const stripWalk   = mode !== "attack"    ? framePhase : 0;
      const stripCombat = mode !== "walk"      ? framePhase : 0;

      const sx = PAD + i * (stripCellW + 4) + stripCellW / 2;
      const sy = stripY + stripCellH;
      stripContainers[i].position.set(sx, sy);
      stripGraphics[i].clear();
      renderFrame(stripGraphics[i], state.direction, stripWalk, STRIP_SCALE, stripCombat);
      frameLabels[i].position.set(sx - 3, sy + 6);
    }

    // ─── Headers ────────────────

    const modeLabels: Record<string, string> = {
      walk: "WALK CYCLE",
      attack: "ATTACK FRAMES",
      "walk+attack": "MOVE + ATTACK",
    };
    const viewLabel = state.viewMode === "composite"
      ? "COMPOSITE"
      : (state.selectedModelId ?? "");
    mainHeader.text = `${viewLabel}: ${DIRECTION_NAMES[state.direction]} (${state.direction})`;
    mainHeader.position.set(mainX - mainW / 2 - 4, PAD);
    gridHeader.text = `8 DIRECTIONS — ${state.animationMode.toUpperCase()} (click to select)`;
    gridHeader.position.set(gridStartX, PAD);
    stripHeader.text = modeLabels[state.animationMode] ?? "WALK CYCLE";
    stripHeader.position.set(PAD, stripY - 16);
  });
}

main().catch(console.error);
