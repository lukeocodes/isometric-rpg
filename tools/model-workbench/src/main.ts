import { Application, Graphics, Container, Texture, Assets, RenderTexture, Sprite } from "pixi.js";
import { DIRECTION_NAMES, DIRECTION_COUNT, FRAME_W, FRAME_H } from "./models/types";
import { computePalette } from "./models/palette";
import { renderComposite, renderModel } from "./models/composite";
import { registry } from "./models/registry";
import { computeHumanoidSkeleton } from "./models/skeleton";
import type { Direction } from "./models/types";
import { ATTACK_PHASES } from "./models/WorkbenchSpriteSheet";
import type { AnimationState } from "./models/WorkbenchSpriteSheet";
import { createModelNav } from "./ModelNav";
import { createConfigPanel } from "./ConfigPanel";
import {
  createWorkbenchAPI,
  exposeWorkbenchAPI,
  type WorkbenchState,
} from "./WorkbenchAPI";

// ─── Import all model barrels to trigger registration ────────────────
import "./models/bodies/index";
import "./models/weapons/index";
import "./models/offhand/index";
import "./models/armor/index";
import "./models/headgear/index";
import "./models/hair/index";
import "./models/structures/index";

// ─── Constants ──────────────────────────────────────────────────────

const MAIN_SCALE_DEFAULT = 5;
const GRID_SCALE = 1.4;
const GRID_QUALITY  = 3;   // render grid cells at 3× resolution, display at 1×
const WALK_FRAMES = 8;
const GRID_CELL_SIZE = 90; // CSS px per direction cell

// Direction layout: compass rose
// Row 0: NW(3) N(4) NE(5)
// Row 1:  W(2)  -   E(6)
// Row 2: SW(1) S(0) SE(7)
const DIR_GRID: (number | null)[][] = [
  [3, 4, 5],
  [2, null, 6],
  [1, 0, 7],
];

// ─── App boot ───────────────────────────────────────────────────────

async function main() {
  // ─── PixiJS app ──────────────────────────────────────────────────
  const app = new Application();
  await app.init({
    background: 0x0d1117,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });
  app.ticker.maxFPS = 60;

  const canvasArea = document.getElementById("canvas-area")!;
  canvasArea.appendChild(app.canvas);

  function resizeMain() {
    app.renderer.resize(canvasArea.clientWidth, canvasArea.clientHeight);
  }
  resizeMain();
  new ResizeObserver(resizeMain).observe(canvasArea);

  // ─── State ──────────────────────────────────────────────────────

  const defaultPalette = computePalette(0xf0c8a0, 0x5c3a1e, 0x334455, 0x4466aa, 0x886633, "leather");

  const state: WorkbenchState = {
    viewMode: "composite",
    selectedModelId: null,
    direction: 0,
    walkPhase: 0,
    playing: true,
    animSpeed: 1.0,
    showGhostBody: false,
    animationState: "peace",
    attackPhase: 0,
    frozenFrameIndex: null,
    compositeConfig: {
      baseModelId: "human-body",
      attachments: [],
      palette: defaultPalette,
      build: 1.0,
      height: 1.0,
    },
    savedModels: [],
    serverOnline: false,
  };

  // ─── API ────────────────────────────────────────────────────────

  const api = createWorkbenchAPI(state);
  exposeWorkbenchAPI(api);

  // Load saved models from server (graceful if offline)
  api.reloadSavedModels().catch(() => {});

  // ─── Panels ─────────────────────────────────────────────────────

  const modelNavEl = document.getElementById("model-nav")!;
  const configPanelEl = document.getElementById("config-panel")!;

  const configPanel = createConfigPanel(configPanelEl, state, api);
  const modelNav = createModelNav(modelNavEl, state, api, () => {
    configPanel.rebuild();
  });

  api.onChange(() => {
    modelNav.refresh();
    configPanel.rebuild();
    updateServerStatusUI();
  });

  // ─── Server status indicator ─────────────────────────────────────
  const serverStatusEl = document.getElementById("server-status")!;
  const serverStatusText = document.getElementById("server-status-text")!;

  function updateServerStatusUI() {
    if (state.serverOnline) {
      serverStatusEl.className = "server-status online";
      serverStatusText.textContent = "Server online";
    } else {
      serverStatusEl.className = "server-status offline";
      serverStatusText.textContent = "Server offline";
    }
  }
  updateServerStatusUI();

  // ─── Centre toolbar wiring ────────────────────────────────────────

  const animToggleBtns = document.querySelectorAll<HTMLButtonElement>(".anim-toggle-btn");
  const attackSubmode = document.getElementById("attack-submode")!;
  const submodeBtns = document.querySelectorAll<HTMLButtonElement>(".submode-btn");

  animToggleBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.mode!;
      animToggleBtns.forEach(b => b.classList.toggle("active", b === btn));
      if (mode === "attack") {
        attackSubmode.classList.remove("hidden");
        const sub = document.querySelector<HTMLButtonElement>(".submode-btn.active")?.dataset.sub ?? "stationary";
        state.animationState = sub === "moving" ? "attack-moving" : "attack-stationary";
      } else {
        attackSubmode.classList.add("hidden");
        state.animationState = "peace";
      }
      buildFrameScrubber();
    });
  });

  submodeBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      submodeBtns.forEach(b => b.classList.toggle("active", b === btn));
      const sub = btn.dataset.sub!;
      state.animationState = sub === "moving" ? "attack-moving" : "attack-stationary";
    });
  });

  // ─── URL routing ────────────────────────────────────────────────
  {
    const params = new URLSearchParams(window.location.search);
    const modelId = params.get("model");
    if (modelId) {
      const model = api.listModels().find(m => m.id === modelId);
      if (model) {
        if (model.slot === "root" && model.category !== "construction") {
          state.compositeConfig.baseModelId = modelId;
          const sk = computeHumanoidSkeleton(0 as Direction, 0);
          const available = new Set(Object.keys(registry.get(modelId)?.getAttachmentPoints(sk) ?? {}));
          state.compositeConfig.attachments = state.compositeConfig.attachments.filter(
            a => available.has(a.slot)
          );
          api.setView("composite");
        } else {
          api.setView("individual", modelId);
        }
        modelNav.refresh();
        configPanel.rebuild();
      }
    }
  }

  // ─── Construction texture cache ───────────────────────────────────
  let _texUrl: string | null = null;
  let _tex: Texture | null = null;

  async function loadConstructionTexture(url: string): Promise<Texture> {
    if (url !== _texUrl) {
      _texUrl = url;
      _tex = await Assets.load<Texture>(url);
    }
    return _tex!;
  }

  function isStatic(): boolean {
    if (state.viewMode === "individual" && state.selectedModelId) {
      return registry.get(state.selectedModelId)?.isAnimated === false;
    }
    return false;
  }

  // ─── Render helpers ──────────────────────────────────────────────

  function renderFrame(g: Graphics, dir: number, phase: number, scale: number): void {
    const texUrl = (state as any)._constructionTextureUrl as string | null;
    const tex = texUrl === _texUrl ? _tex : null;
    if (texUrl && texUrl !== _texUrl) {
      loadConstructionTexture(texUrl).catch(() => {});
    }

    if (state.viewMode === "composite") {
      renderComposite(g, state.compositeConfig, dir, phase, scale);
    } else if (state.selectedModelId) {
      renderModel(
        g,
        state.selectedModelId,
        state.compositeConfig.palette,
        dir,
        phase,
        scale,
        state.showGhostBody,
        tex ?? undefined
      );
    }
  }

  // ─── Offscreen render helper ─────────────────────────────────────
  // For the direction grid we render into RenderTextures then display as Sprites
  // so we can use a single PixiJS app for all 8 cells.

  // Display size (CSS pixels) — keep the visual footprint the same as before
  const GRID_DISPLAY_W = Math.round(FRAME_W * GRID_SCALE * 1.5);
  const GRID_DISPLAY_H = Math.round(FRAME_H * GRID_SCALE * 1.5);
  // Render at GRID_QUALITY× for crisp display on all screens
  const GRID_RT_W = GRID_DISPLAY_W * GRID_QUALITY;
  const GRID_RT_H = GRID_DISPLAY_H * GRID_QUALITY;

  interface DirCellRt {
    rt: RenderTexture;
    gfx: Graphics;
    offContainer: Container;
    imgEl: HTMLImageElement;
  }

  const dirCellRts: Map<number, DirCellRt> = new Map();

  function buildDirGrid() {
    const dirGridEl = document.getElementById("dir-grid")!;
    dirGridEl.innerHTML = "";
    dirCellRts.clear();

    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const dir = DIR_GRID[row][col];
        const cellEl = document.createElement("div");

        if (dir === null) {
          cellEl.className = "dir-cell empty";
          dirGridEl.appendChild(cellEl);
          continue;
        }

        cellEl.className = "dir-cell" + (dir === state.direction ? " active" : "");
        cellEl.dataset.dir = String(dir);

        // Label
        const labelEl = document.createElement("div");
        labelEl.className = "dir-label";
        labelEl.textContent = DIRECTION_NAMES[dir];

        // Image element to display the RenderTexture
        const img = document.createElement("img");
        // Display at logical size; texture is GRID_QUALITY× larger for crispness
        img.style.cssText = `
          position: absolute;
          top: 0; left: 50%;
          transform: translateX(-50%);
          width: ${GRID_DISPLAY_W}px;
          height: ${Math.round(GRID_DISPLAY_H * 0.78)}px;
          image-rendering: auto;
          pointer-events: none;
        `;
        cellEl.appendChild(img);
        cellEl.appendChild(labelEl);

        // Click to select direction
        cellEl.addEventListener("click", () => {
          state.direction = dir;
          updateDirCellActiveStates();
          updateFrameScrubber();
        });

        // Offscreen PixiJS container for this direction
        const gfx = new Graphics();
        const offContainer = new Container();
        offContainer.addChild(gfx);
        // Origin at centre-x, near bottom — scaled with GRID_QUALITY
        gfx.position.set(GRID_RT_W / 2, GRID_RT_H - 4 * GRID_QUALITY);

        const rt = RenderTexture.create({ width: GRID_RT_W, height: GRID_RT_H });

        dirCellRts.set(dir, { rt, gfx, offContainer, imgEl: img });
        dirGridEl.appendChild(cellEl);
      }
    }
  }

  function updateDirCellActiveStates() {
    const cells = document.querySelectorAll<HTMLElement>(".dir-cell:not(.empty)");
    cells.forEach(c => {
      const dir = parseInt(c.dataset.dir ?? "-1");
      c.classList.toggle("active", dir === state.direction);
    });
  }

  // ─── Main preview (large selected-direction preview) ─────────────

  const mainContainer = new Container();
  const mainGfx = new Graphics();
  mainContainer.addChild(mainGfx);
  app.stage.addChild(mainContainer);

  // ─── Preview drag interaction ─────────────────────────────────────
  // Horizontal drag → rotate direction (40px per step), vertical drag → zoom

  let mainScale = MAIN_SCALE_DEFAULT;
  let previewDrag: { startX: number; startY: number; startDir: number; startScale: number } | null = null;

  app.canvas.style.cursor = "grab";

  app.canvas.addEventListener("pointerdown", (e) => {
    previewDrag = {
      startX: e.clientX, startY: e.clientY,
      startDir: state.direction, startScale: mainScale,
    };
    app.canvas.setPointerCapture(e.pointerId);
    app.canvas.style.cursor = "grabbing";
  });

  app.canvas.addEventListener("pointermove", (e) => {
    if (!previewDrag) return;
    const dx = e.clientX - previewDrag.startX;
    const dy = e.clientY - previewDrag.startY;
    // 40px horizontal drag = 1 direction step (clockwise)
    const dirDelta = Math.round(dx / 40);
    state.direction = ((previewDrag.startDir + dirDelta) % 8 + 8) % 8 as Direction;
    // 35px vertical drag up = zoom in
    mainScale = Math.max(2, Math.min(12, previewDrag.startScale - dy / 35));
  });

  app.canvas.addEventListener("pointerup", () => {
    previewDrag = null;
    app.canvas.style.cursor = "grab";
  });

  // Scroll wheel also zooms
  app.canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    mainScale = Math.max(2, Math.min(12, mainScale - e.deltaY * 0.025));
  }, { passive: false });

  // ─── Frame scrubber ──────────────────────────────────────────────

  const frameScrubberEl = document.getElementById("frame-scrubber")!;
  let frameThumbs: HTMLElement[] = [];

  function buildFrameScrubber() {
    frameScrubberEl.innerHTML = "";
    frameThumbs = [];

    const label = document.createElement("span");
    label.className = "scrub-label";
    label.textContent = state.animationState === "peace" ? "Walk" : "Attack";
    frameScrubberEl.appendChild(label);

    const totalFrames = state.animationState === "peace" ? WALK_FRAMES : ATTACK_PHASES;
    for (let i = 0; i < totalFrames; i++) {
      const thumb = document.createElement("div");
      thumb.className = "frame-thumb";
      thumb.textContent = String(i + 1);
      thumb.classList.toggle("active", state.frozenFrameIndex === i);
      thumb.classList.toggle("frozen", state.frozenFrameIndex === i);

      thumb.addEventListener("click", () => {
        if (state.frozenFrameIndex === i) {
          api.freezeFrame(null);
          state.playing = true;
        } else {
          api.freezeFrame(i);
        }
        updateFrameScrubber();
      });

      frameThumbs.push(thumb);
      frameScrubberEl.appendChild(thumb);
    }
  }

  function updateFrameScrubber() {
    const totalFrames = state.animationState === "peace" ? WALK_FRAMES : ATTACK_PHASES;
    const currentActive = Math.floor(
      ((state.frozenFrameIndex !== null
        ? (state.frozenFrameIndex / totalFrames)
        : (state.walkPhase / (Math.PI * 2))) * totalFrames)
    ) % totalFrames;

    frameThumbs.forEach((t, i) => {
      t.classList.toggle("active", i === currentActive && state.frozenFrameIndex === null);
      t.classList.toggle("frozen", i === state.frozenFrameIndex);
    });
  }

  // ─── Ticker / render loop ────────────────────────────────────────

  // Throttle grid renders to ~15fps to save GPU bandwidth
  let gridFrameAcc = 0;
  const GRID_RENDER_INTERVAL = 1000 / 15;

  app.ticker.add((ticker) => {
    const staticModel = isStatic();

    // Advance phase
    if (state.playing && !staticModel && state.frozenFrameIndex === null) {
      state.walkPhase += ticker.deltaTime * 0.08 * state.animSpeed;
      if (state.animationState !== "peace") {
        state.attackPhase = (state.attackPhase + ticker.deltaTime * 0.06 * state.animSpeed) % ATTACK_PHASES;
      }
    }

    const phase = state.frozenFrameIndex !== null
      ? (state.frozenFrameIndex / WALK_FRAMES) * Math.PI * 2
      : state.walkPhase;

    // ─── Main preview ────────────────────────────────────────────
    const mainH = FRAME_H * mainScale;
    mainContainer.position.set(app.renderer.width / 2, app.renderer.height / 2 + mainH / 2);
    mainGfx.clear();
    renderFrame(mainGfx, staticModel ? 0 : state.direction, staticModel ? 0 : phase, mainScale);

    // ─── Direction grid (throttled) ──────────────────────────────
    gridFrameAcc += ticker.elapsedMS;
    if (!staticModel && gridFrameAcc >= GRID_RENDER_INTERVAL) {
      gridFrameAcc = 0;
      for (const [dir, cell] of dirCellRts) {
        cell.gfx.clear();
        renderFrame(cell.gfx, dir, phase, GRID_SCALE * GRID_QUALITY);
        app.renderer.render({ container: cell.offContainer, target: cell.rt });
        // Export as data URL for the <img> element
        const canvas = app.renderer.extract.canvas({ target: cell.rt }) as HTMLCanvasElement;
        cell.imgEl.src = canvas.toDataURL("image/png");
      }
    }

    updateFrameScrubber();
  });

  buildDirGrid();
  buildFrameScrubber();
}

main().catch(console.error);
