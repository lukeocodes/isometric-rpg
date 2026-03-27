import type { WorkbenchState, WorkbenchAPI } from "./WorkbenchAPI";
import type { ArmorType } from "./models/palette";
import { computePalette } from "./models/palette";
import { registry } from "./models/registry";
import { computeHumanoidSkeleton } from "./models/skeleton";
import type { Direction } from "./models/types";

/** Maps attachment slots to compatible model categories */
const SLOT_CATEGORIES: Record<string, string[]> = {
  "head-top": ["hair", "headgear"],
  shoulders: ["shoulders"],
  "hand-R": ["weapon"],
  "hand-L": ["offhand"],
  torso: ["armor"],
  "torso-back": [],
  gauntlets: ["gauntlets"],
  legs: ["legs"],
  "feet-L": ["feet"],
  "feet-R": [],
};

const SLOT_LABELS: Record<string, string> = {
  "head-top": "Head",
  shoulders: "Shoulders",
  "hand-R": "Weapon",
  "hand-L": "Off-hand",
  torso: "Armor",
  "torso-back": "Back",
  gauntlets: "Gauntlets",
  legs: "Legs",
  "feet-L": "Boots",
  "feet-R": "Boots",
};

/**
 * Right config panel — slot dropdowns, colors, animation controls.
 * Adapts based on whether the selected model has attachment points.
 */
export function createConfigPanel(
  container: HTMLElement,
  state: WorkbenchState,
  api: WorkbenchAPI
): { rebuild: () => void } {
  let armorType: ArmorType = "leather";

  function rebuildPalette() {
    const p = state.compositeConfig.palette;
    const newPalette = computePalette(p.skin, p.hair, p.eyes, p.primary, p.secondary, armorType);
    Object.assign(state.compositeConfig.palette, newPalette);
  }

  function rebuild() {
    container.innerHTML = "";

    // Determine if the current model has slots
    const isComposite = state.viewMode === "composite";
    const selectedModel = state.selectedModelId
      ? registry.get(state.selectedModelId)
      : null;

    // ─── Model info ───
    const infoLabel = document.createElement("h2");
    if (isComposite) {
      infoLabel.textContent = "Composite";
    } else if (selectedModel) {
      infoLabel.textContent = selectedModel.name;
      const catLabels: Record<string, string> = {
        body: "Body", hair: "Hair", armor: "Armor", weapon: "Weapon",
        offhand: "Off-hand", headgear: "Headgear", legs: "Legs",
        feet: "Boots", shoulders: "Shoulders", gauntlets: "Gauntlets", npc: "NPC",
      };
      const catSpan = document.createElement("span");
      catSpan.style.cssText = "font-size:10px;color:#666;font-weight:400;margin-left:6px;text-transform:uppercase;";
      catSpan.textContent = catLabels[selectedModel.category] ?? selectedModel.category;
      infoLabel.appendChild(catSpan);
    }
    container.appendChild(infoLabel);

    const isConstruction = !isComposite && selectedModel?.category === "construction";
    const isStatic       = !isComposite && selectedModel?.isAnimated === false;

    // ─── Slot dropdowns (composite view) ───
    if (isComposite) {
      buildSlotDropdowns();
    }

    // ─── Ghost body toggle (individual, non-body, non-construction) ───
    if (!isComposite && selectedModel && selectedModel.category !== "body" && !isConstruction) {
      const div = document.createElement("div");
      div.className = "control-group";
      div.style.marginBottom = "10px";
      const lbl = document.createElement("label");
      lbl.textContent = "Show body";
      const check = document.createElement("input");
      check.type = "checkbox";
      check.checked = state.showGhostBody;
      check.addEventListener("change", () => api.setShowGhostBody(check.checked));
      div.appendChild(lbl);
      div.appendChild(check);
      container.appendChild(div);
    }

    // ─── Body shape (composite view only) ───
    if (isComposite) {
      buildBodySliders();
    }

    // ─── Colors ───
    if (isConstruction) {
      buildConstructionControls();
    } else {
      buildColorPickers();
    }

    // ─── Animation (hidden for static models) ───
    if (!isStatic) {
      buildAnimationControls();
    }

  }

  function buildSlotDropdowns() {
    const divider = document.createElement("div");
    divider.className = "section-divider";
    container.appendChild(divider);

    // Get attachment slots from base model
    const baseModel = registry.get(state.compositeConfig.baseModelId);
    if (!baseModel) return;

    const skeleton = computeHumanoidSkeleton(0 as Direction, 0);
    const attachments = baseModel.getAttachmentPoints(skeleton);

    for (const [slotName, _point] of Object.entries(attachments)) {
      const categories = SLOT_CATEGORIES[slotName];
      if (!categories || categories.length === 0) continue;


      const compatibleModels = categories.flatMap((cat) => registry.list(cat as any));
      if (compatibleModels.length === 0) continue;

      appendHeading(SLOT_LABELS[slotName] ?? slotName);

      const existingAtt = state.compositeConfig.attachments.find((a) => a.slot === slotName);
      const currentModelId = existingAtt?.modelId ?? "none";

      const div = document.createElement("div");
      div.className = "control-group";
      const select = document.createElement("select");

      const noneOpt = document.createElement("option");
      noneOpt.value = "none";
      noneOpt.textContent = "None";
      noneOpt.selected = currentModelId === "none";
      select.appendChild(noneOpt);

      for (const model of compatibleModels) {
        const opt = document.createElement("option");
        opt.value = model.id;
        opt.textContent = model.name;
        opt.selected = model.id === currentModelId;
        select.appendChild(opt);
      }

      select.addEventListener("change", () => {
        api.setSlot(slotName, select.value === "none" ? null : select.value);
      });

      div.appendChild(select);
      container.appendChild(div);
    }
  }

  function buildBodySliders() {
    const divider = document.createElement("div");
    divider.className = "section-divider";
    container.appendChild(divider);

    appendHeading("Body Shape");

    // Build (width) slider
    createSlider("Build", state.compositeConfig.build ?? 1, 0.7, 1.3, 0.05, (v) => {
      state.compositeConfig.build = v;
    });

    // Height slider
    createSlider("Height", state.compositeConfig.height ?? 1, 0.85, 1.15, 0.05, (v) => {
      state.compositeConfig.height = v;
    });
  }

  function buildConstructionControls() {
    const divider = document.createElement("div");
    divider.className = "section-divider";
    container.appendChild(divider);

    const CONSTRUCTION_DEFAULT_PRIMARY = 0xc4b8aa;

    appendHeading("Color");
    createColorPicker("Primary", state.compositeConfig.palette.primary, (v) => {
      state.compositeConfig.palette.primary = v;
    });

    const resetDiv = document.createElement("div");
    resetDiv.className = "control-group";
    const resetBtn = document.createElement("button");
    resetBtn.textContent = "Reset to default";
    resetBtn.style.cssText = "width:auto;padding:3px 10px;font-size:11px;background:#444;";
    resetBtn.addEventListener("click", () => {
      state.compositeConfig.palette.primary = CONSTRUCTION_DEFAULT_PRIMARY;
      rebuild();
    });
    resetDiv.appendChild(resetBtn);
    container.appendChild(resetDiv);

    appendHeading("Texture");
    const div = document.createElement("div");
    div.className = "control-group";
    div.style.flexDirection = "column";
    div.style.alignItems = "flex-start";
    div.style.gap = "6px";

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.style.cssText = "font-size:11px;color:#aaa;width:100%;";

    const statusLbl = document.createElement("span");
    statusLbl.style.cssText = "font-size:10px;color:#666;";
    statusLbl.textContent = "No texture";

    fileInput.addEventListener("change", () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      // Store on state for the renderer to pick up
      (state as any)._constructionTextureUrl = url;
      statusLbl.textContent = file.name;
      api.onChange(() => {}); // trigger re-render by notifying (no-op listener)
      // Directly notify: force a redraw by touching walkPhase
      (state as any)._constructionTextureUrl = url;
    });

    const clearBtn = document.createElement("button");
    clearBtn.textContent = "Clear texture";
    clearBtn.style.cssText = "width:auto;padding:2px 8px;font-size:11px;background:#444;";
    clearBtn.addEventListener("click", () => {
      (state as any)._constructionTextureUrl = null;
      fileInput.value = "";
      statusLbl.textContent = "No texture";
    });

    div.appendChild(fileInput);
    div.appendChild(statusLbl);
    div.appendChild(clearBtn);
    container.appendChild(div);
  }

  function buildColorPickers() {
    const divider = document.createElement("div");
    divider.className = "section-divider";
    container.appendChild(divider);

    appendHeading("Colors");
    const p = state.compositeConfig.palette;
    createColorPicker("Skin", p.skin, (v) => { state.compositeConfig.palette.skin = v; rebuildPalette(); });
    createColorPicker("Hair", p.hair, (v) => { state.compositeConfig.palette.hair = v; rebuildPalette(); });
    createColorPicker("Eyes", p.eyes, (v) => { state.compositeConfig.palette.eyes = v; rebuildPalette(); });
    createColorPicker("Primary", p.primary, (v) => { state.compositeConfig.palette.primary = v; rebuildPalette(); });
    createColorPicker("Secondary", p.secondary, (v) => { state.compositeConfig.palette.secondary = v; rebuildPalette(); });
  }

  function buildAnimationControls() {
    const divider = document.createElement("div");
    divider.className = "section-divider";
    container.appendChild(divider);

    appendHeading("Animation");
    const div = document.createElement("div");
    div.className = "control-group";

    const playBtn = document.createElement("button");
    playBtn.textContent = state.playing ? "\u23f8 Pause" : "\u25b6 Play";
    playBtn.style.cssText = "width:auto;padding:4px 10px;";
    playBtn.addEventListener("click", () => {
      api.toggleAnimation();
      playBtn.textContent = state.playing ? "\u23f8 Pause" : "\u25b6 Play";
    });

    const speedLbl = document.createElement("label");
    speedLbl.textContent = "Speed";
    speedLbl.style.minWidth = "36px";

    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = "0.1";
    slider.max = "3.0";
    slider.step = "0.1";
    slider.value = String(state.animSpeed);
    slider.addEventListener("input", () => api.setAnimSpeed(parseFloat(slider.value)));

    div.appendChild(playBtn);
    div.appendChild(speedLbl);
    div.appendChild(slider);
    container.appendChild(div);
  }


  // ─── Helpers ───

  function createSlider(label: string, initial: number, min: number, max: number, step: number, onChange: (v: number) => void) {
    const div = document.createElement("div");
    div.className = "control-group";
    const lbl = document.createElement("label");
    lbl.textContent = label;
    const valSpan = document.createElement("span");
    valSpan.style.cssText = "min-width:30px;text-align:right;font-size:11px;color:#888;";
    valSpan.textContent = initial.toFixed(2);
    const input = document.createElement("input");
    input.type = "range";
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(initial);
    input.addEventListener("input", () => {
      const v = parseFloat(input.value);
      valSpan.textContent = v.toFixed(2);
      onChange(v);
    });
    div.appendChild(lbl);
    div.appendChild(input);
    div.appendChild(valSpan);
    container.appendChild(div);
  }

  function appendHeading(text: string) {
    const h2 = document.createElement("h2");
    h2.textContent = text;
    container.appendChild(h2);
  }

  function createRadioGroup(name: string, options: string[], current: string, onChange: (v: string) => void) {
    const group = document.createElement("div");
    group.className = "radio-group";
    for (const opt of options) {
      const label = document.createElement("label");
      const input = document.createElement("input");
      input.type = "radio";
      input.name = name;
      input.value = opt;
      input.checked = opt === current;
      input.addEventListener("change", () => { if (input.checked) onChange(opt); });
      const span = document.createElement("span");
      span.textContent = opt;
      label.appendChild(input);
      label.appendChild(span);
      group.appendChild(label);
    }
    container.appendChild(group);
  }

  function createColorPicker(label: string, initial: number, onChange: (v: number) => void) {
    const div = document.createElement("div");
    div.className = "control-group";
    const lbl = document.createElement("label");
    lbl.textContent = label;
    const input = document.createElement("input");
    input.type = "color";
    input.value = "#" + initial.toString(16).padStart(6, "0");
    input.addEventListener("input", () => onChange(parseInt(input.value.slice(1), 16)));
    div.appendChild(lbl);
    div.appendChild(input);
    container.appendChild(div);
  }

  rebuild();
  return { rebuild };
}
