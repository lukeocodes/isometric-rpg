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
      const catSpan = document.createElement("span");
      catSpan.style.cssText = "font-size:10px;color:#666;font-weight:400;margin-left:6px;";
      catSpan.textContent = selectedModel.category;
      infoLabel.appendChild(catSpan);
    }
    container.appendChild(infoLabel);

    // ─── Slot dropdowns (composite view) ───
    if (isComposite) {
      buildSlotDropdowns();
    }

    // ─── Ghost body toggle (individual view) ───
    if (!isComposite && selectedModel && selectedModel.category !== "body") {
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

    // ─── Colors ───
    buildColorPickers();

    // ─── Animation ───
    buildAnimationControls();
  }

  function buildSlotDropdowns() {
    const divider = document.createElement("div");
    divider.className = "section-divider";
    container.appendChild(divider);

    // Armor type (drives palette)
    appendHeading("Armor Type");
    const armorTypes: ArmorType[] = ["none", "cloth", "leather", "mail", "plate"];
    createRadioGroup("armorType", armorTypes, armorType, (v) => {
      armorType = v as ArmorType;
      rebuildPalette();

      // Full armor set mapping per type
      const sets: Record<string, Record<string, string | null>> = {
        none: { torso: null, shoulders: null, gauntlets: null, legs: null, "feet-L": null },
        cloth: { torso: "armor-cloth", shoulders: "shoulders-cloth", gauntlets: "gauntlets-cloth", legs: "legs-cloth", "feet-L": "boots-cloth" },
        leather: { torso: "armor-leather", shoulders: "shoulders-leather", gauntlets: "gauntlets-leather", legs: "legs-leather", "feet-L": "boots-leather" },
        mail: { torso: "armor-mail", shoulders: "shoulders-mail", gauntlets: "gauntlets-mail", legs: "legs-mail", "feet-L": "boots-mail" },
        plate: { torso: "armor-plate", shoulders: "shoulders-plate", gauntlets: "gauntlets-plate", legs: "legs-plate", "feet-L": "boots-plate" },
      };

      const set = sets[v];
      if (set) {
        for (const [slot, modelId] of Object.entries(set)) {
          api.setSlot(slot, modelId);
        }
      }

      // Head slot: plate→helmet, mail→coif, else→keep hair
      if (v === "plate") api.setSlot("head-top", "helmet-plate");
      else if (v === "mail") api.setSlot("head-top", "coif-mail");
      else {
        const hasHair = state.compositeConfig.attachments.some(
          (a) => a.slot === "head-top" && a.modelId.startsWith("hair-")
        );
        if (!hasHair) api.setSlot("head-top", "hair-short");
      }
    });

    // Get attachment slots from base model
    const baseModel = registry.get(state.compositeConfig.baseModelId);
    if (!baseModel) return;

    const skeleton = computeHumanoidSkeleton(0 as Direction, 0);
    const attachments = baseModel.getAttachmentPoints(skeleton);

    for (const [slotName, _point] of Object.entries(attachments)) {
      const categories = SLOT_CATEGORIES[slotName];
      if (!categories || categories.length === 0) continue;
      // Skip torso — handled by armor type selector above
      if (slotName === "torso") continue;

      const compatibleModels = categories.flatMap((cat) => registry.list(cat as any));
      if (compatibleModels.length === 0) continue;

      appendHeading(SLOT_LABELS[slotName] ?? slotName);

      const currentModelId =
        state.compositeConfig.attachments.find((a) => a.slot === slotName)?.modelId ?? "none";

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
