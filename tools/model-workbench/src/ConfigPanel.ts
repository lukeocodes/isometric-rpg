import type { WorkbenchState, WorkbenchAPI, SavedModelEntry } from "./WorkbenchAPI";
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

// ─── Searchable Slot Picker ─────────────────────────────────────────────────

interface PickerOption {
  value: string;
  label: string;
  isDb?: boolean;
}

interface SlotPickerOpts {
  label: string;
  options: PickerOption[];
  current: string;
  savedOptions: PickerOption[];
  onChange: (value: string | null) => void;
}

function createSlotPicker(opts: SlotPickerOpts): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "cfg-row";

  const lbl = document.createElement("label");
  lbl.textContent = opts.label;
  wrap.appendChild(lbl);

  const pickerWrap = document.createElement("div");
  pickerWrap.className = "slot-picker-wrap";

  const trigger = document.createElement("button");
  trigger.className = "slot-picker-trigger";
  trigger.setAttribute("tabindex", "0");

  const valueSpan = document.createElement("span");
  valueSpan.className = "picker-value";
  const currentOpt = [...opts.options, ...opts.savedOptions].find(o => o.value === opts.current);
  valueSpan.textContent = currentOpt?.label ?? "None";

  const clearBtn = document.createElement("span");
  clearBtn.className = "picker-clear";
  clearBtn.title = "Clear slot";
  clearBtn.textContent = "×";
  clearBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    opts.onChange(null);
    valueSpan.textContent = "None";
    dropdown.classList.add("hidden");
  });

  trigger.appendChild(valueSpan);
  if (opts.current !== "none") trigger.appendChild(clearBtn);

  // Dropdown
  const dropdown = document.createElement("div");
  dropdown.className = "slot-picker-dropdown hidden";

  const searchWrap = document.createElement("div");
  searchWrap.className = "picker-search";
  const searchInput = document.createElement("input");
  searchInput.type = "search";
  searchInput.placeholder = "Search...";
  searchInput.autocomplete = "off";
  searchWrap.appendChild(searchInput);
  dropdown.appendChild(searchWrap);

  const listEl = document.createElement("div");
  listEl.className = "picker-list";
  dropdown.appendChild(listEl);

  function buildList(query: string) {
    listEl.innerHTML = "";
    const q = query.toLowerCase();

    // None option
    const noneOpt = document.createElement("div");
    noneOpt.className = "picker-option none-opt" + (opts.current === "none" ? " active" : "");
    noneOpt.textContent = "None";
    noneOpt.addEventListener("click", () => {
      opts.onChange(null);
      valueSpan.textContent = "None";
      dropdown.classList.add("hidden");
    });
    listEl.appendChild(noneOpt);

    // Base model options
    const filtered = opts.options.filter(o =>
      !q || o.label.toLowerCase().includes(q) || o.value.includes(q)
    );
    if (filtered.length > 0) {
      const grpLabel = document.createElement("div");
      grpLabel.className = "picker-group-label";
      grpLabel.textContent = "Base Models";
      listEl.appendChild(grpLabel);
      for (const opt of filtered) {
        const div = document.createElement("div");
        div.className = "picker-option" + (opt.value === opts.current ? " active" : "");
        div.textContent = opt.label;
        div.addEventListener("click", () => {
          opts.onChange(opt.value);
          valueSpan.textContent = opt.label;
          dropdown.classList.add("hidden");
        });
        listEl.appendChild(div);
      }
    }

    // Saved DB model options
    const filteredSaved = opts.savedOptions.filter(o =>
      !q || o.label.toLowerCase().includes(q) || o.value.includes(q)
    );
    if (filteredSaved.length > 0) {
      const grpLabel = document.createElement("div");
      grpLabel.className = "picker-group-label";
      grpLabel.textContent = "Saved (DB)";
      listEl.appendChild(grpLabel);
      for (const opt of filteredSaved) {
        const div = document.createElement("div");
        div.className = "picker-option" + (opt.value === opts.current ? " active" : "");
        const nameSpan = document.createElement("span");
        nameSpan.style.flex = "1";
        nameSpan.textContent = opt.label;
        const dbBadge = document.createElement("span");
        dbBadge.className = "db-badge";
        dbBadge.textContent = "DB";
        div.appendChild(nameSpan);
        div.appendChild(dbBadge);
        div.addEventListener("click", () => {
          opts.onChange(opt.value);
          valueSpan.textContent = opt.label;
          dropdown.classList.add("hidden");
        });
        listEl.appendChild(div);
      }
    }
  }

  searchInput.addEventListener("input", () => buildList(searchInput.value));

  trigger.addEventListener("click", () => {
    const hidden = dropdown.classList.contains("hidden");
    // Close all other dropdowns
    document.querySelectorAll(".slot-picker-dropdown").forEach(d => d.classList.add("hidden"));
    if (hidden) {
      dropdown.classList.remove("hidden");
      buildList("");
      searchInput.value = "";
      searchInput.focus();
    }
  });

  // Close on outside click
  document.addEventListener("click", (e) => {
    if (!pickerWrap.contains(e.target as Node)) {
      dropdown.classList.add("hidden");
    }
  }, { capture: true });

  buildList("");

  pickerWrap.appendChild(trigger);
  pickerWrap.appendChild(dropdown);
  wrap.appendChild(pickerWrap);
  return wrap;
}

// ─── Config Panel ────────────────────────────────────────────────────────────

/**
 * Right config panel — slot pickers, colors, body shape, save/load.
 */
export function createConfigPanel(
  _container: HTMLElement,
  state: WorkbenchState,
  api: WorkbenchAPI
): { rebuild: () => void } {
  const scrollEl = document.getElementById("config-scroll")!;
  const titleEl = document.getElementById("config-title")!;
  const subtitleEl = document.getElementById("config-subtitle")!;

  let armorType: ArmorType = "leather";

  function rebuildPalette() {
    const p = state.compositeConfig.palette;
    const newPalette = computePalette(p.skin, p.hair, p.eyes, p.primary, p.secondary, armorType);
    Object.assign(state.compositeConfig.palette, newPalette);
  }

  function rebuild() {
    scrollEl.innerHTML = "";

    const isComposite = state.viewMode === "composite";
    const selectedModel = state.selectedModelId ? registry.get(state.selectedModelId) : null;

    // Update header
    if (isComposite) {
      const base = registry.get(state.compositeConfig.baseModelId);
      titleEl.textContent = "Composite";
      subtitleEl.textContent = base?.name ?? state.compositeConfig.baseModelId;
    } else if (selectedModel) {
      titleEl.textContent = selectedModel.name;
      subtitleEl.textContent = selectedModel.category.toUpperCase();
    }

    const isConstruction = !isComposite && selectedModel?.category === "construction";
    const isStatic = !isComposite && selectedModel?.isAnimated === false;

    // Offline notice
    if (!state.serverOnline) {
      const notice = document.createElement("div");
      notice.className = "offline-notice";
      notice.textContent = "Server offline — DB models unavailable";
      scrollEl.appendChild(notice);
    }

    // ─── Slot pickers (composite view) ───
    if (isComposite) {
      buildSlotPickers();
    }

    // ─── Ghost body toggle (individual non-body non-construction) ───
    if (!isComposite && selectedModel && selectedModel.category !== "body" && !isConstruction) {
      const section = addSection("Context");
      const row = document.createElement("div");
      row.className = "cfg-row";
      const lbl = document.createElement("label");
      lbl.textContent = "Show body";
      const check = document.createElement("input");
      check.type = "checkbox";
      check.checked = state.showGhostBody;
      check.addEventListener("change", () => api.setShowGhostBody(check.checked));
      row.appendChild(lbl);
      row.appendChild(check);
      section.appendChild(row);
    }

    // ─── Body shape (composite) ───
    if (isComposite) {
      const section = addSection("Body Shape");
      createSlider(section, "Build", state.compositeConfig.build ?? 1, 0.7, 1.3, 0.05, (v) => {
        state.compositeConfig.build = v;
      });
      createSlider(section, "Height", state.compositeConfig.height ?? 1, 0.85, 1.15, 0.05, (v) => {
        state.compositeConfig.height = v;
      });
    }

    // ─── Colors ───
    if (isConstruction) {
      buildConstructionControls();
    } else {
      buildColorPickers();
    }

    // ─── Animation ───
    if (!isStatic) {
      buildAnimationControls();
    }

    // ─── Save / Load ───
    buildSaveLoad();
  }

  function addSection(title: string): HTMLElement {
    const sec = document.createElement("div");
    sec.className = "cfg-section";
    const titleEl = document.createElement("div");
    titleEl.className = "cfg-section-title";
    titleEl.textContent = title;
    sec.appendChild(titleEl);
    scrollEl.appendChild(sec);
    return sec;
  }

  function buildSlotPickers() {
    const baseModel = registry.get(state.compositeConfig.baseModelId);
    if (!baseModel) return;

    const skeleton = computeHumanoidSkeleton(0 as Direction, 0);
    const attachments = baseModel.getAttachmentPoints(skeleton);

    const slots = Object.entries(attachments);
    if (slots.length === 0) return;

    const section = addSection("Equipment Slots");

    for (const [slotName] of slots) {
      const categories = SLOT_CATEGORIES[slotName];
      if (!categories || categories.length === 0) continue;

      const compatibleModels = categories.flatMap((cat) => registry.list(cat as any));
      if (compatibleModels.length === 0) continue;

      const existingAtt = state.compositeConfig.attachments.find((a) => a.slot === slotName);
      const currentModelId = existingAtt?.modelId ?? "none";

      // Saved models that could go in this slot — for now use all saved models as alternatives
      const savedOpts: PickerOption[] = state.savedModels
        .filter(m => {
          const base = registry.get(m.baseModelId);
          return base && categories.includes(base.category);
        })
        .map(m => ({ value: `saved:${m.id}`, label: m.name, isDb: true }));

      const pickerEl = createSlotPicker({
        label: SLOT_LABELS[slotName] ?? slotName,
        options: compatibleModels.map(m => ({ value: m.id, label: m.name })),
        savedOptions: savedOpts,
        current: currentModelId,
        onChange: (value) => {
          api.setSlot(slotName, value);
          rebuild();
        },
      });
      section.appendChild(pickerEl);
    }
  }

  function buildConstructionControls() {
    const CONSTRUCTION_DEFAULT_PRIMARY = 0xc4b8aa;
    const section = addSection("Color");

    createColorPicker(section, "Primary", state.compositeConfig.palette.primary, (v) => {
      state.compositeConfig.palette.primary = v;
    });

    const resetRow = document.createElement("div");
    resetRow.className = "cfg-row";
    const resetBtn = document.createElement("button");
    resetBtn.className = "btn btn-secondary btn-sm";
    resetBtn.textContent = "Reset to default";
    resetBtn.addEventListener("click", () => {
      state.compositeConfig.palette.primary = CONSTRUCTION_DEFAULT_PRIMARY;
      rebuild();
    });
    resetRow.appendChild(resetBtn);
    section.appendChild(resetRow);

    const texSection = addSection("Texture");
    const div = document.createElement("div");
    div.style.cssText = "display:flex;flex-direction:column;gap:6px;";

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.style.cssText = "font-size:11px;color:var(--text-muted);width:100%;";

    const statusLbl = document.createElement("span");
    statusLbl.style.cssText = "font-size:10px;color:var(--text-faint);";
    statusLbl.textContent = "No texture loaded";

    fileInput.addEventListener("change", () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      (state as any)._constructionTextureUrl = url;
      statusLbl.textContent = file.name;
    });

    const clearBtn = document.createElement("button");
    clearBtn.className = "btn btn-secondary btn-sm";
    clearBtn.textContent = "Clear texture";
    clearBtn.addEventListener("click", () => {
      (state as any)._constructionTextureUrl = null;
      fileInput.value = "";
      statusLbl.textContent = "No texture loaded";
    });

    div.appendChild(fileInput);
    div.appendChild(statusLbl);
    div.appendChild(clearBtn);
    texSection.appendChild(div);
  }

  function buildColorPickers() {
    const section = addSection("Colors");
    const p = state.compositeConfig.palette;
    createColorPicker(section, "Skin", p.skin, (v) => { state.compositeConfig.palette.skin = v; rebuildPalette(); });
    createColorPicker(section, "Hair", p.hair, (v) => { state.compositeConfig.palette.hair = v; rebuildPalette(); });
    createColorPicker(section, "Eyes", p.eyes, (v) => { state.compositeConfig.palette.eyes = v; rebuildPalette(); });
  }

  function buildAnimationControls() {
    const section = addSection("Animation");
    const row = document.createElement("div");
    row.className = "cfg-row anim-controls";

    const playBtn = document.createElement("button");
    playBtn.className = "btn btn-secondary btn-sm";
    playBtn.textContent = state.playing ? "\u23f8 Pause" : "\u25b6 Play";
    playBtn.addEventListener("click", () => {
      api.toggleAnimation();
      playBtn.textContent = state.playing ? "\u23f8 Pause" : "\u25b6 Play";
    });

    row.appendChild(playBtn);
    section.appendChild(row);

    createSlider(section, "Speed", state.animSpeed, 0.1, 3.0, 0.1, (v) => api.setAnimSpeed(v));
  }

  function buildSaveLoad() {
    const section = addSection("Save / Load");

    // Save to DB
    const saveRow = document.createElement("div");
    saveRow.className = "save-row";
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.placeholder = "Model name...";
    nameInput.maxLength = 128;
    const saveBtn = document.createElement("button");
    saveBtn.className = "btn btn-primary btn-sm";
    saveBtn.textContent = "Save";
    saveBtn.addEventListener("click", async () => {
      const name = nameInput.value.trim();
      if (!name) { nameInput.focus(); return; }
      saveBtn.textContent = "...";
      saveBtn.disabled = true;
      try {
        await api.saveModel(name);
        nameInput.value = "";
        rebuild();
      } catch (err) {
        alert(`Save failed: ${err}`);
      } finally {
        saveBtn.textContent = "Save";
        saveBtn.disabled = false;
      }
    });
    saveRow.appendChild(nameInput);
    saveRow.appendChild(saveBtn);
    section.appendChild(saveRow);

    // Saved model list
    if (state.savedModels.length > 0) {
      const listDiv = document.createElement("div");
      for (const saved of state.savedModels) {
        const item = document.createElement("div");
        item.className = "db-model-item";

        const nameSpan = document.createElement("span");
        nameSpan.className = "item-name";
        nameSpan.textContent = saved.name;
        nameSpan.title = saved.description ?? saved.name;

        const loadBtn = document.createElement("button");
        loadBtn.className = "btn btn-secondary btn-sm";
        loadBtn.textContent = "Load";
        loadBtn.addEventListener("click", () => {
          api.loadSavedModel(saved.id);
          rebuild();
        });

        const delBtn = document.createElement("button");
        delBtn.className = "btn btn-danger btn-sm";
        delBtn.textContent = "×";
        delBtn.title = "Delete saved model";
        delBtn.addEventListener("click", async () => {
          if (!confirm(`Delete "${saved.name}"?`)) return;
          try {
            await api.deleteSavedModel(saved.id);
            rebuild();
          } catch (err) {
            alert(`Delete failed: ${err}`);
          }
        });

        item.appendChild(nameSpan);
        item.appendChild(loadBtn);
        item.appendChild(delBtn);
        listDiv.appendChild(item);
      }
      section.appendChild(listDiv);
    } else if (state.serverOnline) {
      const empty = document.createElement("div");
      empty.style.cssText = "font-size:10px;color:var(--text-faint);padding:4px 0;";
      empty.textContent = "No saved models yet";
      section.appendChild(empty);
    }
  }

  // ─── Helpers ───

  function createSlider(
    parent: HTMLElement,
    label: string,
    initial: number,
    min: number,
    max: number,
    step: number,
    onChange: (v: number) => void
  ) {
    const row = document.createElement("div");
    row.className = "cfg-row";
    const lbl = document.createElement("label");
    lbl.textContent = label;
    const valSpan = document.createElement("span");
    valSpan.className = "cfg-value";
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
    row.appendChild(lbl);
    row.appendChild(input);
    row.appendChild(valSpan);
    parent.appendChild(row);
  }

  function createColorPicker(
    parent: HTMLElement,
    label: string,
    initial: number,
    onChange: (v: number) => void
  ) {
    const row = document.createElement("div");
    row.className = "cfg-row";
    const lbl = document.createElement("label");
    lbl.textContent = label;
    const input = document.createElement("input");
    input.type = "color";
    input.value = "#" + initial.toString(16).padStart(6, "0");
    input.addEventListener("input", () => onChange(parseInt(input.value.slice(1), 16)));
    row.appendChild(lbl);
    row.appendChild(input);
    parent.appendChild(row);
  }

  rebuild();
  return { rebuild };
}
