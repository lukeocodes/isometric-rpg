import type { Screen } from "../UIManager";

const RACES = ["human", "elf", "dwarf"] as const;
const GENDERS = ["male", "female"] as const;
const SKILLS = [
  "swordsmanship", "archery", "magery", "mining", "lumberjacking",
  "tailoring", "blacksmithing", "alchemy", "fishing", "healing",
  "stealth", "musicianship", "cooking", "carpentry", "taming",
];

const SKIN_PALETTE = ["#f5d0a9", "#d4a574", "#a67c52", "#6b4226", "#3b2314"];
const HAIR_PALETTE = ["#2c1b0e", "#5a3825", "#b8860b", "#daa520", "#c0c0c0", "#8b0000", "#ff6347"];

export interface CharacterCreateData {
  name: string;
  race: string;
  gender: string;
  str_stat: number;
  dex_stat: number;
  int_stat: number;
  skills: { name: string }[];
  hair_style: number;
  hair_color: number;
  skin_tone: number;
  outfit: number;
}

export class CharacterCreateScreen implements Screen {
  private onCreate: (data: CharacterCreateData) => void;
  private onBack: () => void;
  private stats = { str: 10, dex: 10, int: 10 };
  private selectedSkills = new Set<string>();
  private selectedRace = "human";
  private selectedGender = "male";
  private hairStyle = 0;
  private hairColor = 0;
  private skinTone = 0;
  private errorEl: HTMLElement | null = null;

  constructor(onCreate: (data: CharacterCreateData) => void, onBack: () => void) {
    this.onCreate = onCreate;
    this.onBack = onBack;
  }

  render(): HTMLElement {
    const container = document.createElement("div");
    container.style.cssText = `
      display: flex; align-items: flex-start; justify-content: center;
      width: 100%; height: 100%; padding: 32px; gap: 32px; overflow-y: auto;
    `;

    // Left panel: form
    const form = document.createElement("div");
    form.style.cssText = `
      background: #16213e; border: 1px solid #333; border-radius: 12px;
      padding: 32px; width: 480px; display: flex; flex-direction: column; gap: 20px;
    `;

    form.appendChild(this.createHeader());
    form.appendChild(this.createNameInput());
    form.appendChild(this.createRaceGenderRow());
    form.appendChild(this.createStatAllocator());
    form.appendChild(this.createSkillPicker());
    form.appendChild(this.createAppearanceSection());

    this.errorEl = document.createElement("div");
    this.errorEl.style.cssText = "color: #ff6347; font-size: 14px; min-height: 20px;";
    form.appendChild(this.errorEl);

    form.appendChild(this.createButtons());

    // Right panel: preview
    const preview = document.createElement("div");
    preview.style.cssText = `
      background: #16213e; border: 1px solid #333; border-radius: 12px;
      width: 280px; height: 360px; display: flex; align-items: center;
      justify-content: center; flex-direction: column; gap: 12px;
    `;
    const previewLabel = document.createElement("div");
    previewLabel.textContent = "Character Preview";
    previewLabel.style.cssText = "color: #888; font-size: 14px;";

    const previewCanvas = document.createElement("canvas");
    previewCanvas.id = "preview-canvas";
    previewCanvas.width = 240;
    previewCanvas.height = 280;
    previewCanvas.style.cssText = "border-radius: 8px; background: #0a0a1a;";

    preview.append(previewLabel, previewCanvas);
    this.renderPreview(previewCanvas);

    container.append(form, preview);
    return container;
  }

  private createHeader(): HTMLElement {
    const h2 = document.createElement("h2");
    h2.textContent = "Create Character";
    h2.style.cssText = "font-size: 24px; color: #e0e0e0; margin: 0;";
    return h2;
  }

  private createNameInput(): HTMLElement {
    const group = this.fieldGroup("Name");
    const input = document.createElement("input");
    input.type = "text";
    input.id = "char-name";
    input.maxLength = 20;
    input.placeholder = "Enter character name...";
    input.style.cssText = this.inputStyle();
    group.appendChild(input);
    return group;
  }

  private createRaceGenderRow(): HTMLElement {
    const row = document.createElement("div");
    row.style.cssText = "display: flex; gap: 16px;";

    const raceGroup = this.fieldGroup("Race");
    raceGroup.style.flex = "1";
    const raceSelect = document.createElement("select");
    raceSelect.style.cssText = this.inputStyle();
    for (const race of RACES) {
      const opt = document.createElement("option");
      opt.value = race;
      opt.textContent = race.charAt(0).toUpperCase() + race.slice(1);
      raceSelect.appendChild(opt);
    }
    raceSelect.onchange = () => { this.selectedRace = raceSelect.value; this.refreshPreview(); };
    raceGroup.appendChild(raceSelect);

    const genderGroup = this.fieldGroup("Gender");
    genderGroup.style.flex = "1";
    const genderSelect = document.createElement("select");
    genderSelect.style.cssText = this.inputStyle();
    for (const gender of GENDERS) {
      const opt = document.createElement("option");
      opt.value = gender;
      opt.textContent = gender.charAt(0).toUpperCase() + gender.slice(1);
      genderSelect.appendChild(opt);
    }
    genderSelect.onchange = () => { this.selectedGender = genderSelect.value; this.refreshPreview(); };
    genderGroup.appendChild(genderSelect);

    row.append(raceGroup, genderGroup);
    return row;
  }

  private createStatAllocator(): HTMLElement {
    const group = this.fieldGroup("Stats (30 points)");
    const remaining = document.createElement("div");
    remaining.id = "stat-remaining";
    remaining.style.cssText = "font-size: 13px; color: #13ef93; margin-bottom: 8px;";

    const stats: Array<{ key: keyof typeof this.stats; label: string }> = [
      { key: "str", label: "STR" },
      { key: "dex", label: "DEX" },
      { key: "int", label: "INT" },
    ];

    const updateRemaining = () => {
      const total = this.stats.str + this.stats.dex + this.stats.int;
      remaining.textContent = `Remaining: ${30 - total}`;
      remaining.style.color = total === 30 ? "#13ef93" : total > 30 ? "#ff6347" : "#daa520";
    };

    group.appendChild(remaining);

    for (const stat of stats) {
      const row = document.createElement("div");
      row.style.cssText = "display: flex; align-items: center; gap: 8px; margin-bottom: 6px;";

      const label = document.createElement("span");
      label.textContent = stat.label;
      label.style.cssText = "width: 36px; font-weight: 600; color: #ccc;";

      const minus = document.createElement("button");
      minus.textContent = "−";
      minus.style.cssText = this.smallBtnStyle();

      const value = document.createElement("span");
      value.style.cssText = "width: 32px; text-align: center; font-size: 16px;";
      value.textContent = String(this.stats[stat.key]);

      const plus = document.createElement("button");
      plus.textContent = "+";
      plus.style.cssText = this.smallBtnStyle();

      const bar = document.createElement("div");
      bar.style.cssText = "flex: 1; height: 8px; background: #333; border-radius: 4px; overflow: hidden;";
      const fill = document.createElement("div");
      fill.style.cssText = `height: 100%; background: #13ef93; border-radius: 4px; width: ${((this.stats[stat.key] - 5) / 15) * 100}%;`;
      bar.appendChild(fill);

      minus.onclick = () => {
        if (this.stats[stat.key] > 5) {
          this.stats[stat.key]--;
          value.textContent = String(this.stats[stat.key]);
          fill.style.width = `${((this.stats[stat.key] - 5) / 15) * 100}%`;
          updateRemaining();
        }
      };

      plus.onclick = () => {
        const total = this.stats.str + this.stats.dex + this.stats.int;
        if (this.stats[stat.key] < 20 && total < 30) {
          this.stats[stat.key]++;
          value.textContent = String(this.stats[stat.key]);
          fill.style.width = `${((this.stats[stat.key] - 5) / 15) * 100}%`;
          updateRemaining();
        }
      };

      row.append(label, minus, value, plus, bar);
      group.appendChild(row);
    }

    updateRemaining();
    return group;
  }

  private createSkillPicker(): HTMLElement {
    const group = this.fieldGroup("Starting Skills (pick 3)");
    const grid = document.createElement("div");
    grid.style.cssText = "display: flex; flex-wrap: wrap; gap: 6px;";

    for (const skill of SKILLS) {
      const chip = document.createElement("button");
      chip.textContent = skill.charAt(0).toUpperCase() + skill.slice(1);
      chip.style.cssText = `
        padding: 6px 12px; font-size: 12px; border-radius: 16px; cursor: pointer;
        border: 1px solid #333; background: #0a0a1a; color: #aaa; transition: all 0.15s;
      `;

      chip.onclick = () => {
        if (this.selectedSkills.has(skill)) {
          this.selectedSkills.delete(skill);
          chip.style.background = "#0a0a1a";
          chip.style.borderColor = "#333";
          chip.style.color = "#aaa";
        } else if (this.selectedSkills.size < 3) {
          this.selectedSkills.add(skill);
          chip.style.background = "#13ef9322";
          chip.style.borderColor = "#13ef93";
          chip.style.color = "#13ef93";
        }
      };

      grid.appendChild(chip);
    }

    group.appendChild(grid);
    return group;
  }

  private createAppearanceSection(): HTMLElement {
    const group = this.fieldGroup("Appearance");

    // Skin tone
    const skinRow = document.createElement("div");
    skinRow.style.cssText = "display: flex; align-items: center; gap: 8px; margin-bottom: 8px;";
    const skinLabel = document.createElement("span");
    skinLabel.textContent = "Skin";
    skinLabel.style.cssText = "width: 40px; color: #aaa; font-size: 13px;";
    skinRow.appendChild(skinLabel);

    SKIN_PALETTE.forEach((color, i) => {
      const swatch = document.createElement("button");
      swatch.style.cssText = `
        width: 28px; height: 28px; border-radius: 50%; border: 2px solid ${i === this.skinTone ? "#13ef93" : "transparent"};
        background: ${color}; cursor: pointer;
      `;
      swatch.onclick = () => {
        this.skinTone = i;
        skinRow.querySelectorAll("button").forEach((b, j) => {
          (b as HTMLElement).style.borderColor = j === i ? "#13ef93" : "transparent";
        });
        this.refreshPreview();
      };
      skinRow.appendChild(swatch);
    });

    // Hair color
    const hairRow = document.createElement("div");
    hairRow.style.cssText = "display: flex; align-items: center; gap: 8px;";
    const hairLabel = document.createElement("span");
    hairLabel.textContent = "Hair";
    hairLabel.style.cssText = "width: 40px; color: #aaa; font-size: 13px;";
    hairRow.appendChild(hairLabel);

    HAIR_PALETTE.forEach((color, i) => {
      const swatch = document.createElement("button");
      swatch.style.cssText = `
        width: 28px; height: 28px; border-radius: 50%; border: 2px solid ${i === this.hairColor ? "#13ef93" : "transparent"};
        background: ${color}; cursor: pointer;
      `;
      swatch.onclick = () => {
        this.hairColor = i;
        hairRow.querySelectorAll("button").forEach((b, j) => {
          (b as HTMLElement).style.borderColor = j === i ? "#13ef93" : "transparent";
        });
        this.refreshPreview();
      };
      hairRow.appendChild(swatch);
    });

    group.append(skinRow, hairRow);
    return group;
  }

  private createButtons(): HTMLElement {
    const row = document.createElement("div");
    row.style.cssText = "display: flex; gap: 12px; justify-content: flex-end;";

    const backBtn = document.createElement("button");
    backBtn.textContent = "Back";
    backBtn.style.cssText = `
      padding: 12px 24px; font-size: 14px; background: transparent;
      color: #aaa; border: 1px solid #333; border-radius: 6px; cursor: pointer;
    `;
    backBtn.onclick = () => this.onBack();

    const createBtn = document.createElement("button");
    createBtn.textContent = "Create Character";
    createBtn.style.cssText = `
      padding: 12px 24px; font-size: 14px; background: #13ef93;
      color: #1a1a2e; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;
    `;
    createBtn.onclick = () => this.submit();

    row.append(backBtn, createBtn);
    return row;
  }

  private submit() {
    const nameInput = document.getElementById("char-name") as HTMLInputElement;
    const name = nameInput?.value?.trim() || "";

    if (!name || name.length < 3) {
      this.showError("Name must be at least 3 characters");
      return;
    }
    const total = this.stats.str + this.stats.dex + this.stats.int;
    if (total !== 30) {
      this.showError(`Stats must total 30 (currently ${total})`);
      return;
    }
    if (this.selectedSkills.size !== 3) {
      this.showError(`Select exactly 3 skills (currently ${this.selectedSkills.size})`);
      return;
    }

    this.onCreate({
      name,
      race: this.selectedRace,
      gender: this.selectedGender,
      str_stat: this.stats.str,
      dex_stat: this.stats.dex,
      int_stat: this.stats.int,
      skills: Array.from(this.selectedSkills).map((s) => ({ name: s })),
      hair_style: this.hairStyle,
      hair_color: this.hairColor,
      skin_tone: this.skinTone,
      outfit: 0,
    });
  }

  private showError(msg: string) {
    if (this.errorEl) this.errorEl.textContent = msg;
  }

  private renderPreview(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    this.drawPreviewChar(ctx, canvas.width, canvas.height);
  }

  private refreshPreview() {
    const canvas = document.getElementById("preview-canvas") as HTMLCanvasElement | null;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    this.drawPreviewChar(ctx, canvas.width, canvas.height);
  }

  private drawPreviewChar(ctx: CanvasRenderingContext2D, w: number, h: number) {
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2;
    const baseY = h * 0.75;
    const skinColor = SKIN_PALETTE[this.skinTone] || SKIN_PALETTE[0];
    const hairColor = HAIR_PALETTE[this.hairColor] || HAIR_PALETTE[0];

    // Body scale by race
    const scale = this.selectedRace === "dwarf" ? 0.8 : this.selectedRace === "elf" ? 1.1 : 1.0;
    const bodyWidth = (this.selectedGender === "male" ? 40 : 34) * scale;
    const bodyHeight = 70 * scale;

    // Body (cylinder approximation)
    ctx.fillStyle = "#445577";
    ctx.beginPath();
    ctx.ellipse(cx, baseY - bodyHeight / 2, bodyWidth / 2, bodyHeight / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    const headRadius = 22 * scale;
    const headY = baseY - bodyHeight - headRadius + 8;
    ctx.fillStyle = skinColor;
    ctx.beginPath();
    ctx.arc(cx, headY, headRadius, 0, Math.PI * 2);
    ctx.fill();

    // Hair
    ctx.fillStyle = hairColor;
    ctx.beginPath();
    ctx.arc(cx, headY - 4, headRadius + 2, Math.PI, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = "#222";
    ctx.beginPath();
    ctx.arc(cx - 7, headY, 2.5, 0, Math.PI * 2);
    ctx.arc(cx + 7, headY, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Elf ears
    if (this.selectedRace === "elf") {
      ctx.fillStyle = skinColor;
      ctx.beginPath();
      ctx.moveTo(cx - headRadius, headY - 5);
      ctx.lineTo(cx - headRadius - 12, headY - 20);
      ctx.lineTo(cx - headRadius + 5, headY - 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx + headRadius, headY - 5);
      ctx.lineTo(cx + headRadius + 12, headY - 20);
      ctx.lineTo(cx + headRadius - 5, headY - 2);
      ctx.fill();
    }
  }

  private fieldGroup(label: string): HTMLElement {
    const group = document.createElement("div");
    const lbl = document.createElement("label");
    lbl.textContent = label;
    lbl.style.cssText = "display: block; font-size: 13px; color: #888; margin-bottom: 6px; font-weight: 600;";
    group.appendChild(lbl);
    return group;
  }

  private inputStyle(): string {
    return `
      width: 100%; padding: 10px 12px; font-size: 14px; background: #0a0a1a;
      color: #e0e0e0; border: 1px solid #333; border-radius: 6px; box-sizing: border-box;
    `;
  }

  private smallBtnStyle(): string {
    return `
      width: 28px; height: 28px; border: 1px solid #333; border-radius: 4px;
      background: #0a0a1a; color: #e0e0e0; cursor: pointer; font-size: 16px;
      display: flex; align-items: center; justify-content: center;
    `;
  }
}
