import type { WorkbenchState, WorkbenchAPI } from "./WorkbenchAPI";
import type { ArmorType } from "./models/palette";
import { computePalette } from "./models/palette";
import { registry } from "./models/registry";
import { computeHumanoidSkeleton } from "./models/skeleton";
import type { Direction } from "./models/types";
import { generateManifestJSON } from "./models/manifest";

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

    // ─── Body shape (composite view only) ───
    if (isComposite) {
      buildBodySliders();
    }

    // ─── Colors ───
    buildColorPickers();

    // ─── Animation ───
    buildAnimationControls();

    // ─── Export ───
    if (isComposite) {
      buildExportButton();
    }
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
        // Only apply slots that the base model actually exposes
        const baseModel = registry.get(state.compositeConfig.baseModelId);
        const skeleton = computeHumanoidSkeleton(0 as Direction, 0);
        const availableSlots = new Set(
          Object.keys(baseModel?.getAttachmentPoints(skeleton) ?? {})
        );

        for (const [slot, modelId] of Object.entries(set)) {
          if (availableSlots.has(slot)) {
            api.setSlot(slot, modelId);
          }
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

  function buildExportButton() {
    const divider = document.createElement("div");
    divider.className = "section-divider";
    container.appendChild(divider);

    appendHeading("Export");
    const div = document.createElement("div");
    div.className = "control-group";

    const exportBtn = document.createElement("button");
    exportBtn.textContent = "Copy JSON";
    exportBtn.style.cssText = "width:auto;padding:4px 12px;";
    exportBtn.addEventListener("click", () => {
      const config = state.compositeConfig;
      const exportData = {
        baseModelId: config.baseModelId,
        build: config.build ?? 1,
        height: config.height ?? 1,
        attachments: config.attachments.map(a => ({ slot: a.slot, modelId: a.modelId })),
        palette: {
          skin: "#" + config.palette.skin.toString(16).padStart(6, "0"),
          hair: "#" + config.palette.hair.toString(16).padStart(6, "0"),
          eyes: "#" + config.palette.eyes.toString(16).padStart(6, "0"),
          primary: "#" + config.palette.primary.toString(16).padStart(6, "0"),
          secondary: "#" + config.palette.secondary.toString(16).padStart(6, "0"),
        },
      };
      const json = JSON.stringify(exportData, null, 2);
      navigator.clipboard.writeText(json).then(() => {
        exportBtn.textContent = "Copied!";
        setTimeout(() => { exportBtn.textContent = "Copy JSON"; }, 1500);
      }).catch(() => {
        // Fallback: show in a textarea
        const ta = document.createElement("textarea");
        ta.value = json;
        ta.style.cssText = "width:100%;height:120px;font-size:10px;background:#1a1a2e;color:#ccc;border:1px solid #333;border-radius:3px;margin-top:4px;resize:vertical;";
        ta.readOnly = true;
        div.appendChild(ta);
        ta.select();
      });
    });

    const importBtn = document.createElement("button");
    importBtn.textContent = "Import JSON";
    importBtn.style.cssText = "width:auto;padding:4px 12px;margin-left:4px;background:#444;";
    importBtn.addEventListener("click", () => {
      navigator.clipboard.readText().then((text) => {
        try {
          const data = JSON.parse(text);
          if (data.baseModelId) {
            state.compositeConfig.baseModelId = data.baseModelId;
          }
          if (data.build != null) state.compositeConfig.build = data.build;
          if (data.height != null) state.compositeConfig.height = data.height;
          if (data.attachments) {
            state.compositeConfig.attachments = data.attachments;
          }
          if (data.palette) {
            const p = state.compositeConfig.palette;
            for (const key of ["skin", "hair", "eyes", "primary", "secondary"] as const) {
              if (data.palette[key]) {
                (p as any)[key] = parseInt(data.palette[key].replace("#", ""), 16);
              }
            }
            rebuildPalette();
          }
          importBtn.textContent = "Imported!";
          setTimeout(() => { importBtn.textContent = "Import JSON"; }, 1500);
          rebuild();
        } catch {
          importBtn.textContent = "Invalid JSON";
          setTimeout(() => { importBtn.textContent = "Import JSON"; }, 1500);
        }
      });
    });

    div.appendChild(exportBtn);
    div.appendChild(importBtn);
    container.appendChild(div);

    // Manifest export (all models)
    const manifestDiv = document.createElement("div");
    manifestDiv.className = "control-group";
    manifestDiv.style.marginTop = "6px";
    const manifestBtn = document.createElement("button");
    manifestBtn.textContent = "Copy Model Manifest";
    manifestBtn.style.cssText = "width:auto;padding:4px 12px;font-size:11px;background:#335;";
    manifestBtn.addEventListener("click", () => {
      const json = generateManifestJSON();
      navigator.clipboard.writeText(json).then(() => {
        manifestBtn.textContent = "Manifest Copied!";
        setTimeout(() => { manifestBtn.textContent = "Copy Model Manifest"; }, 1500);
      });
    });
    const countSpan = document.createElement("span");
    countSpan.style.cssText = "font-size:10px;color:#666;margin-left:6px;";
    countSpan.textContent = `${registry.list().length} models`;
    manifestDiv.appendChild(manifestBtn);
    manifestDiv.appendChild(countSpan);
    container.appendChild(manifestDiv);
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
