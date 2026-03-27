import type { CompositeConfig, AttachmentSlot, ModelPalette } from "./models/types";
import { registry } from "./models/registry";

export type ViewMode = "composite" | "individual";
export type AnimationMode = "walk" | "attack" | "walk+attack";

export interface WorkbenchState {
  viewMode: ViewMode;
  /** Model ID when in individual view */
  selectedModelId: string | null;
  direction: number;
  walkPhase: number;
  combatPhase: number;
  animationMode: AnimationMode;
  playing: boolean;
  animSpeed: number;
  compositeConfig: CompositeConfig;
  /** Show ghost body behind individual models for context */
  showGhostBody: boolean;
}

export interface WorkbenchAPI {
  // View control
  setView(mode: ViewMode, modelId?: string): void;
  setDirection(dir: number): void;
  setWalkPhase(phase: number): void;
  toggleAnimation(playing?: boolean): void;
  setAnimSpeed(speed: number): void;
  setShowGhostBody(show: boolean): void;
  setAnimationMode(mode: AnimationMode): void;
  setCombatPhase(phase: number): void;

  // Composite config
  setSlot(slot: string, modelId: string | null): void;
  setColor(key: string, hex: string): void;
  setArmor(type: string): void;
  setBuild(build: number): void;
  setHeight(height: number): void;

  // Queries
  getState(): WorkbenchState;
  getConfig(): CompositeConfig;
  listModels(category?: string): { id: string; name: string; category: string; slot: string }[];
  listCategories(): string[];
  getDirection(): number;
  isPlaying(): boolean;

  // Events
  onChange(callback: () => void): void;
}

/**
 * Create the workbench API. Exposed as window.__workbench in dev mode.
 * Provides programmatic control — saves tokens vs Playwright DOM clicking.
 */
export function createWorkbenchAPI(state: WorkbenchState): WorkbenchAPI {
  const listeners: Array<() => void> = [];

  function notify() {
    for (const cb of listeners) cb();
  }

  const api: WorkbenchAPI = {
    setView(mode, modelId) {
      state.viewMode = mode;
      state.selectedModelId = modelId ?? null;
      notify();
    },

    setDirection(dir) {
      state.direction = dir % 8;
      notify();
    },

    setWalkPhase(phase) {
      state.walkPhase = phase;
      notify();
    },

    toggleAnimation(playing) {
      state.playing = playing ?? !state.playing;
      notify();
    },

    setAnimSpeed(speed) {
      state.animSpeed = Math.max(0.1, Math.min(3, speed));
      notify();
    },

    setShowGhostBody(show) {
      state.showGhostBody = show;
      notify();
    },

    setAnimationMode(mode) {
      state.animationMode = mode;
      // Reset phases when switching modes
      state.walkPhase = 0;
      state.combatPhase = 0;
      notify();
    },

    setCombatPhase(phase) {
      state.combatPhase = phase;
      notify();
    },

    setSlot(slot, modelId) {
      const atts = state.compositeConfig.attachments;
      const idx = atts.findIndex((a) => a.slot === slot);
      if (modelId === null) {
        if (idx >= 0) atts.splice(idx, 1);
      } else {
        if (idx >= 0) {
          atts[idx].modelId = modelId;
        } else {
          atts.push({ slot: slot as AttachmentSlot, modelId });
        }
      }
      notify();
    },

    setColor(key, hex) {
      const color = parseInt(hex.replace("#", ""), 16);
      if (key in state.compositeConfig.palette) {
        (state.compositeConfig.palette as unknown as Record<string, number>)[key] = color;
      }
      notify();
    },

    setArmor(type) {
      notify();
    },

    setBuild(build) {
      state.compositeConfig.build = Math.max(0.7, Math.min(1.3, build));
      notify();
    },

    setHeight(height) {
      state.compositeConfig.height = Math.max(0.85, Math.min(1.15, height));
      notify();
    },

    getState() {
      return { ...state };
    },

    getConfig() {
      return state.compositeConfig;
    },

    listModels(category) {
      return registry.list(category as any).map((m) => ({
        id: m.id,
        name: m.name,
        category: m.category,
        slot: m.slot,
      }));
    },

    listCategories() {
      return registry.categories();
    },

    getDirection() {
      return state.direction;
    },

    isPlaying() {
      return state.playing;
    },

    onChange(callback) {
      listeners.push(callback);
    },
  };

  return api;
}

/** Expose on window for Playwright/dev access */
export function exposeWorkbenchAPI(api: WorkbenchAPI): void {
  (window as any).__workbench = api;
}
